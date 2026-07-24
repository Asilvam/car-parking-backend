export type ReportPreset = 'day' | 'week' | 'month' | 'range';

export type ReportStatus = 'all' | 'active' | 'completed' | 'evaded';

export type ReportPaymentMethod = 'all' | 'cash' | 'debit' | 'credit' | 'transfer';

export type AdminReportQuery = {
  preset?: ReportPreset;
  date?: string;
  from?: string;
  to?: string;
  status?: ReportStatus;
  paymentMethod?: ReportPaymentMethod;
  vehicleNumber?: string;
};
