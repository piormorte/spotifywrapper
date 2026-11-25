import type { Database } from '../db/sqlite.ts';
import { MS_PER_DAY, MS_PER_HOUR, STREAM_THRESHOLD_MS } from '../lib/units.ts';
import {
  bucketKey,
  dayKey,
  bucketKeys,
  resolvePeriod,
  type DataRange,
  type PeriodSpec,
  type ResolvedPeriod,
} from './period.ts';

/**
 * Overview statistics for one period (docs/METRICS.md). Music only
 * (tracks.kind = 'track'); podcasts and audiobooks never count.
 *
 * Every figure says what it measures: registered plays (ms_played > 0),
 * streams (ms_played >= 30 s) or listening time (sum of ms_played).
 */

export interface RankedEntry {
  readonly id: number;
  readonly name: string;
  /** Artist, for tracks and albums. */
  readonly artist: string | null;
  readonly streams: number;
  readonly registeredPlays: number;
  readonly msPlayed: number;
}

export interface SeriesPoint {
  readonly key: string;
  readonly msPlayed: number;
}

export interface Overview {
  readonly period: ResolvedPeriod;
  /** First and last local days with music data ("YYYY-MM-DD"). */
  readonly dataFirstDay: string;
  readonly dataLastDay: string;
  readonly msPlayed: number;
  readonly registeredPlays: number;
  readonly streams: number;
  readonly distinctTracks: number;
  readonly distinctArtists: number;
  readonly distinctAlbums: number;
  /** Days in the period with any listening time. */
  readonly listeningDays: number;
  /** Listening time ÷ calendar days in the period. */
  readonly dailyAverageMs: number;
  readonly topArtists: readonly RankedEntry[];
  readonly topTracks: readonly RankedEntry[];
  readonly topAlbums: readonly RankedEntry[];
  /** Local day with the most listening time; earliest on ties. */
  readonly peakDay: { readonly day: string; readonly msPlayed: number } | null;
  /** Listening time per bucket, zero-filled. */
  readonly series: readonly SeriesPoint[];
  /** Listening time per local hour of day (0–23). */
  readonly hours: readonly number[];
}

/** First and last music play in local ms, or null with no music data. */
export function dataRange(db: Database): DataRange | null {
  // Walks the local_end index from each end; stops at the first music play.
  const edge = (order: 'ASC' | 'DESC') =>
    db.selectValue(
      `SELECT p.local_end FROM plays p JOIN tracks t ON t.id = p.track_id
       WHERE t.kind = 'track' AND p.ms_played > 0 AND p.local_end IS NOT NULL
       ORDER BY p.local_end ${order} LIMIT 1`,
    );
  const first = edge('ASC');
  const last = edge('DESC');
  if (first === undefined || first === null || last === undefined || last === null) return null;
  return { first: Number(first), last: Number(last) };
}

const TOP_LIMIT = 5;

/** Plays of music items only: excludes the (few) spoken-word catalog rows. */
const MUSIC_ONLY = `p.track_id NOT IN (SELECT id FROM tracks WHERE kind != 'track')`;

/**
 * Two passes over the period's plays, whatever its length:
 * 1. per-track totals into temp table `tg` (one row per track, with artist and
 *    album), from which totals, distinct counts and every ranking derive;
 * 2. listening time per local hour slot, from which days, the series, the
 *    peak day and the hour-of-day profile derive.
 */
function aggregateTracks(db: Database, from: number, to: number): void {
  db.exec('DROP TABLE IF EXISTS temp.tg');
  db.exec({
    sql: `CREATE TEMP TABLE tg AS
          SELECT a.track_id, t.artist_id, t.album_id, a.streams, a.registered, a.ms
          FROM (SELECT p.track_id, SUM(p.ms_played >= ?) AS streams,
                       COUNT(*) AS registered, SUM(p.ms_played) AS ms
                FROM plays p
                WHERE p.ms_played > 0 AND p.local_end >= ? AND p.local_end < ?
                  AND ${MUSIC_ONLY}
                GROUP BY p.track_id) AS a
          JOIN tracks t ON t.id = a.track_id`,
    bind: [STREAM_THRESHOLD_MS, from, to],
  });
}

/** Candidates fetched before name tie-breaking; ties beyond this are not realistic. */
const CANDIDATES = 50;

