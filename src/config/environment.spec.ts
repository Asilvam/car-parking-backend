import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  const validEnvironment = {
    RATE_PER_MINUTE: '45',
    PARKING_LOCATION_CODE: 'main',
    PARKING_LOCATION_NAME: 'Estacionamiento principal',
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
});
