import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Parking } from './entities/parking.entity';
import { Model } from 'mongoose';
import { PAYMENT_METHODS, PaymentMethod } from './dto/exit-parking.dto';
import {
  calculateParkingCharge,
  normalizeVehicleNumber,
} from './parking-billing';
import { AuditService } from '../audit/audit.service';
import { AuditContext } from '../audit/audit-context';
import { EVASION_REASON_CODES, EvasionReasonCode } from './parking.constants';
import { LocationService } from '../location/location.service';
import { ConfigService } from '@nestjs/config';
import {
  getChileDateKey,
  getChileDayCutoffUtc,
  getChileLocalTimeLabel,
  isWithinOperatingHours,
} from './parking-operating-hours';

@Injectable()
export class ParkingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ParkingService.name);
  private autoEvasionTimer?: ReturnType<typeof setInterval>;
  private lastAutoEvasionDate?: string;

  constructor(
    @InjectModel(Parking.name) private parkingModel: Model<Parking>,
    private readonly auditService: AuditService,
    private readonly locationService: LocationService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.autoEvasionTimer = setInterval(() => {
      void this.checkAutoEvasionTick(new Date());
    }, 60_000);

    void this.checkAutoEvasionTick(new Date());
  }

  onModuleDestroy(): void {
    if (this.autoEvasionTimer) {
      clearInterval(this.autoEvasionTimer);
      this.autoEvasionTimer = undefined;
    }
  }

  async registerEntry(
    vehicleNumber: unknown,
    auditContext: AuditContext = { actor: 'system' },
  ): Promise<Parking> {
    const normalizedVehicleNumber = this.normalizeOrFail(vehicleNumber);
    const now = new Date();
    const openTime = this.configService.getOrThrow<string>('PARKING_OPEN_TIME');
    const closeTime = this.configService.getOrThrow<string>('PARKING_CLOSE_TIME');

    if (!isWithinOperatingHours(now, openTime, closeTime)) {
      await this.recordRejected(
        auditContext,
        'parking.entry',
        normalizedVehicleNumber,
        'outside-operating-hours',
      );
      throw new BadRequestException(
        `Fuera de horario de ingreso (${openTime} a ${closeTime}).`,
      );
    }

    const location = await this.locationService.getCurrentLocation();
    const activeParking = await this.parkingModel.findOne({
      locationId: location._id,
      vehicleNumber: normalizedVehicleNumber,
      $or: [
        { status: 'active' },
        { status: { $exists: false }, exitTime: { $exists: false } },
      ],
    });

    if (activeParking) {
      await this.recordRejected(
        auditContext,
        'parking.entry',
        normalizedVehicleNumber,
        'active-parking-exists',
        String(activeParking._id),
      );
      throw new ConflictException('El vehículo ya tiene un ingreso activo');
    }

    const entry = new this.parkingModel({
      locationId: location._id,
      locationCode: location.code,
      vehicleNumber: normalizedVehicleNumber,
      entryTime: now,
      ratePerMinute: location.ratePerMinute,
      status: 'active',
      paymentStatus: 'pending',
      amountPaid: 0,
      outstandingAmount: 0,
    });

    const savedEntry = await entry.save();

    await this.auditService.record({
      ...auditContext,
      action: 'parking.entry',
      entityType: 'Parking',
      entityId: String(savedEntry._id),
      summary: `Entrada registrada: ${savedEntry.vehicleNumber}`,
      metadata: {
        locationId: String(location._id),
        locationCode: location.code,
        vehicleNumber: savedEntry.vehicleNumber,
        entryTime: savedEntry.entryTime,
        ratePerMinute: savedEntry.ratePerMinute,
      },
    });

    return savedEntry;
  }

  async registerExit(
    vehicleNumber: unknown,
    paymentMethod: PaymentMethod = 'cash',
    auditContext: AuditContext = { actor: 'system' },
  ): Promise<Parking> {
    const normalizedVehicleNumber = this.normalizeOrFail(vehicleNumber);
    const location = await this.locationService.getCurrentLocation();

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      await this.recordRejected(
        auditContext,
        'parking.exit',
        normalizedVehicleNumber,
        'invalid-payment-method',
      );
      throw new BadRequestException('El medio de pago no es válido');
    }

    const parking = await this.parkingModel
      .findOne({
        locationId: location._id,
        vehicleNumber: normalizedVehicleNumber,
        $or: [
          { status: 'active' },
          { status: { $exists: false }, exitTime: { $exists: false } },
        ],
      })
      .sort({ entryTime: -1 });

    if (!parking) {
      await this.recordRejected(
        auditContext,
        'parking.exit',
        normalizedVehicleNumber,
        'no-active-parking',
      );
      throw new NotFoundException(
        'No existe un estacionamiento activo para este vehículo',
      );
    }

    const exitTime = new Date();
    const ratePerMinute = parking.ratePerMinute || location.ratePerMinute;
    const { totalMinutes, totalCost } = calculateParkingCharge(
      parking.entryTime,
      exitTime,
      ratePerMinute,
    );

    parking.exitTime = exitTime;
    parking.totalMinutes = totalMinutes;
    parking.totalCost = totalCost;
    parking.ratePerMinute = ratePerMinute;
    parking.status = 'completed';
    parking.paymentStatus = 'paid';
    parking.exitType = 'paid';
    parking.paymentMethod = paymentMethod;
    parking.paidAt = exitTime;
    parking.amountPaid = totalCost;
    parking.outstandingAmount = 0;

    const completedParking = await parking.save();

    await this.auditService.record({
      ...auditContext,
      action: 'parking.exit',
      entityType: 'Parking',
      entityId: String(completedParking._id),
      summary: `Salida cobrada: ${completedParking.vehicleNumber}`,
      metadata: {
        locationId: String(location._id),
        locationCode: location.code,
        vehicleNumber: completedParking.vehicleNumber,
        entryTime: completedParking.entryTime,
        exitTime: completedParking.exitTime,
        totalMinutes: completedParking.totalMinutes,
        ratePerMinute: completedParking.ratePerMinute,
        totalCost: completedParking.totalCost,
        paymentMethod: completedParking.paymentMethod,
      },
    });

    return completedParking;
  }

  async registerEvasion(
    vehicleNumber: unknown,
    reasonCode: EvasionReasonCode,
    observation?: string,
    auditContext: AuditContext = { actor: 'system' },
  ): Promise<Parking> {
    const normalizedVehicleNumber = this.normalizeOrFail(vehicleNumber);
    const location = await this.locationService.getCurrentLocation();

    if (!EVASION_REASON_CODES.includes(reasonCode)) {
      await this.recordRejected(
        auditContext,
        'parking.evasion',
        normalizedVehicleNumber,
        'invalid-reason-code',
      );
      throw new BadRequestException('El motivo de evasión no es válido');
    }

    const normalizedObservation = observation?.trim();
    if (normalizedObservation && normalizedObservation.length > 500) {
      await this.recordRejected(
        auditContext,
        'parking.evasion',
        normalizedVehicleNumber,
        'observation-too-long',
      );
      throw new BadRequestException(
        'La observación no puede superar los 500 caracteres',
      );
    }

    const parking = await this.parkingModel
      .findOne({
        locationId: location._id,
        vehicleNumber: normalizedVehicleNumber,
        $or: [
          { status: 'active' },
          { status: { $exists: false }, exitTime: { $exists: false } },
        ],
      })
      .sort({ entryTime: -1 });

    if (!parking) {
      await this.recordRejected(
        auditContext,
        'parking.evasion',
        normalizedVehicleNumber,
        'no-active-parking',
      );
      throw new NotFoundException(
        'No existe un estacionamiento activo para este vehículo',
      );
    }

    const exitTime = new Date();
    const ratePerMinute = parking.ratePerMinute || location.ratePerMinute;
    const { totalMinutes, totalCost } = calculateParkingCharge(
      parking.entryTime,
      exitTime,
      ratePerMinute,
    );

    parking.exitTime = exitTime;
    parking.totalMinutes = totalMinutes;
    parking.totalCost = totalCost;
    parking.ratePerMinute = ratePerMinute;
    parking.status = 'evaded';
    parking.paymentStatus = 'evaded';
    parking.exitType = 'evasion';
    parking.amountPaid = 0;
    parking.outstandingAmount = totalCost;
    parking.evasionReasonCode = reasonCode;
    parking.evasionObservation = normalizedObservation || undefined;
    parking.evasionRecordedBy = auditContext.actor;

    const evadedParking = await parking.save();

    await this.auditService.record({
      ...auditContext,
      action: 'parking.evasion',
      entityType: 'Parking',
      entityId: String(evadedParking._id),
      summary: `Salida sin pago registrada: ${evadedParking.vehicleNumber}`,
      metadata: {
        locationId: String(location._id),
        locationCode: location.code,
        vehicleNumber: evadedParking.vehicleNumber,
        entryTime: evadedParking.entryTime,
        exitTime: evadedParking.exitTime,
        totalMinutes: evadedParking.totalMinutes,
        ratePerMinute: evadedParking.ratePerMinute,
        totalCost: evadedParking.totalCost,
        amountPaid: 0,
        outstandingAmount: evadedParking.outstandingAmount,
        reasonCode: evadedParking.evasionReasonCode,
        observation: evadedParking.evasionObservation,
      },
    });

    return evadedParking;
  }

  async getParkings(
    status?: 'active' | 'completed' | 'evaded',
  ): Promise<Parking[]> {
    const location = await this.locationService.getCurrentLocation();

    if (status === 'active') {
      return this.parkingModel
        .find({
          $and: [
            { locationId: location._id },
            {
              $or: [
                { status: 'active' },
                { status: { $exists: false }, exitTime: { $exists: false } },
              ],
            },
          ],
        })
        .sort({ entryTime: -1 });
    }

    if (status === 'completed') {
      return this.parkingModel
        .find({
          $and: [
            { locationId: location._id },
            {
              $or: [
                { status: 'completed' },
                { paymentStatus: 'paid' },
                {
                  status: { $exists: false },
                  exitTime: { $exists: true },
                },
              ],
            },
            { status: { $ne: 'evaded' } },
            { paymentStatus: { $ne: 'evaded' } },
          ],
        })
        .sort({ exitTime: -1 })
        .limit(100);
    }

    if (status === 'evaded') {
      return this.parkingModel
        .find({
          $and: [
            { locationId: location._id },
            {
              $or: [{ status: 'evaded' }, { paymentStatus: 'evaded' }],
            },
          ],
        })
        .sort({ exitTime: -1 })
        .limit(100);
    }

    return this.parkingModel
      .find({ locationId: location._id })
      .sort({ entryTime: -1 })
      .limit(200);
  }

  async getTodaySummary() {
    const location = await this.locationService.getCurrentLocation();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [activeVehicles, completed] = await Promise.all([
      this.parkingModel.countDocuments({
        $and: [
          { locationId: location._id },
          {
            $or: [
              { status: 'active' },
              { status: { $exists: false }, exitTime: { $exists: false } },
            ],
          },
        ],
      }),
      this.parkingModel.aggregate<{
        completedVehicles: number;
        revenue: number;
        billedMinutes: number;
        evadedVehicles: number;
        evadedAmount: number;
      }>([
        {
          $match: {
            locationId: location._id,
            exitTime: { $gte: startOfDay },
          },
        },
        {
          $group: {
            _id: null,
            completedVehicles: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'completed'] },
                      { $eq: ['$paymentStatus', 'paid'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            revenue: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'completed'] },
                      { $eq: ['$paymentStatus', 'paid'] },
                    ],
                  },
                  { $ifNull: ['$amountPaid', '$totalCost'] },
                  0,
                ],
              },
            },
            billedMinutes: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'completed'] },
                      { $eq: ['$paymentStatus', 'paid'] },
                    ],
                  },
                  { $ifNull: ['$totalMinutes', 0] },
                  0,
                ],
              },
            },
            evadedVehicles: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'evaded'] },
                      { $eq: ['$paymentStatus', 'evaded'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            evadedAmount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'evaded'] },
                      { $eq: ['$paymentStatus', 'evaded'] },
                    ],
                  },
                  { $ifNull: ['$outstandingAmount', '$totalCost'] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    return {
      activeVehicles,
      completedVehicles: completed[0]?.completedVehicles ?? 0,
      revenue: completed[0]?.revenue ?? 0,
      billedMinutes: completed[0]?.billedMinutes ?? 0,
      evadedVehicles: completed[0]?.evadedVehicles ?? 0,
      evadedAmount: completed[0]?.evadedAmount ?? 0,
      ratePerMinute: location.ratePerMinute,
    };
  }

  async getConfig() {
    const location = await this.locationService.getCurrentLocation();
    const openTime = this.configService.getOrThrow<string>('PARKING_OPEN_TIME');
    const closeTime = this.configService.getOrThrow<string>('PARKING_CLOSE_TIME');
    const autoEvasionTime = this.configService.getOrThrow<string>(
      'PARKING_AUTO_EVASION_TIME',
    );

    return {
      locationId: String(location._id),
      locationCode: location.code,
      ratePerMinute: location.ratePerMinute,
      currency: location.currency,
      openTime,
      closeTime,
      autoEvasionTime,
    };
  }

  async runAutoEvasionForClosingTime(now: Date = new Date()): Promise<number> {
    const location = await this.locationService.getCurrentLocation();
    const closeTime = this.configService.getOrThrow<string>('PARKING_CLOSE_TIME');
    const autoEvasionTime = this.configService.getOrThrow<string>(
      'PARKING_AUTO_EVASION_TIME',
    );
    const cutoffTime = getChileDayCutoffUtc(now, closeTime);
    const activeParkings = await this.parkingModel
      .find({
        locationId: location._id,
        $or: [
          { status: 'active' },
          { status: { $exists: false }, exitTime: { $exists: false } },
        ],
      })
      .sort({ entryTime: 1 });

    let processed = 0;

    for (const parking of activeParkings) {
      const ratePerMinute = parking.ratePerMinute || location.ratePerMinute;
      const exitTime =
        parking.entryTime.getTime() > cutoffTime.getTime()
          ? parking.entryTime
          : cutoffTime;
      const { totalMinutes, totalCost } = calculateParkingCharge(
        parking.entryTime,
        exitTime,
        ratePerMinute,
      );

      parking.exitTime = exitTime;
      parking.totalMinutes = totalMinutes;
      parking.totalCost = totalCost;
      parking.ratePerMinute = ratePerMinute;
      parking.status = 'evaded';
      parking.paymentStatus = 'evaded';
      parking.exitType = 'evasion';
      parking.amountPaid = 0;
      parking.outstandingAmount = totalCost;
      parking.evasionReasonCode = 'unknown';
      parking.evasionObservation =
        `Cierre automático fuera de horario. Cobro calculado hasta ${closeTime}.`;
      parking.evasionRecordedBy = 'system:auto';

      const evadedParking = await parking.save();
      processed += 1;

      await this.auditService.record({
        actor: 'system:auto',
        action: 'parking.evasion.auto',
        entityType: 'Parking',
        entityId: String(evadedParking._id),
        summary: `Evasión automática por cierre diario: ${evadedParking.vehicleNumber}`,
        metadata: {
          locationId: String(location._id),
          locationCode: location.code,
          vehicleNumber: evadedParking.vehicleNumber,
          entryTime: evadedParking.entryTime,
          exitTime: evadedParking.exitTime,
          totalMinutes: evadedParking.totalMinutes,
          totalCost: evadedParking.totalCost,
          ratePerMinute: evadedParking.ratePerMinute,
          closeTime,
          autoEvasionTime,
        },
      });
    }

    return processed;
  }

  private async checkAutoEvasionTick(now: Date): Promise<void> {
    const autoEvasionTime = this.configService.getOrThrow<string>(
      'PARKING_AUTO_EVASION_TIME',
    );
    const currentTime = getChileLocalTimeLabel(now);
    const chileDate = getChileDateKey(now);

    if (currentTime < autoEvasionTime) {
      return;
    }

    if (this.lastAutoEvasionDate === chileDate) {
      return;
    }

    const processed = await this.runAutoEvasionForClosingTime(now);
    this.lastAutoEvasionDate = chileDate;

    this.logger.log(
      `Cierre automático de evasión ejecutado (${chileDate}): ${processed} operaciones cerradas`,
    );
  }

  private async recordRejected(
    auditContext: AuditContext,
    action: 'parking.entry' | 'parking.exit' | 'parking.evasion',
    vehicleNumber: string,
    reason: string,
    entityId?: string,
  ): Promise<void> {
    const location = await this.locationService.getCurrentLocation();

    await this.auditService.record({
      ...auditContext,
      action,
      entityType: 'Parking',
      entityId,
      success: false,
      summary: `Operación rechazada: ${action}`,
      metadata: {
        locationId: String(location._id),
        locationCode: location.code,
        vehicleNumber,
        reason,
      },
    });
  }

  private normalizeOrFail(vehicleNumber: unknown): string {
    try {
      return normalizeVehicleNumber(vehicleNumber);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
