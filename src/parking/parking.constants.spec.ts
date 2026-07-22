import { EVASION_REASON_CODES } from './parking.constants';

describe('parking constants', () => {
  it('mantiene una lista controlada de motivos de evasión', () => {
    expect(EVASION_REASON_CODES).toEqual([
      'left-without-payment',
      'payment-refused',
      'operator-record-correction',
      'unknown',
      'other',
    ]);
  });
});
