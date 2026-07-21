export const SANTIAGO_TIME_ZONE = 'America/Santiago';

const santiagoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SANTIAGO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function formatSantiagoTime(date: Date = new Date()): string {
  const parts = Object.fromEntries(
    santiagoFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );

  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
