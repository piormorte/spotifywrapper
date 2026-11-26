import { MS_PER_DAY } from '../lib/units.ts';

/**
 * Periods are expressed in *local wall-clock milliseconds*: a local date-time
 * encoded as if it were UTC (see plays.local_end). Days are therefore always
 * exactly 24 h, and DST never shifts a play to another day.
 *
 * Presets end at the last day with data, not at today: exports always lag, and
 * "last 30 days" of an export from three weeks ago should not be mostly empty.
 * A preset never starts before the first day with data.
 */

export type PeriodPreset = 'all' | 'year' | '12m' | '6m' | '30d';

export type PeriodSpec =
  | { readonly preset: PeriodPreset }
  | { readonly preset: 'custom'; readonly start: string; readonly end: string };

export type Granularity = 'year' | 'month' | 'week' | 'day';

export interface ResolvedPeriod {
  /** Inclusive start (local ms, midnight). */
  readonly from: number;
  /** Exclusive end (local ms, midnight after the last day). */
  readonly to: number;
  /** Calendar days in the period. */
  readonly days: number;
  readonly granularity: Granularity;
}

export interface DataRange {
  /** Local ms of the first and last plays. */
  readonly first: number;
  readonly last: number;
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayStart(localMs: number): number {
  return Math.floor(localMs / MS_PER_DAY) * MS_PER_DAY;
}

export function dayKey(localMs: number): string {
  return new Date(dayStart(localMs)).toISOString().slice(0, 10);
}

/** Parses "YYYY-MM-DD" to local ms at midnight, or null when invalid. */
export function parseDayKey(key: string): number | null {
  const m = DAY_KEY.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d
    ? ms
    : null;
}

/** Same day-of-month `months` earlier/later, clamped to the month's length. */
export function addMonths(localMs: number, months: number): number {
  const d = new Date(localMs);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target.getTime();
}

export function granularityFor(days: number): Granularity {
  if (days > 2 * 366) return 'year';
  if (days > 62) return 'month';
  return 'day';
}

/** Resolves a period against the data range. Returns null for an invalid custom range. */
export function resolvePeriod(spec: PeriodSpec, range: DataRange): ResolvedPeriod | null {
  const firstDay = dayStart(range.first);
  const end = dayStart(range.last) + MS_PER_DAY;
  let from: number;
  let to = end;

  switch (spec.preset) {
    case 'all':
      from = firstDay;
      break;
    case 'year':
      from = Date.UTC(new Date(range.last).getUTCFullYear(), 0, 1);
      break;
    case '12m':
      from = addMonths(end, -12);
      break;
    case '6m':
      from = addMonths(end, -6);
      break;
    case '30d':
      from = end - 30 * MS_PER_DAY;
      break;
    case 'custom': {
      const start = parseDayKey(spec.start);
      const last = parseDayKey(spec.end);
      if (start === null || last === null || start > last) return null;
      from = start;
      to = last + MS_PER_DAY;
      break;
    }
  }

  if (spec.preset !== 'custom') from = Math.max(from, firstDay);
  const days = Math.round((to - from) / MS_PER_DAY);
  return { from, to, days, granularity: granularityFor(days) };
}

/** Monday (local ms, midnight) of the ISO week containing `localMs`. */
export function weekStart(localMs: number): number {
  const day = Math.floor(localMs / MS_PER_DAY);
  // 1970-01-01 was a Thursday: (day + 3) % 7 is 0 on Mondays.
  return (day - ((day + 3) % 7)) * MS_PER_DAY;
}

/** Day of week, Monday = 0 … Sunday = 6. */
export function weekday(localMs: number): number {
  return (Math.floor(localMs / MS_PER_DAY) + 3) % 7;
}

/**
 * Bucket key for a day at a granularity: "2024", "2024-03", "2024-03-04"
 * (the Monday of its week) or "2024-03-05".
 */
export function bucketKey(localMs: number, granularity: Granularity): string {
  if (granularity === 'week') return dayKey(weekStart(localMs));
  const key = dayKey(localMs);
  return granularity === 'year' ? key.slice(0, 4) : granularity === 'month' ? key.slice(0, 7) : key;
}

function nextBucket(cursor: number, granularity: Granularity): number {
  const d = new Date(cursor);
  switch (granularity) {
    case 'day':
      return cursor + MS_PER_DAY;
    case 'week':
      return weekStart(cursor) + 7 * MS_PER_DAY;
    case 'month':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    case 'year':
      return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  }
}

/** Every bucket key in [from, to), in order (for zero-filled series). */
export function bucketKeysBetween(from: number, to: number, granularity: Granularity): string[] {
  const keys: string[] = [];
  for (let cursor = from; cursor < to; cursor = nextBucket(cursor, granularity)) {
    keys.push(bucketKey(cursor, granularity));
  }
  return keys;
}

/** Every bucket key in the period at its own granularity. */
export function bucketKeys(period: ResolvedPeriod): string[] {
  return bucketKeysBetween(period.from, period.to, period.granularity);
}

/**
 * The window of the same length that ends where `period` starts, as a custom
 * spec, for "vs. período anterior" comparisons. Null when that window would
 * begin before the first day with data: a partially covered window would make
 * any comparison misleading.
 */
export function previousPeriod(period: ResolvedPeriod, dataFirstDay: string): PeriodSpec | null {
  const first = parseDayKey(dataFirstDay);
  if (first === null) return null;
  const from = period.from - period.days * MS_PER_DAY;
  if (from < first) return null;
  return { preset: 'custom', start: dayKey(from), end: dayKey(period.from - MS_PER_DAY) };
}
