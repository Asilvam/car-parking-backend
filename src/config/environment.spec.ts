import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  const validEnvironment = {
    RATE_PER_MINUTE: '45',
    PARKING_LOCATION_CODE: 'main',
    PARKING_LOCATION_NAME: 'Estacionamiento principal',
    PARKING_OPEN_TIME: '08:00',
    PARKING_CLOSE_TIME: '20:00',
    PARKING_AUTO_EVASION_TIME: '21:00',
  };

  it('convierte RATE_PER_MINUTE a número', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      RATE_PER_MINUTE: 45,
      PARKING_LOCATION_CODE: 'MAIN',
    });
  });

  it.each([undefined, '', 'no-es-numero', '0', '-10'])(
    'rechaza una tarifa inválida: %s',
    (ratePerMinute) => {
      expect(() =>
        validateEnvironment({
          ...validEnvironment,
          RATE_PER_MINUTE: ratePerMinute,
        }),
      ).toThrow('RATE_PER_MINUTE');
    },
  );

  it('exige código y nombre del lugar', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PARKING_LOCATION_CODE: '',
      }),
    ).toThrow('PARKING_LOCATION_CODE');

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PARKING_LOCATION_NAME: '',
      }),
      ).toThrow('PARKING_LOCATION_NAME');
  });

  it('acepta horarios válidos en formato HH:mm', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      PARKING_OPEN_TIME: '08:00',
      PARKING_CLOSE_TIME: '20:00',
      PARKING_AUTO_EVASION_TIME: '21:00',
    });
  });

  it.each([
    ['PARKING_OPEN_TIME', '8:00'],
    ['PARKING_CLOSE_TIME', '20'],
    ['PARKING_AUTO_EVASION_TIME', '25:00'],
  ])('rechaza horario inválido %s=%s', (field, value) => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        [field]: value,
      }),
    ).toThrow(field);
  });

  it('exige que apertura sea antes de cierre y cierre antes de auto evasión', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PARKING_OPEN_TIME: '20:00',
        PARKING_CLOSE_TIME: '08:00',
      }),
    ).toThrow('PARKING_OPEN_TIME');

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PARKING_CLOSE_TIME: '21:00',
        PARKING_AUTO_EVASION_TIME: '21:00',
      }),
    ).toThrow('PARKING_CLOSE_TIME');
  });
});
