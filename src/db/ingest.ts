import { albumKey, artistKey, nameKey } from '../importer/normalize.ts';
import type { NormalizedPlay } from '../importer/types.ts';
import { asText, selectInt, type Database } from './sqlite.ts';

/**
 * Writes normalized plays into the catalog and plays tables.
 *
 * Identity rules (docs/PLANNING.md §5):
 * - Artists by normalized name; albums by artist + normalized title.
 * - Tracks by URI. A record without URI (local file, basic export) reuses an
 *   existing track with the same artist, title and kind, preferring one with a
 *   URI. When a URI record arrives for a track first seen without one, the
 *   existing row adopts the URI instead of creating a duplicate.
 * - Plays are unique on (ts_end, track_id, ms_played); re-imports are no-ops.
 */

export interface BatchResult {
  readonly inserted: number;
  readonly duplicates: number;
}

export class Ingestor {
  private readonly artistIds = new Map<string, number>();
  private readonly albumIds = new Map<string, number>();
  private readonly trackIds = new Map<string, number>();

  private readonly db: Database;
  private readonly toLocal: (utcMs: number) => number;

  /**
   * Loads the current catalog keys once, so lookups of known items never hit
   * SQLite. `toLocal` converts end times to local wall-clock ms (local_end).
   */
  constructor(db: Database, toLocal: (utcMs: number) => number) {
    this.db = db;
    this.toLocal = toLocal;
    for (const [key, id] of db.selectArrays('SELECT artist_key, id FROM artists')) {
      this.artistIds.set(asText(key), Number(id));
    }
    for (const [key, id] of db.selectArrays('SELECT album_key, id FROM albums')) {
      this.albumIds.set(asText(key), Number(id));
    }
    for (const [key, id] of db.selectArrays('SELECT track_key, id FROM tracks')) {
      this.trackIds.set(asText(key), Number(id));
    }
  }

  private artistId(name: string): number {
    const key = artistKey(name);
    const cached = this.artistIds.get(key);
    if (cached !== undefined) return cached;
    this.db.exec({
      sql: 'INSERT INTO artists (artist_key, name) VALUES (?, ?) ON CONFLICT (artist_key) DO NOTHING',
      bind: [key, name],
    });
    const id = selectInt(this.db, 'SELECT id FROM artists WHERE artist_key = ?', [key]);
    this.artistIds.set(key, id);
    return id;
  }

  private albumId(artistName: string, albumName: string, artistId: number): number {
    const key = albumKey(artistName, albumName);
    const cached = this.albumIds.get(key);
    if (cached !== undefined) return cached;
    this.db.exec({
      sql: 'INSERT INTO albums (album_key, name, artist_id) VALUES (?, ?, ?) ON CONFLICT (album_key) DO NOTHING',
      bind: [key, albumName, artistId],
    });
    const id = selectInt(this.db, 'SELECT id FROM albums WHERE album_key = ?', [key]);
    this.albumIds.set(key, id);
    return id;
  }