function ranked(
  db: Database,
  groupColumn: 'track_id' | 'artist_id' | 'album_id',
  select: string,
  join: string,
): RankedEntry[] {
  return db
    .selectObjects(
      `SELECT g.id, ${select}, g.streams, g.registered, g.ms
       FROM (SELECT ${groupColumn} AS id, SUM(streams) AS streams,
                    SUM(registered) AS registered, SUM(ms) AS ms
             FROM temp.tg WHERE ${groupColumn} IS NOT NULL
             GROUP BY ${groupColumn}
             ORDER BY streams DESC, ms DESC
             LIMIT ${CANDIDATES}) AS g
       ${join}
       ORDER BY g.streams DESC, g.ms DESC, name COLLATE NOCASE ASC
       LIMIT ${TOP_LIMIT}`,
    )
    .map((r) => ({
      id: Number(r['id']),
      name: typeof r['name'] === 'string' ? r['name'] : '',
      artist: typeof r['artist'] === 'string' ? r['artist'] : null,
      streams: Number(r['streams']),
      registeredPlays: Number(r['registered']),
      msPlayed: Number(r['ms']),
    }));
}

export function overview(db: Database, spec: PeriodSpec): Overview | null {
  const range = dataRange(db);
  if (!range) return null;
  const period = resolvePeriod(spec, range);
  if (!period) return null;

  aggregateTracks(db, period.from, period.to);
  try {
    const totals = db.selectObject(
      `SELECT COALESCE(SUM(ms), 0) AS ms,
              COALESCE(SUM(registered), 0) AS registered,
              COALESCE(SUM(streams), 0) AS streams,
              COUNT(*) AS tracks,
              COUNT(DISTINCT artist_id) AS artists,
              COUNT(DISTINCT album_id) AS albums
       FROM temp.tg`,
    );
    const msPlayed = Number(totals?.['ms'] ?? 0);

    const slots = db.selectArrays(
      `SELECT p.local_end / ${MS_PER_HOUR} AS slot, SUM(p.ms_played)
       FROM plays p
       WHERE p.ms_played > 0 AND p.local_end >= ? AND p.local_end < ? AND ${MUSIC_ONLY}
       GROUP BY slot ORDER BY slot`,
      [period.from, period.to],
    );
    const hours = new Array<number>(24).fill(0);
    const days = new Map<number, number>();
    for (const [slot, ms] of slots) {
      const value = Number(ms);
      const hourIndex = Number(slot);
      hours[hourIndex % 24] = (hours[hourIndex % 24] ?? 0) + value;
      const day = Math.floor(hourIndex / 24);
      days.set(day, (days.get(day) ?? 0) + value);
    }

    let peakDay: Overview['peakDay'] = null;
    const buckets = new Map(bucketKeys(period).map((k) => [k, 0]));
    for (const [day, value] of days) {
      const dayMs = day * MS_PER_DAY;
      if (!peakDay || value > peakDay.msPlayed) {
        peakDay = { day: bucketKey(dayMs, 'day'), msPlayed: value };
      }
      const key = bucketKey(dayMs, period.granularity);
      buckets.set(key, (buckets.get(key) ?? 0) + value);
    }

    return {
      period,
      dataFirstDay: dayKey(range.first),
      dataLastDay: dayKey(range.last),
      msPlayed,
      registeredPlays: Number(totals?.['registered'] ?? 0),
      streams: Number(totals?.['streams'] ?? 0),
      distinctTracks: Number(totals?.['tracks'] ?? 0),
      distinctArtists: Number(totals?.['artists'] ?? 0),
      distinctAlbums: Number(totals?.['albums'] ?? 0),
      listeningDays: days.size,
      dailyAverageMs: msPlayed / period.days,
      topArtists: ranked(
        db,
        'artist_id',
        'a.name AS name, NULL AS artist',
        'JOIN artists a ON a.id = g.id',
      ),
      topTracks: ranked(
        db,
        'track_id',
        't.name AS name, a.name AS artist',
        'JOIN tracks t ON t.id = g.id JOIN artists a ON a.id = t.artist_id',
      ),
      topAlbums: ranked(
        db,
        'album_id',
        'al.name AS name, a.name AS artist',
        'JOIN albums al ON al.id = g.id JOIN artists a ON a.id = al.artist_id',
      ),
      peakDay,
      series: [...buckets].map(([key, ms]) => ({ key, msPlayed: ms })),
      hours,
    };
  } finally {
    db.exec('DROP TABLE IF EXISTS temp.tg');
  }
}
