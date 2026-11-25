import type { Database } from '../db/sqlite.ts';
import { STREAM_THRESHOLD_MS } from '../lib/units.ts';
import { aggregateTracks, dataRange, dropAggregate, MUSIC_ONLY } from './aggregate.ts';
import { dayKey, resolvePeriod, type PeriodSpec, type ResolvedPeriod } from './period.ts';

/**
 * Rankings of tracks, artists and albums for a period (docs/METRICS.md).
 * Built on the same per-track aggregate as the overview, so the numbers on
 * both screens always agree.
 */

export type RankingKind = 'tracks' | 'artists' | 'albums';
export type RankingSort = 'streams' | 'plays' | 'time';

export interface RankingQuery {
  readonly kind: RankingKind;
  readonly period: PeriodSpec;
  readonly sort: RankingSort;
  /** Maximum rows; null for all. */
  readonly limit: number | null;
}

export interface RankingRow {
  readonly rank: number;
  readonly id: number;
  readonly name: string;
  /** Artist of a track or album. */
  readonly artist: string | null;
  /** Album of a track. */
  readonly album: string | null;
  readonly streams: number;
  readonly registeredPlays: number;
  readonly msPlayed: number;
  /** Distinct tracks with plays in the period (artists and albums). */
  readonly distinctTracks: number | null;
  /** First and last play ever (any period), local ms. */
  readonly firstPlay: number;
  readonly lastPlay: number;
}

export interface Ranking {
  readonly period: ResolvedPeriod;
  readonly dataFirstDay: string;
  readonly dataLastDay: string;
  /** Items with at least one registered play in the period. */
  readonly total: number;
  readonly rows: readonly RankingRow[];
}

const ORDER: Record<RankingSort, string> = {
  streams: 'g.streams DESC, g.ms DESC',
  plays: 'g.registered DESC, g.ms DESC',
  time: 'g.ms DESC, g.streams DESC',
};

const SHAPE: Record<
  RankingKind,
  { column: string; nameExpr: string; select: string; join: string; lifetime: string }
> = {
  tracks: {
    column: 'track_id',
    nameExpr: 't.name',
    select: 't.name AS name, a.name AS artist, al.name AS album, NULL AS distinct_tracks',
    join: `JOIN tracks t ON t.id = g.id JOIN artists a ON a.id = t.artist_id
           LEFT JOIN albums al ON al.id = t.album_id`,
    lifetime: 'p.track_id',
  },
  artists: {
    column: 'artist_id',
    nameExpr: 'a.name',
    select: 'a.name AS name, NULL AS artist, NULL AS album, g.tracks AS distinct_tracks',
    join: 'JOIN artists a ON a.id = g.id',
    lifetime: 't.artist_id',
  },
  albums: {
    column: 'album_id',
    nameExpr: 'al.name',
    select: 'al.name AS name, a.name AS artist, NULL AS album, g.tracks AS distinct_tracks',
    join: 'JOIN albums al ON al.id = g.id JOIN artists a ON a.id = al.artist_id',
    lifetime: 't.album_id',
  },
};

const str = (v: unknown) => (typeof v === 'string' ? v : null);

export function ranking(db: Database, query: RankingQuery): Ranking | null {
  const range = dataRange(db);
  if (!range) return null;
  const period = resolvePeriod(query.period, range);
  if (!period) return null;
  const shape = SHAPE[query.kind];

  aggregateTracks(db, period.from, period.to);
  try {
    db.exec('DROP TABLE IF EXISTS temp.rk');
    db.exec(`CREATE TEMP TABLE rk AS
      SELECT ROW_NUMBER() OVER (ORDER BY ${ORDER[query.sort]}, ${shape.nameExpr} COLLATE NOCASE, g.id) AS rank,
             g.id, ${shape.select}, g.streams, g.registered, g.ms
      FROM (SELECT ${shape.column} AS id, SUM(streams) AS streams,
                   SUM(registered) AS registered, SUM(ms) AS ms, COUNT(*) AS tracks
            FROM temp.tg WHERE ${shape.column} IS NOT NULL
            GROUP BY ${shape.column}) AS g
      ${shape.join}`);

    const total = Number(db.selectValue('SELECT COUNT(*) FROM temp.rk') ?? 0);
    const limit = query.limit === null ? -1 : Math.max(1, query.limit);
    const rows = db.selectObjects(
      `WITH top AS (SELECT * FROM temp.rk ORDER BY rank LIMIT ?),
            life AS (
              SELECT ${shape.lifetime} AS id, MIN(p.local_end) AS first, MAX(p.local_end) AS last
              FROM plays p JOIN tracks t ON t.id = p.track_id
              WHERE p.ms_played > 0 AND ${MUSIC_ONLY} AND ${shape.lifetime} IN (SELECT id FROM top)
              GROUP BY ${shape.lifetime})
       SELECT top.*, life.first, life.last FROM top JOIN life ON life.id = top.id
       ORDER BY top.rank`,
      [limit],
    );

    return {
      period,
      dataFirstDay: dayKey(range.first),
      dataLastDay: dayKey(range.last),
      total,
      rows: rows.map((r) => ({
        rank: Number(r['rank']),
        id: Number(r['id']),
        name: str(r['name']) ?? '',
        artist: str(r['artist']),
        album: str(r['album']),
        streams: Number(r['streams']),
        registeredPlays: Number(r['registered']),
        msPlayed: Number(r['ms']),
        distinctTracks: r['distinct_tracks'] === null ? null : Number(r['distinct_tracks']),
        firstPlay: Number(r['first']),
        lastPlay: Number(r['last']),
      })),
    };
  } finally {
    db.exec('DROP TABLE IF EXISTS temp.rk');
    dropAggregate(db);
  }
}

export interface AlbumTrack {
  readonly id: number;
  readonly name: string;
  readonly streams: number;
  readonly msPlayed: number;
}

/** Most played tracks of an album in a period, by streams then time. */
export function albumTopTracks(
  db: Database,
  albumId: number,
  spec: PeriodSpec,
  limit = 5,
): AlbumTrack[] {
  const range = dataRange(db);
  const period = range ? resolvePeriod(spec, range) : null;
  if (!period) return [];
  return db
    .selectObjects(
      `SELECT t.id, t.name, SUM(p.ms_played >= ${STREAM_THRESHOLD_MS}) AS streams, SUM(p.ms_played) AS ms
       FROM plays p JOIN tracks t ON t.id = p.track_id
       WHERE t.album_id = ? AND t.kind = 'track' AND p.ms_played > 0
         AND p.local_end >= ? AND p.local_end < ?
       GROUP BY t.id
       ORDER BY streams DESC, ms DESC, t.name COLLATE NOCASE
       LIMIT ?`,
      [albumId, period.from, period.to, limit],
    )
    .map((r) => ({
      id: Number(r['id']),
      name: str(r['name']) ?? '',
      streams: Number(r['streams']),
      msPlayed: Number(r['ms']),
    }));
}
