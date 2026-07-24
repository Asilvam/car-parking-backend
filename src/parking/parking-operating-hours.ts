export const SANTIAGO_TIME_ZONE = 'America/Santiago';

export type ParsedTime = {
  hours: number;
  minutes: number;
  totalMinutes: number;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function asChileDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SANTIAGO_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function toUtcFromChileLocal(localIso: string): Date {
  const seedUtc = new Date(`${localIso}:00.000Z`);
  const localParts = asChileDateParts(seedUtc);
  const localTotal =
    Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
    ) / 60_000;
  const seedTotal = seedUtc.getTime() / 60_000;
  const offsetMinutes = localTotal - seedTotal;

  return new Date(seedUtc.getTime() - offsetMinutes * 60_000);
}

export function parseTimeOrThrow(value: string, name: string): ParsedTime {
  const trimmed = value.trim();
  const matched = TIME_PATTERN.exec(trimmed);

  if (!matched) {
    throw new Error(`${name} debe usar formato HH:mm (24 horas)`);
  }

  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);

  return {
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
  };
}

export function isWithinOperatingHours(
  now: Date,
  openTime: string,
  closeTime: string,
): boolean {
  const open = parseTimeOrThrow(openTime, 'PARKING_OPEN_TIME');
  const close = parseTimeOrThrow(closeTime, 'PARKING_CLOSE_TIME');
  const local = asChileDateParts(now);
  const currentMinutes = local.hour * 60 + local.minute;

  return currentMinutes >= open.totalMinutes && currentMinutes < close.totalMinutes;
}

export function getChileDateKey(now: Date): string {
  const local = asChileDateParts(now);
  return `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
}

export function getChileDayCutoffUtc(now: Date, cutoffTime: string): Date {
  parseTimeOrThrow(cutoffTime, 'PARKING_CLOSE_TIME');
  const day = getChileDateKey(now);
  return toUtcFromChileLocal(`${day}T${cutoffTime}`);
}

export function getChileLocalTimeLabel(now: Date): string {
  const local = asChileDateParts(now);
  return `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
}
