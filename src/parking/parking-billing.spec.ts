import {
  calculateParkingCharge,
  normalizeVehicleNumber,
} from './parking-billing';

describe('parking billing', () => {
  it('normaliza una patente antes de guardarla', () => {
    expect(normalizeVehicleNumber('ab-cd 12')).toBe('ABCD12');
  });

  it('cobra como mínimo un minuto', () => {
    const entry = new Date('2026-07-21T12:00:00.000Z');
    const exit = new Date('2026-07-21T12:00:01.000Z');

    expect(calculateParkingCharge(entry, exit, 30)).toEqual({
      totalMinutes: 1,
      totalCost: 30,
    });
  });

  it('redondea cada fracción al minuto siguiente', () => {
    const entry = new Date('2026-07-21T12:00:00.000Z');
    const exit = new Date('2026-07-21T12:05:01.000Z');

    expect(calculateParkingCharge(entry, exit, 30)).toEqual({
      totalMinutes: 6,
      totalCost: 180,
    });
  });
});
