import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';

export type { Database, Sqlite3Static };

const SQLITE_HEADER = 'SQLite format 3\u0000';

/** True when `bytes` starts with the SQLite file header. */
export function looksLikeSqlite(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 100) return false;
  return new TextDecoder().decode(bytes.subarray(0, 16)) === SQLITE_HEADER;
}

/** Serializes a database to bytes (works for any VFS). */
export function exportDatabase(sqlite3: Sqlite3Static, db: Database): Uint8Array {
  return sqlite3.capi.sqlite3_js_db_export(db);
}

/** Opens an in-memory database holding a copy of `bytes`. */
export function openFromBytes(sqlite3: Sqlite3Static, bytes: Uint8Array): Database {
  const db = new sqlite3.oo1.DB(':memory:');
  const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
  const { capi } = sqlite3;
  const rc = capi.sqlite3_deserialize(
    db,
    'main',
    pointer,
    bytes.byteLength,
    bytes.byteLength,
    capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE,
  );
  if (rc !== capi.SQLITE_OK) {
    db.close();
    throw new Error(`Could not load database (sqlite error ${rc})`);
  }
  return db;
}

/** Reads a single integer, failing loudly if the query returns something else. */
export function selectInt(db: Database, sql: string, bind?: unknown[]): number {
  const value = db.selectValue(sql, bind as never);
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value === null || value === undefined) return 0;
  throw new TypeError(`Expected an integer from: ${sql}`);
}

/** Column value as text; throws on blobs, which this schema never stores. */
export function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  throw new TypeError('Expected a text column');
}

export function asTextOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : asText(value);
}
