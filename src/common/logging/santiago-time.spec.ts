import { formatSantiagoTime, SANTIAGO_TIME_ZONE } from './santiago-time';

describe('Santiago log time', () => {
  it('usa UTC-4 durante el invierno chileno', () => {
    const utcTime = new Date('2026-07-21T12:30:45.000Z');

    expect(formatSantiagoTime(utcTime)).toBe('21-07-2026 08:30:45');
  });

  it('respeta automáticamente el horario de verano chileno', () => {
    const utcTime = new Date('2026-01-21T12:30:45.000Z');

    expect(formatSantiagoTime(utcTime)).toBe('21-01-2026 09:30:45');
  });

  it('declara America/Santiago como zona horaria única', () => {
    expect(SANTIAGO_TIME_ZONE).toBe('America/Santiago');
  });
});
