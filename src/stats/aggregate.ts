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
