import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { Parking } from '../parking/entities/parking.entity';
import {
  AdminReportQuery,
  ReportPaymentMethod,
  ReportPreset,
  ReportStatus,
} from './admin.types';

type DateRange = {
  from: Date;
  to: Date;
  label: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CL_TIME_ZONE = 'America/Santiago';

@Injectable()
export class AdminReportingService {
  constructor(
    @InjectModel(Parking.name)
    private readonly parkingModel: Model<Parking>,
  ) {}

  async exportParkingReport(query: AdminReportQuery): Promise<Buffer> {
    const sanitized = this.normalizeQuery(query);
    const range = this.resolveDateRange(sanitized);
    const filter = this.buildMongoFilter(sanitized, range);
    const rows = await this.parkingModel.find(filter).sort({ entryTime: -1 });

    const workbook = new ExcelJS.Workbook();
    const detailSheet = workbook.addWorksheet('Movimientos');
    const summarySheet = workbook.addWorksheet('Resumen');

    this.fillDetailSheet(detailSheet, rows);
    this.fillSummarySheet(summarySheet, rows, range, sanitized);

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
  }

  async getParkingSummary(query: AdminReportQuery) {
    const sanitized = this.normalizeQuery(query);
    const range = this.resolveDateRange(sanitized);
    const filter = this.buildMongoFilter(sanitized, range);
    const rows = await this.parkingModel.find(filter).sort({ entryTime: -1 });

    const completed = rows.filter((record) => record.status === 'completed');
    const evaded = rows.filter((record) => record.status === 'evaded');
    const active = rows.filter((record) => record.status === 'active');

    const totalRevenue = completed.reduce(
      (total, record) => total + (record.amountPaid ?? record.totalCost ?? 0),
      0,
    );
    const totalDebt = evaded.reduce(
      (total, record) => total + (record.outstandingAmount ?? record.totalCost ?? 0),
      0,
    );

    const paymentTotals = {
      cash: 0,
      debit: 0,
      credit: 0,
      transfer: 0,
    };

    for (const row of completed) {
      if (row.paymentMethod && row.paymentMethod in paymentTotals) {
        paymentTotals[row.paymentMethod] += row.amountPaid ?? row.totalCost ?? 0;
      }
    }

    return {
      range: range.label,
      filters: sanitized,
      totals: {
        movements: rows.length,
        active: active.length,
        completed: completed.length,
        evaded: evaded.length,
        revenue: totalRevenue,
        debt: totalDebt,
      },
      paymentTotals,
      recent: rows.slice(0, 200).map((record) => ({
        id: String(record._id),
        vehicleNumber: record.vehicleNumber,
        status: record.status,
        entryTime: record.entryTime,
        exitTime: record.exitTime,
        totalMinutes: record.totalMinutes ?? 0,
        amountPaid: record.amountPaid ?? record.totalCost ?? 0,
        outstandingAmount: record.outstandingAmount ?? 0,
        paymentMethod: record.paymentMethod,
      })),
    };
  }

  private normalizeQuery(query: AdminReportQuery): Required<AdminReportQuery> {
    const preset = (query.preset ?? 'day') as ReportPreset;
    const status = (query.status ?? 'all') as ReportStatus;
    const paymentMethod = (query.paymentMethod ?? 'all') as ReportPaymentMethod;

    if (!['day', 'week', 'month', 'range'].includes(preset)) {
      throw new BadRequestException('preset inválido');
    }

    if (!['all', 'active', 'completed', 'evaded'].includes(status)) {
      throw new BadRequestException('status inválido');
    }

    if (!['all', 'cash', 'debit', 'credit', 'transfer'].includes(paymentMethod)) {
      throw new BadRequestException('paymentMethod inválido');
    }

    const vehicleNumber = (query.vehicleNumber ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    return {
      preset,
      date: query.date ?? this.todayChileIso(),
      from: query.from ?? '',
      to: query.to ?? '',
      status,
      paymentMethod,
      vehicleNumber,
    };
  }

  private resolveDateRange(query: Required<AdminReportQuery>): DateRange {
    if (query.preset === 'range') {
      if (!DATE_PATTERN.test(query.from) || !DATE_PATTERN.test(query.to)) {
        throw new BadRequestException(
          'from y to son obligatorios para preset range',
        );
      }

      if (query.from > query.to) {
        throw new BadRequestException('from no puede ser mayor que to');
      }

      const from = this.toUtcFromChileLocal(`${query.from}T00:00`);
      const to = this.toUtcFromChileLocal(`${query.to}T23:59`);

      return {
        from,
        to,
        label: `${query.from} a ${query.to} (Chile)`,
      };
    }

    if (!DATE_PATTERN.test(query.date)) {
      throw new BadRequestException('date debe usar formato YYYY-MM-DD');
    }

    const base = this.chileDateFromIso(query.date);

    if (query.preset === 'day') {
      return {
        from: this.toUtcFromChileDate(base.year, base.month, base.day, 0, 0),
        to: this.toUtcFromChileDate(base.year, base.month, base.day, 23, 59),
        label: `${query.date} (Chile)`,
      };
    }

    if (query.preset === 'week') {
      const start = this.startOfWeekMonday(base);
      const end = this.addDays(start, 6);

      return {
        from: this.toUtcFromChileDate(start.year, start.month, start.day, 0, 0),
        to: this.toUtcFromChileDate(end.year, end.month, end.day, 23, 59),
        label: `${this.toIsoDate(start)} a ${this.toIsoDate(end)} (Semana Chile Lun-Dom)`,
      };
    }

    const start = { year: base.year, month: base.month, day: 1 };
    const end = {
      year: base.year,
      month: base.month,
      day: new Date(base.year, base.month, 0).getDate(),
    };

    return {
      from: this.toUtcFromChileDate(start.year, start.month, start.day, 0, 0),
      to: this.toUtcFromChileDate(end.year, end.month, end.day, 23, 59),
      label: `${start.year}-${String(start.month).padStart(2, '0')} (Mes Chile)`,
    };
  }

  private buildMongoFilter(
    query: Required<AdminReportQuery>,
    range: DateRange,
  ): FilterQuery<Parking> {
    const filter: FilterQuery<Parking> = {
      $or: [
        { entryTime: { $gte: range.from, $lte: range.to } },
        { exitTime: { $gte: range.from, $lte: range.to } },
      ],
    };

    if (query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.paymentMethod !== 'all') {
      filter.paymentMethod = query.paymentMethod;
    }

    if (query.vehicleNumber) {
      filter.vehicleNumber = query.vehicleNumber;
    }

    return filter;
  }

  private fillDetailSheet(sheet: ExcelJS.Worksheet, rows: Parking[]): void {
    sheet.columns = [
      { header: 'Patente', key: 'vehicleNumber', width: 14 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Entrada', key: 'entryTime', width: 22 },
      { header: 'Salida', key: 'exitTime', width: 22 },
      { header: 'Minutos', key: 'minutes', width: 12 },
      { header: 'Tarifa/min', key: 'ratePerMinute', width: 12 },
      { header: 'Cobrado', key: 'amountPaid', width: 12 },
      { header: 'Deuda', key: 'outstandingAmount', width: 12 },
      { header: 'Método', key: 'paymentMethod', width: 14 },
      { header: 'Motivo evasión', key: 'evasionReasonCode', width: 22 },
      { header: 'Observación evasión', key: 'evasionObservation', width: 36 },
      { header: 'Ubicación', key: 'locationCode', width: 16 },
    ];

    for (const record of rows) {
      sheet.addRow({
        vehicleNumber: record.vehicleNumber,
        status: record.status,
        entryTime: this.formatDateTime(record.entryTime),
        exitTime: record.exitTime ? this.formatDateTime(record.exitTime) : '',
        minutes: record.totalMinutes ?? '',
        ratePerMinute: record.ratePerMinute ?? '',
        amountPaid: record.amountPaid ?? record.totalCost ?? 0,
        outstandingAmount: record.outstandingAmount ?? 0,
        paymentMethod: record.paymentMethod ?? '',
        evasionReasonCode: record.evasionReasonCode ?? '',
        evasionObservation: record.evasionObservation ?? '',
        locationCode: record.locationCode,
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private fillSummarySheet(
    sheet: ExcelJS.Worksheet,
    rows: Parking[],
    range: DateRange,
    query: Required<AdminReportQuery>,
  ): void {
    const completed = rows.filter((record) => record.status === 'completed');
    const evaded = rows.filter((record) => record.status === 'evaded');
    const active = rows.filter((record) => record.status === 'active');

    const totalRevenue = completed.reduce(
      (total, record) => total + (record.amountPaid ?? record.totalCost ?? 0),
      0,
    );
    const totalDebt = evaded.reduce(
      (total, record) => total + (record.outstandingAmount ?? record.totalCost ?? 0),
      0,
    );
    const billedMinutes = completed.reduce(
      (total, record) => total + (record.totalMinutes ?? 0),
      0,
    );

    const byPayment = {
      cash: 0,
      debit: 0,
      credit: 0,
      transfer: 0,
    };

    for (const record of completed) {
      if (record.paymentMethod && record.paymentMethod in byPayment) {
        byPayment[record.paymentMethod] +=
          record.amountPaid ?? record.totalCost ?? 0;
      }
    }

    const rowsData: Array<[string, string | number]> = [
      ['Rango aplicado', range.label],
      ['Preset', query.preset],
      ['Total movimientos', rows.length],
      ['Activos', active.length],
      ['Cobros completados', completed.length],
      ['Recaudación total', totalRevenue],
      ['Evasiones', evaded.length],
      ['Deuda por evasiones', totalDebt],
      ['Minutos cobrados', billedMinutes],
      ['Cobros en efectivo', byPayment.cash],
      ['Cobros con débito', byPayment.debit],
      ['Cobros con crédito', byPayment.credit],
      ['Cobros con transferencia', byPayment.transfer],
    ];

    sheet.columns = [
      { header: 'Métrica', key: 'metric', width: 34 },
      { header: 'Valor', key: 'value', width: 30 },
    ];

    rowsData.forEach(([metric, value]) => sheet.addRow({ metric, value }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
      timeZone: CL_TIME_ZONE,
    }).format(value);
  }

  private chileDateFromIso(isoDate: string): {
    year: number;
    month: number;
    day: number;
  } {
    const [year, month, day] = isoDate.split('-').map(Number);
    return { year, month, day };
  }

  private startOfWeekMonday(date: { year: number; month: number; day: number }) {
    const jsDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
    const day = jsDate.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    jsDate.setUTCDate(jsDate.getUTCDate() + diff);

    return {
      year: jsDate.getUTCFullYear(),
      month: jsDate.getUTCMonth() + 1,
      day: jsDate.getUTCDate(),
    };
  }

  private addDays(
    date: { year: number; month: number; day: number },
    amount: number,
  ) {
    const jsDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
    jsDate.setUTCDate(jsDate.getUTCDate() + amount);

    return {
      year: jsDate.getUTCFullYear(),
      month: jsDate.getUTCMonth() + 1,
      day: jsDate.getUTCDate(),
    };
  }

  private toIsoDate(date: { year: number; month: number; day: number }): string {
    return `${date.year}-${String(date.month).padStart(2, '0')}-${String(
      date.day,
    ).padStart(2, '0')}`;
  }

  private todayChileIso(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: CL_TIME_ZONE,
    });

    return formatter.format(new Date());
  }

  private toUtcFromChileDate(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
  ): Date {
    return this.toUtcFromChileLocal(
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0',
      )}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    );
  }

  private toUtcFromChileLocal(localIso: string): Date {
    const seedUtc = new Date(`${localIso}:00.000Z`);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: CL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const map = Object.fromEntries(
      formatter
        .formatToParts(seedUtc)
        .map((part) => [part.type, part.value]),
    );

    const localTotal =
      Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
      ) / 60_000;
    const seedTotal = seedUtc.getTime() / 60_000;
    const offset = localTotal - seedTotal;

    return new Date(seedUtc.getTime() - offset * 60_000);
  }
}
