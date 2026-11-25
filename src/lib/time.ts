/**
 * Time-zone helpers built on Intl only (no dependency).
 *
 * Offsets are cached per UTC hour, so converting hundreds of thousands of
 * timestamps costs one Intl call per distinct hour, not per record.
 */

import { MS_PER_HOUR } from './units.ts';

const formatters = new Map<string, Intl.DateTimeFormat>();
const offsetCache = new Map<string, Map<number, number>>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** True when `timeZone` is a valid IANA zone for this runtime. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` from UTC at instant `utcMs`, in milliseconds (local − UTC). */
export function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const hour = Math.floor(utcMs / MS_PER_HOUR);
  let perZone = offsetCache.get(timeZone);
  if (!perZone) {
    perZone = new Map();
    offsetCache.set(timeZone, perZone);
  }
  const cached = perZone.get(hour);
  if (cached !== undefined) return cached;

  const parts: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(hour * MS_PER_HOUR))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    parts['year'] ?? 1970,
    (parts['month'] ?? 1) - 1,
    parts['day'] ?? 1,
    parts['hour'] ?? 0,
    parts['minute'] ?? 0,
    parts['second'] ?? 0,
  );
  const offset = asUtc - hour * MS_PER_HOUR;
  perZone.set(hour, offset);
  return offset;
}

export interface LocalDateTime {
  readonly year: number;
  readonly month: number; // 1–12
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/**
 * Converts a wall-clock time in `timeZone` to a UTC instant, following the
 * "compatible" rule used by Temporal: a repeated time (DST fall-back) resolves
 * to the earlier instant; a skipped time (DST spring-forward) is shifted
 * forward by the length of the gap.
 */
export function zonedTimeToUtc(local: LocalDateTime, timeZone: string): number {
  const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const DAY = 24 * MS_PER_HOUR;
  const offsetBefore = timeZoneOffsetMs(wall - DAY, timeZone);
  const offsetAfter = timeZoneOffsetMs(wall + DAY, timeZone);
  const candidates = [wall - offsetBefore, wall - offsetAfter].filter(
    (t) => t + timeZoneOffsetMs(t, timeZone) === wall,
  );
  if (candidates.length > 0) return Math.min(...candidates);
  return wall - offsetBefore;
}

/**
 * Wall-clock time of instant `utcMs` in `timeZone`, encoded as UTC epoch ms
 * ("local ms"). Used for every local-time statistic.
 */
export function toLocalMs(utcMs: number, timeZone: string): number {
  return utcMs + timeZoneOffsetMs(utcMs, timeZone);
}

/** Calendar day key ("YYYY-MM-DD") of instant `utcMs` in `timeZone`. */
export function localDayKey(utcMs: number, timeZone: string): string {
  const local = new Date(utcMs + timeZoneOffsetMs(utcMs, timeZone));
  return local.toISOString().slice(0, 10);
}

/** Hour of day (0–23) of instant `utcMs` in `timeZone`. */
export function localHour(utcMs: number, timeZone: string): number {
  return new Date(utcMs + timeZoneOffsetMs(utcMs, timeZone)).getUTCHours();
}

/** The device time zone, falling back to UTC. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
