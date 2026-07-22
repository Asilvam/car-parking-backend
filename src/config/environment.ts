type Environment = Record<string, unknown>;

export function validateEnvironment(environment: Environment): Environment {
  const ratePerMinute = Number(environment.RATE_PER_MINUTE);
  const locationCode = String(environment.PARKING_LOCATION_CODE ?? '')
    .trim()
    .toUpperCase();
  const locationName = String(environment.PARKING_LOCATION_NAME ?? '').trim();

  if (!Number.isFinite(ratePerMinute) || ratePerMinute <= 0) {
    throw new Error(
      'RATE_PER_MINUTE es obligatoria y debe ser un número mayor que cero',
    );
  }

  if (!/^[A-Z0-9_-]{2,32}$/.test(locationCode)) {
    throw new Error(
      'PARKING_LOCATION_CODE es obligatorio y solo admite letras, números, guion y guion bajo',
    );
  }

  if (!locationName) {
    throw new Error('PARKING_LOCATION_NAME es obligatorio');
  }

  return {
    ...environment,
    RATE_PER_MINUTE: ratePerMinute,
    PARKING_LOCATION_CODE: locationCode,
    PARKING_LOCATION_NAME: locationName,
  };
}
