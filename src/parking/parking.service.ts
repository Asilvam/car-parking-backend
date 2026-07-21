import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Parking } from './entities/parking.entity';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  PAYMENT_METHODS,
  PaymentMethod,
} from './dto/exit-parking.dto';
import {
  calculateParkingCharge,
  normalizeVehicleNumber,
} from './parking-billing';

@Injectable()
export class ParkingService {
  constructor(
    @InjectModel(Parking.name) private parkingModel: Model<Parking>,
    private readonly configService: ConfigService,
  ) {}

  private get ratePerMinute(): number {
    const configuredRate = Number(
      this.configService.get<string>('RATE_PER_MINUTE') ?? 30,
    );

    return Number.isFinite(configuredRate) && configuredRate > 0
      ? configuredRate
      : 30;
  }

  async registerEntry(vehicleNumber: unknown): Promise<Parking> {
    const normalizedVehicleNumber = this.normalizeOrFail(vehicleNumber);
    const activeParking = await this.parkingModel.findOne({
      vehicleNumber: normalizedVehicleNumber,
      $or: [
        { status: 'active' },
        { status: { $exists: false }, exitTime: { $exists: false } },
      ],
    });

    if (activeParking) {
      throw new ConflictException('El vehículo ya tiene un ingreso activo');
    }

    const entry = new this.parkingModel({
      vehicleNumber: normalizedVehicleNumber,
      entryTime: new Date(),
      ratePerMinute: this.ratePerMinute,
      status: 'active',
    });

    return entry.save();
  }

  async registerExit(
    vehicleNumber: unknown,
    paymentMethod: PaymentMethod = 'cash',
  ): Promise<Parking> {
    const normalizedVehicleNumber = this.normalizeOrFail(vehicleNumber);

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new BadRequestException('El medio de pago no es válido');
    }

    const parking = await this.parkingModel
      .findOne({
        vehicleNumber: normalizedVehicleNumber,
        $or: [
          { status: 'active' },
          { status: { $exists: false }, exitTime: { $exists: false } },
        ],
      })
      .sort({ entryTime: -1 });

    if (!parking) {
      throw new NotFoundException(
        'No existe un estacionamiento activo para este vehículo',
      );
    }

    const exitTime = new Date();
    const ratePerMinute = parking.ratePerMinute || this.ratePerMinute;
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
    parking.paymentMethod = paymentMethod;
    parking.paidAt = exitTime;

    return parking.save();
  }

  async getParkings(status?: 'active' | 'completed'): Promise<Parking[]> {
    if (status === 'active') {
      return this.parkingModel
        .find({
          $or: [
            { status: 'active' },
            { status: { $exists: false }, exitTime: { $exists: false } },
          ],
        })
        .sort({ entryTime: -1 });
    }

    if (status === 'completed') {
      return this.parkingModel
        .find({
          $or: [{ status: 'completed' }, { exitTime: { $exists: true } }],
        })
        .sort({ exitTime: -1 })
        .limit(100);
    }

    return this.parkingModel.find().sort({ entryTime: -1 }).limit(200);
  }

  async getTodaySummary() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [activeVehicles, completed] = await Promise.all([
      this.parkingModel.countDocuments({
        $or: [
          { status: 'active' },
          { status: { $exists: false }, exitTime: { $exists: false } },
        ],
      }),
      this.parkingModel.aggregate<{
        completedVehicles: number;
        revenue: number;
        billedMinutes: number;
      }>([
        { $match: { exitTime: { $gte: startOfDay } } },
        {
          $group: {
            _id: null,
            completedVehicles: { $sum: 1 },
            revenue: { $sum: { $ifNull: ['$totalCost', 0] } },
            billedMinutes: { $sum: { $ifNull: ['$totalMinutes', 0] } },
          },
        },
      ]),
    ]);

    return {
      activeVehicles,
      completedVehicles: completed[0]?.completedVehicles ?? 0,
      revenue: completed[0]?.revenue ?? 0,
      billedMinutes: completed[0]?.billedMinutes ?? 0,
      ratePerMinute: this.ratePerMinute,
    };
  }

  getConfig() {
    return { ratePerMinute: this.ratePerMinute, currency: 'CLP' };
  }

  private normalizeOrFail(vehicleNumber: unknown): string {
    try {
      return normalizeVehicleNumber(vehicleNumber);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
