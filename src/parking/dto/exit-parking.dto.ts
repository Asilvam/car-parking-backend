export const PAYMENT_METHODS = [
  'cash',
  'debit',
  'credit',
  'transfer',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export class ExitParkingDto {
  vehicleNumber: string;
  paymentMethod?: PaymentMethod;
  applyPurchaseDiscount?: boolean;
}
