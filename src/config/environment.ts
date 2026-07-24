type Environment = Record<string, unknown>;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTimeMinutes(value: unknown, name: string): number {
  const normalized = String(value ?? '').trim();
  const matched = TIME_PATTERN.exec(normalized);

  if (!matched) {
    throw new Error(`${name} es obligatorio y debe usar formato HH:mm`);
  }

  return Number(matched[1]) * 60 + Number(matched[2]);
}

export function validateEnvironment(environment: Environment): Environment {
  const ratePerMinute = Number(environment.RATE_PER_MINUTE);
  const locationCode = String(environment.PARKING_LOCATION_CODE ?? '')
    .trim()
    .toUpperCase();
  const locationName = String(environment.PARKING_LOCATION_NAME ?? '').trim();
  const openTime = String(environment.PARKING_OPEN_TIME ?? '').trim();
  const closeTime = String(environment.PARKING_CLOSE_TIME ?? '').trim();
  const autoEvasionTime = String(environment.PARKING_AUTO_EVASION_TIME ?? '').trim();
  const adminPassword = String(environment.ADMIN_PANEL_PASSWORD ?? '').trim();

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

  const openMinutes = parseTimeMinutes(openTime, 'PARKING_OPEN_TIME');
  const closeMinutes = parseTimeMinutes(closeTime, 'PARKING_CLOSE_TIME');
  const autoEvasionMinutes = parseTimeMinutes(
    autoEvasionTime,
    'PARKING_AUTO_EVASION_TIME',
  );

  if (openMinutes >= closeMinutes) {
    throw new Error(
      'PARKING_OPEN_TIME debe ser menor que PARKING_CLOSE_TIME',
    );
  }

  if (closeMinutes >= autoEvasionMinutes) {
    throw new Error(
      'PARKING_CLOSE_TIME debe ser menor que PARKING_AUTO_EVASION_TIME',
    );
  }

  if (!adminPassword) {
    throw new Error('ADMIN_PANEL_PASSWORD es obligatorio');
  }

  return {
    ...environment,
    RATE_PER_MINUTE: ratePerMinute,
    PARKING_LOCATION_CODE: locationCode,
    PARKING_LOCATION_NAME: locationName,
    PARKING_OPEN_TIME: openTime,
    PARKING_CLOSE_TIME: closeTime,
    PARKING_AUTO_EVASION_TIME: autoEvasionTime,
    ADMIN_PANEL_PASSWORD: adminPassword,
  };
}
