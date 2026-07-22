export const EVASION_REASON_CODES = [
  'left-without-payment',
  'payment-refused',
  'operator-record-correction',
  'unknown',
  'other',
] as const;

export type EvasionReasonCode = (typeof EVASION_REASON_CODES)[number];
