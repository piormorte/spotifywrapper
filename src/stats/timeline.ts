import type { Database } from '../db/sqlite.ts';
import { MS_PER_DAY, MS_PER_HOUR, STREAM_THRESHOLD_MS } from '../lib/units.ts';
import { dataRange, MUSIC_ONLY } from './aggregate.ts';
import { overview, type Overview } from './overview.ts';
import {
  bucketKey,
  bucketKeysBetween,
  dayKey,
  resolvePeriod,
  weekday,
  type Granularity,
  type PeriodSpec,
  type ResolvedPeriod,
} from './period.ts';

/**
 * Listening over time (docs/METRICS.md, "Linha do tempo"). Music only; all
 * days and hours are local (plays.local_end).
 */

export interface ActivityPoint {
  readonly key: string;
  readonly msPlayed: number;
  readonly streams: number;
  readonly registeredPlays: number;
}

export interface Timeline {
  readonly period: ResolvedPeriod;
  readonly dataFirstDay: string;
  readonly dataLastDay: string;
  readonly granularity: Granularity;
  /** Zero-filled series at `granularity`. */
  readonly activity: readonly ActivityPoint[];
  /** Listening time by weekday (Monday = 0) × local hour: heatmap[weekday][hour]. */
  readonly heatmap: readonly (readonly number[])[];
}

/** Daily granularity is offered for periods up to two years. */
export const MAX_DAILY_DAYS = 731;

export function timeline(
  db: Database,
  spec: PeriodSpec,
  granularity: Granularity | null,
): Timeline | null {
  const range = dataRange(db);
  if (!range) return null;
  const period = resolvePeriod(spec, range);
  if (!period) return null;
  const g =
    granularity === 'day' && period.days > MAX_DAILY_DAYS
      ? 'week'
      : (granularity ?? period.granularity);

  const points = new Map<string, { ms: number; streams: number; registered: number }>(
    bucketKeysBetween(period.from, period.to, g).map((k) => [
      k,
      { ms: 0, streams: 0, registered: 0 },
    ]),
  );
  const heatmap = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

  // One pass, grouped by local hour slot: everything else derives from it.
  for (const [slot, ms, streams, registered] of db.selectArrays(
    `SELECT p.local_end / ${MS_PER_HOUR} AS slot, SUM(p.ms_played),
            SUM(p.ms_played >= ${STREAM_THRESHOLD_MS}), COUNT(*)
     FROM plays p
     WHERE p.ms_played > 0 AND p.local_end >= ? AND p.local_end < ? AND ${MUSIC_ONLY}
     GROUP BY slot`,
    [period.from, period.to],
  )) {
    const start = Number(slot) * MS_PER_HOUR;
    const bucket = points.get(bucketKey(start, g));
    if (bucket) {
      bucket.ms += Number(ms);
      bucket.streams += Number(streams);
      bucket.registered += Number(registered);
    }
    const row = heatmap[weekday(start)];
    const hour = Math.floor((start % MS_PER_DAY) / MS_PER_HOUR);
    if (row) row[hour] = (row[hour] ?? 0) + Number(ms);
  }

  return {
    period,
    dataFirstDay: dayKey(range.first),
    dataLastDay: dayKey(range.last),
    granularity: g,
    activity: [...points].map(([key, v]) => ({
      key,
      msPlayed: v.ms,
      streams: v.streams,
      registeredPlays: v.registered,
    })),
    heatmap,
  };
}

export interface YearLeader {
  readonly year: number;
  readonly artistId: number;
  readonly artist: string;
  readonly streams: number;
  readonly msPlayed: number;
  /** Share of that year's streams. */
  readonly share: number;
}

/**
 * The artist with the most streams in each calendar year with data
 * (ties: listening time, then name).
 */
export function dominantArtists(db: Database): YearLeader[] {
  return db
    .selectObjects(
      `WITH ya AS (
         SELECT CAST(strftime('%Y', p.local_end / 1000, 'unixepoch') AS INTEGER) AS year,
                t.artist_id, SUM(p.ms_played >= ${STREAM_THRESHOLD_MS}) AS streams,
                SUM(p.ms_played) AS ms
         FROM plays p JOIN tracks t ON t.id = p.track_id
         WHERE t.kind = 'track' AND p.ms_played > 0
         GROUP BY year, t.artist_id),
       ranked AS (
         SELECT ya.*, a.name,
                SUM(ya.streams) OVER (PARTITION BY ya.year) AS year_streams,
                ROW_NUMBER() OVER (PARTITION BY ya.year
                                   ORDER BY ya.streams DESC, ya.ms DESC, a.name COLLATE NOCASE) AS rn
         FROM ya JOIN artists a ON a.id = ya.artist_id)
       SELECT year, artist_id, name, streams, ms, year_streams
       FROM ranked WHERE rn = 1 ORDER BY year`,
    )
    .map((r) => {
      const yearStreams = Number(r['year_streams']);
      return {
        year: Number(r['year']),
        artistId: Number(r['artist_id']),
        artist: typeof r['name'] === 'string' ? r['name'] : '',
        streams: Number(r['streams']),
        msPlayed: Number(r['ms']),
        share: yearStreams > 0 ? Number(r['streams']) / yearStreams : 0,
      };
    });
}

/** Calendar years with music data, ascending. */
export function yearsWithData(db: Database): number[] {
  const range = dataRange(db);
  if (!range) return [];
  const first = new Date(range.first).getUTCFullYear();
  const last = new Date(range.last).getUTCFullYear();
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export interface Comparison {
  readonly a: Overview;
  readonly b: Overview;
  /** Artists with registered plays in both periods / only in A / only in B. */
  readonly artists: { readonly shared: number; readonly onlyA: number; readonly onlyB: number };
}

/** Compares two periods with the overview figures plus artist overlap. */
export function compare(db: Database, a: PeriodSpec, b: PeriodSpec): Comparison | null {
  const left = overview(db, a);
  const right = overview(db, b);
  if (!left || !right) return null;
  const artistSet = (p: ResolvedPeriod) =>
    `SELECT DISTINCT t.artist_id FROM plays p JOIN tracks t ON t.id = p.track_id
     WHERE t.kind = 'track' AND p.ms_played > 0
       AND p.local_end >= ${String(p.from)} AND p.local_end < ${String(p.to)}`;
  const count = (sql: string) => Number(db.selectValue(`SELECT COUNT(*) FROM (${sql})`) ?? 0);
  const setA = artistSet(left.period);
  const setB = artistSet(right.period);
  return {
    a: left,
    b: right,
    artists: {
      shared: count(`${setA} INTERSECT ${setB}`),
      onlyA: count(`${setA} EXCEPT ${setB}`),
      onlyB: count(`${setB} EXCEPT ${setA}`),
    },
  };
}
