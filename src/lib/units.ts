/**
 * Play definitions and time units (docs/PLANNING.md §4).
 *
 * These are fixed constants, not user settings, so every statistic is
 * reproducible from the same input files.
 */

export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Minimum playback for a record to count as a stream. */
export const STREAM_THRESHOLD_MS = 30 * MS_PER_SECOND;

function assertValidMsPlayed(msPlayed: number): void {
  if (!Number.isFinite(msPlayed) || msPlayed < 0) {
    throw new RangeError(`ms_played must be a finite, non-negative number (got ${msPlayed})`);
  }
}

/** A registered play: any valid music record with some playback. */
export function isRegisteredPlay(msPlayed: number): boolean {
  assertValidMsPlayed(msPlayed);
  return msPlayed > 0;
}

/** A stream: a record played for at least {@link STREAM_THRESHOLD_MS}. */
export function isStream(msPlayed: number): boolean {
  assertValidMsPlayed(msPlayed);
  return msPlayed >= STREAM_THRESHOLD_MS;
}

export function msToMinutes(ms: number): number {
  return ms / MS_PER_MINUTE;
}

export function msToHours(ms: number): number {
  return ms / MS_PER_HOUR;
}

/** Equivalent days of continuous listening (not calendar days). */
export function msToDays(ms: number): number {
  return ms / MS_PER_DAY;
}
