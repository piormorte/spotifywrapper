import type { Database } from '../db/sqlite.ts';
import { MUSIC_ONLY, aggregateTracks, dataRange, dropAggregate } from './aggregate.ts';
import { MS_PER_DAY, MS_PER_HOUR } from '../lib/units.ts';
import {
  bucketKey,
  dayKey,
  bucketKeys,
  resolvePeriod,
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
  /** Album, for tracks (null when the export has none). */
  readonly album: string | null;
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

const TOP_LIMIT = 5;
/** Albums get a longer list: the overview shows them as a cover grid. */
export const TOP_ALBUMS_LIMIT = 10;

/** Candidates fetched before name tie-breaking; ties beyond this are not realistic. */
const CANDIDATES = 50;

function ranked(
  db: Database,
  groupColumn: 'track_id' | 'artist_id' | 'album_id',
  select: string,
  join: string,
  limit = TOP_LIMIT,
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
       LIMIT ${String(limit)}`,
    )
    .map((r) => ({
      id: Number(r['id']),
      name: typeof r['name'] === 'string' ? r['name'] : '',
      artist: typeof r['artist'] === 'string' ? r['artist'] : null,
      album: typeof r['album'] === 'string' ? r['album'] : null,
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
        't.name AS name, a.name AS artist, al.name AS album',
        `JOIN tracks t ON t.id = g.id JOIN artists a ON a.id = t.artist_id
         LEFT JOIN albums al ON al.id = t.album_id`,
      ),
      topAlbums: ranked(
        db,
        'album_id',
        'al.name AS name, a.name AS artist',
        'JOIN albums al ON al.id = g.id JOIN artists a ON a.id = al.artist_id',
        TOP_ALBUMS_LIMIT,
      ),
      peakDay,
      series: [...buckets].map(([key, ms]) => ({ key, msPlayed: ms })),
      hours,
    };
  } finally {
    dropAggregate(db);
  }
}
