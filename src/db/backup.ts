import { APPLICATION_ID, SCHEMA_VERSION, applicationId, migrate, schemaVersion } from './schema.ts';
import {
  asText,
  exportDatabase,
  looksLikeSqlite,
  openFromBytes,
  selectInt,
  type Database,
  type Sqlite3Static,
} from './sqlite.ts';

/**
 * Full backups (docs/PLANNING.md §8).
 *
 * A backup is the whole database serialized to a single .sqlite file plus a
 * `backup_meta` table: format marker, versions, row counts and a SHA-256
 * content hash. Restoring verifies all of it before touching the live data.
 */

export const BACKUP_FORMAT = 'liner-backup/1';

export interface BackupCounts {
  readonly plays: number;
  readonly tracks: number;
  readonly artists: number;
  readonly albums: number;
  readonly imports: number;
}

export interface BackupInfo {
  readonly format: string;
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly createdAt: number;
  readonly counts: BackupCounts;
  readonly contentHash: string;
  readonly firstPlay: number | null;
  readonly lastPlay: number | null;
}

export type BackupErrorCode =
  'not_sqlite' | 'wrong_app' | 'newer_schema' | 'corrupt' | 'not_a_backup' | 'checksum_mismatch';

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'BackupError';
  }
}

export function countRows(db: Database): BackupCounts {
  return {
    plays: selectInt(db, 'SELECT COUNT(*) FROM plays'),
    tracks: selectInt(db, 'SELECT COUNT(*) FROM tracks'),
    artists: selectInt(db, 'SELECT COUNT(*) FROM artists'),
    albums: selectInt(db, 'SELECT COUNT(*) FROM albums'),
    imports: selectInt(db, 'SELECT COUNT(*) FROM imports'),
  };
}

const HASH_CHUNK_ROWS = 20_000;

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/**
 * SHA-256 over every play with its resolved catalog names, in a canonical
 * order. Row IDs are excluded, so two databases with the same history hash
 * the same regardless of import order. Hashed in chunks to bound memory.
 */
export async function contentHash(db: Database): Promise<string> {
  const stmt = db.prepare(`
    SELECT p.ts_end, p.ms_played, p.source, p.reason_start, p.reason_end,
           p.shuffle, p.skipped, p.offline, p.incognito,
           t.track_key, t.kind, t.name, a.name, al.name
    FROM plays p
    JOIN tracks t ON t.id = p.track_id
    JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
    ORDER BY p.ts_end, t.track_key, p.ms_played`);
  const chunkDigests: string[] = [];
  let lines: string[] = [];
  try {
    while (stmt.step()) {
      lines.push(
        stmt
          .get([])
          .map((v) => (v === null ? '∅' : asText(v)))
          .join('\t'),
      );
      if (lines.length === HASH_CHUNK_ROWS) {
        chunkDigests.push(await sha256(lines.join('\n')));
        lines = [];
      }
    }
  } finally {
    stmt.finalize();
  }
  if (lines.length > 0) chunkDigests.push(await sha256(lines.join('\n')));
  return sha256(chunkDigests.join(''));
}

function playRange(db: Database): { firstPlay: number | null; lastPlay: number | null } {
  const row = db.selectArray('SELECT MIN(ts_end), MAX(ts_end) FROM plays');
  const toNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return { firstPlay: toNum(row?.[0]), lastPlay: toNum(row?.[1]) };
}

/** Serializes the live database into a verified backup file. The live DB is not modified. */
export async function createBackup(
  sqlite3: Sqlite3Static,
  live: Database,
  appVersion: string,
  now = Date.now(),
): Promise<{ bytes: Uint8Array; info: BackupInfo }> {
  const copy = openFromBytes(sqlite3, exportDatabase(sqlite3, live));
  try {
    const info: BackupInfo = {
      format: BACKUP_FORMAT,
      appVersion,
      schemaVersion: schemaVersion(copy),
      createdAt: now,
      counts: countRows(copy),
      contentHash: await contentHash(copy),
      ...playRange(copy),
    };
    copy.exec(`DROP TABLE IF EXISTS backup_meta;
               CREATE TABLE backup_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    copy.exec({
      sql: 'INSERT INTO backup_meta (key, value) VALUES (?, ?)',
      bind: ['info', JSON.stringify(info)],
    });
    copy.exec('VACUUM');
    return { bytes: exportDatabase(sqlite3, copy), info };
  } finally {
    copy.close();
  }
}

function readInfo(db: Database): BackupInfo {
  const hasMeta = selectInt(
    db,
    `SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name = 'backup_meta'`,
  );
  const raw = hasMeta ? db.selectValue(`SELECT value FROM backup_meta WHERE key = 'info'`) : null;
  if (typeof raw !== 'string') {
    throw new BackupError(
      'not_a_backup',
      'Este banco não contém os dados de verificação de backup.',
    );
  }
  const info = JSON.parse(raw) as BackupInfo;
  if (info.format !== BACKUP_FORMAT) {
    throw new BackupError('not_a_backup', 'Formato de backup não reconhecido.');
  }
  return info;
}

/**
 * Opens and fully verifies a backup. On success returns an in-memory copy,
 * migrated to the current schema and without `backup_meta`. Caller closes it.
 */
export async function openVerifiedBackup(
  sqlite3: Sqlite3Static,
  bytes: Uint8Array,
): Promise<{ db: Database; info: BackupInfo }> {
  if (!looksLikeSqlite(bytes)) {
    throw new BackupError('not_sqlite', 'O arquivo não é um banco SQLite.');
  }
  let db: Database;
  try {
    db = openFromBytes(sqlite3, bytes);
  } catch {
    throw new BackupError('corrupt', 'Não foi possível abrir o arquivo de backup.');
  }
  try {
    if (applicationId(db) !== APPLICATION_ID) {
      throw new BackupError('wrong_app', 'Este arquivo não é um backup do Liner.');
    }
    if (schemaVersion(db) > SCHEMA_VERSION) {
      throw new BackupError(
        'newer_schema',
        'Este backup foi criado por uma versão mais nova do Liner. Atualize o app e tente de novo.',
      );
    }
    const integrity = db.selectValues('PRAGMA integrity_check');
    if (integrity.length !== 1 || integrity[0] !== 'ok') {
      throw new BackupError('corrupt', 'O arquivo de backup está corrompido.');
    }
    const info = readInfo(db);
    const counts = countRows(db);
    const sameCounts = (Object.keys(counts) as (keyof BackupCounts)[]).every(
      (k) => counts[k] === info.counts[k],
    );
    if (!sameCounts || (await contentHash(db)) !== info.contentHash) {
      throw new BackupError(
        'checksum_mismatch',
        'O conteúdo do backup não confere com a verificação gravada nele.',
      );
    }
    db.exec('DROP TABLE backup_meta');
    migrate(db);
    return { db, info };
  } catch (error) {
    db.close();
    throw error;
  }
}
