import {
  getChileDayCutoffUtc,
  getChileLocalTimeLabel,
  isWithinOperatingHours,
  parseTimeOrThrow,
} from './parking-operating-hours';

describe('parking operating hours', () => {
  it('parsea horas válidas', () => {
    expect(parseTimeOrThrow('08:00', 'OPEN').totalMinutes).toBe(480);
    expect(parseTimeOrThrow('20:00', 'CLOSE').totalMinutes).toBe(1200);
  });

  it('rechaza formatos inválidos', () => {
    expect(() => parseTimeOrThrow('8:00', 'OPEN')).toThrow('OPEN');
    expect(() => parseTimeOrThrow('25:00', 'OPEN')).toThrow('OPEN');
  });

  it('valida ventana de operación en hora de Santiago', () => {
    expect(
      isWithinOperatingHours(new Date('2026-07-24T11:59:00.000Z'), '08:00', '20:00'),
    ).toBe(false);

    expect(
      isWithinOperatingHours(new Date('2026-07-24T12:00:00.000Z'), '08:00', '20:00'),
    ).toBe(true);

    expect(
      isWithinOperatingHours(new Date('2026-07-25T00:00:00.000Z'), '08:00', '20:00'),
    ).toBe(false);
  });

  it('calcula la fecha de corte UTC para las 20:00 en Santiago', () => {
    const cutoff = getChileDayCutoffUtc(
      new Date('2026-07-24T21:00:00.000Z'),
      '20:00',
    );
    expect(getChileLocalTimeLabel(cutoff)).toBe('20:00');
  });
});