  private trackId(play: NormalizedPlay): number {
    const cached = this.trackIds.get(play.trackKey);
    if (cached !== undefined) return cached;

    const artistId = this.artistId(play.artistName);
    const albumId = play.albumName ? this.albumId(play.artistName, play.albumName, artistId) : null;
    const titleKey = nameKey(play.trackName);

    let id = selectInt(this.db, 'SELECT id FROM tracks WHERE track_key = ?', [play.trackKey]);

    if (id === 0 && play.uri !== null) {
      // Adopt a URI-less row for the same song, if one exists.
      const orphan = selectInt(
        this.db,
        `SELECT id FROM tracks WHERE artist_id = ? AND name_key = ? AND kind = ? AND uri IS NULL
         ORDER BY id LIMIT 1`,
        [artistId, titleKey, play.kind],
      );
      if (orphan !== 0) {
        this.db.exec({
          sql: 'UPDATE tracks SET uri = ?, track_key = ?, album_id = COALESCE(album_id, ?) WHERE id = ?',
          bind: [play.uri, play.trackKey, albumId, orphan],
        });
        id = orphan;
      }
    }

    if (id === 0 && play.uri === null) {
      id = selectInt(
        this.db,
        `SELECT id FROM tracks WHERE artist_id = ? AND name_key = ? AND kind = ?
         ORDER BY uri IS NULL, id LIMIT 1`,
        [artistId, titleKey, play.kind],
      );
    }

    if (id === 0) {
      this.db.exec({
        sql: `INSERT INTO tracks (track_key, kind, uri, name, name_key, artist_id, album_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        bind: [play.trackKey, play.kind, play.uri, play.trackName, titleKey, artistId, albumId],
      });
      id = selectInt(this.db, 'SELECT last_insert_rowid()');
    } else if (albumId !== null) {
      this.db.exec({
        sql: 'UPDATE tracks SET album_id = ? WHERE id = ? AND album_id IS NULL',
        bind: [albumId, id],
      });
    }

    this.trackIds.set(play.trackKey, id);
    return id;
  }

  /**
   * Inserts a batch inside one transaction. Rows cross into SQLite as a single
   * JSON array and are expanded by json_each() in C: binding parameters row by
   * row from JavaScript costs several times more than the insert itself.
   */
  insertBatch(plays: readonly NormalizedPlay[], importId: number | null): BatchResult {
    if (plays.length === 0) return { inserted: 0, duplicates: 0 };
    const flag = (v: boolean | null) => (v === null ? null : v ? 1 : 0);
    let inserted = 0;

    this.db.transaction((db) => {
      const rows = plays.map((p) => [
        p.tsEnd,
        p.msPlayed,
        this.trackId(p),
        p.source,
        p.reasonStart,
        p.reasonEnd,
        flag(p.shuffle),
        flag(p.skipped),
        flag(p.offline),
        flag(p.incognito),
        this.toLocal(p.tsEnd),
      ]);
      const json = JSON.stringify(rows);
      const columns = `value ->> 0 AS ts_end, value ->> 1 AS ms_played, value ->> 2 AS track_id,
        value ->> 3 AS source, value ->> 4 AS reason_start, value ->> 5 AS reason_end,
        value ->> 6 AS shuffle, value ->> 7 AS skipped, value ->> 8 AS offline,
        value ->> 9 AS incognito, value ->> 10 AS local_end`;

      db.exec({
        sql: `INSERT OR IGNORE INTO plays
                (ts_end, ms_played, track_id, source, reason_start, reason_end,
                 shuffle, skipped, offline, incognito, local_end, import_id)
              SELECT ts_end, ms_played, track_id, source, reason_start, reason_end,
                     shuffle, skipped, offline, incognito, local_end, ?
              FROM (SELECT ${columns} FROM json_each(?))`,
        bind: [importId, json],
      });
      inserted = db.changes();

      // An Extended record identical to a stored basic one takes over its
      // source and detail fields: Extended is the authoritative export.
      if (plays.some((p) => p.source === 'extended') && this.hasBasicPlays()) {
        db.exec({
          sql: `UPDATE plays
                SET source = 'extended', import_id = ?, reason_start = j.reason_start,
                    reason_end = j.reason_end, shuffle = j.shuffle, skipped = j.skipped,
                    offline = j.offline, incognito = j.incognito
                FROM (SELECT ${columns} FROM json_each(?)) AS j
                WHERE j.source = 'extended' AND plays.source = 'basic'
                  AND plays.ts_end = j.ts_end AND plays.track_id = j.track_id
                  AND plays.ms_played = j.ms_played`,
          bind: [importId, json],
        });
      }
    });
    if (plays.some((p) => p.source === 'basic')) this.basicPresent = true;
    return { inserted, duplicates: plays.length - inserted };
  }

  private basicPresent: boolean | null = null;

  private hasBasicPlays(): boolean {
    this.basicPresent ??=
      selectInt(this.db, `SELECT EXISTS (SELECT 1 FROM plays WHERE source = 'basic')`) === 1;
    return this.basicPresent;
  }
}

/**
 * Basic-export plays are a stop-gap for the period after the last Extended
 * export. Once Extended data covers a period, basic plays inside it are removed.
 */
export function supersedeBasicPlays(db: Database): number {
  db.exec(`DELETE FROM plays
           WHERE source = 'basic'
             AND ts_end <= (SELECT MAX(ts_end) FROM plays WHERE source = 'extended')`);
  return db.changes();
}

/** Removes catalog rows no play refers to (after superseding or merges). */
export function pruneCatalog(db: Database): void {
  db.exec(`
    DELETE FROM tracks  WHERE id NOT IN (SELECT DISTINCT track_id FROM plays);
    DELETE FROM albums  WHERE id NOT IN (SELECT album_id FROM tracks WHERE album_id IS NOT NULL);
    DELETE FROM artists WHERE id NOT IN (SELECT artist_id FROM tracks)
                          AND id NOT IN (SELECT artist_id FROM albums);
  `);
}

/** Rebuilds the full-text index over the catalog. */
export function rebuildSearchIndex(db: Database): void {
  db.transaction((tx) => {
    tx.exec(`INSERT INTO search_fts (search_fts) VALUES ('delete-all')`);
    tx.exec(`INSERT INTO search_fts (rowid, track, artist, album)
             SELECT t.id, t.name, a.name, COALESCE(al.name, '')
             FROM tracks t
             JOIN artists a ON a.id = t.artist_id
             LEFT JOIN albums al ON al.id = t.album_id`);
  });
}
