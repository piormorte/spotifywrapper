import type { Database } from '../db/sqlite.ts';
import { STREAM_THRESHOLD_MS } from '../lib/units.ts';
import type { DataRange } from './period.ts';

/** Building blocks shared by every statistic over a period. */

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

/** Plays of music items only: excludes the (few) spoken-word catalog rows. */
export const MUSIC_ONLY = `p.track_id NOT IN (SELECT id FROM tracks WHERE kind != 'track')`;

/**
 * Two passes over the period's plays, whatever its length:
 * 1. per-track totals into temp table `tg` (one row per track, with artist and
 *    album), from which totals, distinct counts and every ranking derive;
 * 2. listening time per local hour slot, from which days, the series, the
 *    peak day and the hour-of-day profile derive.
 */
export function aggregateTracks(db: Database, from: number, to: number): void {
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

/** Drops the per-track temp table created by aggregateTracks. */
export function dropAggregate(db: Database): void {
  db.exec('DROP TABLE IF EXISTS temp.tg');
}

/** One music play as streamed by scanPeriodPlays. */
export interface ScannedPlay {
  readonly tsEnd: number;
  readonly msPlayed: number;
  readonly localEnd: number;
  readonly trackId: number;
}

const SCAN_CHUNK_MS = 120 * 86_400_000;
/** Local time is UTC ± at most 14 h; widen the UTC window so no play is missed. */
const ZONE_MARGIN_MS = 2 * 86_400_000;

/**
 * Visits every music play with ms_played > 0 whose local end is in
 * [from, to), in a stable order (ts_end, track_id, ms_played — the unique
 * index, so SQLite never sorts). Rows cross into JavaScript as one JSON array
 * per 120-day chunk of ts_end: far cheaper than stepping row by row, with
 * memory bounded by the chunk.
 */
export function scanPeriodPlays(
  db: Database,
  from: number,
  to: number,
  visit: (play: ScannedPlay) => void,
): void {
  for (let start = from - ZONE_MARGIN_MS; start < to + ZONE_MARGIN_MS; start += SCAN_CHUNK_MS) {
    const json = db.selectValue(
      `SELECT json_group_array(json_array(ts_end, ms_played, local_end, track_id)) FROM (
         SELECT p.ts_end, p.ms_played, p.local_end, p.track_id FROM plays p
         WHERE p.ts_end >= ? AND p.ts_end < ?
           AND p.ms_played > 0 AND p.local_end >= ? AND p.local_end < ? AND ${MUSIC_ONLY}
         ORDER BY p.ts_end, p.track_id, p.ms_played)`,
      [start, Math.min(start + SCAN_CHUNK_MS, to + ZONE_MARGIN_MS), from, to],
    );
    if (typeof json !== 'string') continue;
    for (const [tsEnd, msPlayed, localEnd, trackId] of JSON.parse(json) as number[][]) {
      visit({
        tsEnd: tsEnd ?? 0,
        msPlayed: msPlayed ?? 0,
        localEnd: localEnd ?? 0,
        trackId: trackId ?? 0,
      });
    }
  }
}
