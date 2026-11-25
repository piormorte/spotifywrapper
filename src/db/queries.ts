import { STREAM_THRESHOLD_MS } from '../lib/units.ts';
import type { ItemKind, PlaySource } from '../importer/types.ts';
import { toFtsQuery } from './search.ts';
import { asText, asTextOrNull, selectInt, type Database } from './sqlite.ts';

/** Read-side queries. Every function takes the database explicitly. */

export interface LibrarySummary {
  /** Music records (any length). */
  readonly records: number;
  /** Music plays with ms_played > 0. */
  readonly registeredPlays: number;
  /** Music plays with ms_played >= 30 s. */
  readonly streams: number;
  readonly msPlayed: number;
  readonly tracks: number;
  readonly artists: number;
  /** Podcast and audiobook plays (kept apart from music statistics). */
  readonly spokenWordPlays: number;
  readonly bySource: Readonly<Record<PlaySource, number>>;
  readonly firstPlay: number | null;
  readonly lastPlay: number | null;
  /** End of the Extended data; later plays come from the basic export. */
  readonly extendedUntil: number | null;
  readonly imports: number;
}

export function librarySummary(db: Database): LibrarySummary {
  const music = db.selectObject(
    `SELECT COUNT(*) AS records,
            COALESCE(SUM(p.ms_played > 0), 0) AS registered,
            COALESCE(SUM(p.ms_played >= ?), 0) AS streams,
            COALESCE(SUM(p.ms_played), 0) AS ms,
            COUNT(DISTINCT p.track_id) AS tracks,
            COUNT(DISTINCT t.artist_id) AS artists,
            MIN(p.ts_end) AS first, MAX(p.ts_end) AS last
     FROM plays p JOIN tracks t ON t.id = p.track_id
     WHERE t.kind = 'track'`,
    [STREAM_THRESHOLD_MS],
  );
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'bigint' ? Number(v) : 0);
  const orNull = (v: unknown) => (v === null || v === undefined ? null : num(v));

  return {
    records: num(music?.['records']),
    registeredPlays: num(music?.['registered']),
    streams: num(music?.['streams']),
    msPlayed: num(music?.['ms']),
    tracks: num(music?.['tracks']),
    artists: num(music?.['artists']),
    spokenWordPlays: selectInt(
      db,
      `SELECT COUNT(*) FROM plays p JOIN tracks t ON t.id = p.track_id WHERE t.kind != 'track'`,
    ),
    bySource: {
      extended: selectInt(db, `SELECT COUNT(*) FROM plays WHERE source = 'extended'`),
      basic: selectInt(db, `SELECT COUNT(*) FROM plays WHERE source = 'basic'`),
    },
    firstPlay: orNull(music?.['first']),
    lastPlay: orNull(music?.['last']),
    extendedUntil: orNull(
      db.selectValue(`SELECT MAX(ts_end) FROM plays WHERE source = 'extended'`),
    ),
    imports: selectInt(db, 'SELECT COUNT(*) FROM imports'),
  };
}

export interface HistoryQuery {
  readonly text?: string;
  readonly kind?: ItemKind;
  /** Inclusive lower bound, epoch ms. */
  readonly from?: number;
  /** Exclusive upper bound, epoch ms. */
  readonly to?: number;
  readonly limit?: number;
  /** Keyset cursor: continue after this row (results are newest first). */
  readonly after?: { readonly tsEnd: number; readonly id: number };
}

export interface HistoryRow {
  readonly id: number;
  readonly tsEnd: number;
  /** End of playback in local wall-clock ms (chosen time zone). */
  readonly localEnd: number;
  readonly msPlayed: number;
  readonly kind: ItemKind;
  readonly track: string;
  readonly artist: string;
  readonly album: string | null;
  readonly uri: string | null;
  readonly reasonEnd: string | null;
  readonly source: PlaySource;
}

export interface HistoryPage {
  readonly rows: readonly HistoryRow[];
  /** Total rows matching the filters (ignores the cursor). */
  readonly total: number;
}

const MAX_PAGE = 500;

export function searchHistory(db: Database, query: HistoryQuery): HistoryPage {
  const match = query.text ? toFtsQuery(query.text) : null;
  // Records with ms_played = 0 are kept for completeness but never shown.
  const filters = `
    p.ms_played > 0
    AND (:match IS NULL OR p.track_id IN (SELECT rowid FROM search_fts WHERE search_fts MATCH :match))
    AND (:kind IS NULL OR t.kind = :kind)
    AND (:from IS NULL OR p.ts_end >= :from)
    AND (:to IS NULL OR p.ts_end < :to)`;
  const bind = {
    ':match': match,
    ':kind': query.kind ?? null,
    ':from': query.from ?? null,
    ':to': query.to ?? null,
  };

  const rows = db.selectObjects(
    `SELECT p.id, p.ts_end, p.local_end, p.ms_played, p.source, p.reason_end,
            t.kind, t.name AS track, t.uri, a.name AS artist, al.name AS album
     FROM plays p
     JOIN tracks t ON t.id = p.track_id
     JOIN artists a ON a.id = t.artist_id
     LEFT JOIN albums al ON al.id = t.album_id
     WHERE ${filters}
       AND (:afterTs IS NULL OR (p.ts_end, p.id) < (:afterTs, :afterId))
     ORDER BY p.ts_end DESC, p.id DESC
     LIMIT :limit`,
    {
      ...bind,
      ':afterTs': query.after?.tsEnd ?? null,
      ':afterId': query.after?.id ?? null,
      ':limit': Math.min(Math.max(query.limit ?? 100, 1), MAX_PAGE),
    },
  );

  const total = selectInt(
    db,
    `SELECT COUNT(*) FROM plays p JOIN tracks t ON t.id = p.track_id WHERE ${filters}`,
    bind as never,
  );

  return {
    total,
    rows: rows.map((r) => ({
      id: Number(r['id']),
      tsEnd: Number(r['ts_end']),
      localEnd: Number(r['local_end']),
      msPlayed: Number(r['ms_played']),
      kind: r['kind'] as ItemKind,
      track: asText(r['track']),
      artist: asText(r['artist']),
      album: asTextOrNull(r['album']),
      uri: asTextOrNull(r['uri']),
      reasonEnd: asTextOrNull(r['reason_end']),
      source: r['source'] as PlaySource,
    })),
  };
}

export interface ImportLogEntry {
  readonly id: number;
  readonly fileName: string;
  readonly kind: string;
  readonly createdAt: number;
  readonly inserted: number;
  readonly duplicates: number;
}

export function listImports(db: Database): ImportLogEntry[] {
  return db
    .selectObjects(
      'SELECT id, file_name, kind, created_at, inserted, duplicates FROM imports ORDER BY id DESC',
    )
    .map((r) => ({
      id: Number(r['id']),
      fileName: asText(r['file_name']),
      kind: asText(r['kind']),
      createdAt: Number(r['created_at']),
      inserted: Number(r['inserted']),
      duplicates: Number(r['duplicates']),
    }));
}

export function getSetting(db: Database, key: string): string | null {
  const v = db.selectValue('SELECT value FROM settings WHERE key = ?', [key]);
  return typeof v === 'string' ? v : null;
}

export function setSetting(db: Database, key: string, value: string): void {
  db.exec({
    sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    bind: [key, value],
  });
}
