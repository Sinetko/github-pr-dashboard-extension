const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', YEAR],
  ['month', MONTH],
  ['week', WEEK],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
];

export const formatRelativeTime = (
  date: Date | string,
  now: Date = new Date(),
  locale = 'en',
): string => {
  const timestamp = typeof date === 'string' ? Date.parse(date) : date.getTime();
  if (Number.isNaN(timestamp)) {
    return '';
  }
  const deltaMilliseconds = timestamp - now.getTime();
  const absoluteDelta = Math.abs(deltaMilliseconds);
  if (absoluteDelta < MINUTE) {
    return 'just now';
  }
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (absoluteDelta >= size) {
      return formatter.format(Math.trunc(deltaMilliseconds / size), unit);
    }
  }
  return 'just now';
};

export const formatClockTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export const TIME = { MINUTE, HOUR, DAY, WEEK } as const;
