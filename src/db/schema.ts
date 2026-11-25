import type { Database } from './sqlite.ts';

/** "LINR" — identifies Liner databases and backups (PRAGMA application_id). */
export const APPLICATION_ID = 0x4c494e52;

/**
 * Ordered migrations. Index i upgrades schema version i to i + 1.
 * Never edit a released migration; append a new one.
 */
const MIGRATIONS: readonly string[] = [
  /* v1 */ `
  CREATE TABLE artists (
    id          INTEGER PRIMARY KEY,
    artist_key  TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL
  );

  CREATE TABLE albums (
    id          INTEGER PRIMARY KEY,
    album_key   TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    artist_id   INTEGER NOT NULL REFERENCES artists(id)
  );

  CREATE TABLE tracks (
    id          INTEGER PRIMARY KEY,
    track_key   TEXT NOT NULL UNIQUE,
    kind        TEXT NOT NULL CHECK (kind IN ('track', 'episode', 'audiobook')),
    uri         TEXT,
    name        TEXT NOT NULL,
    name_key    TEXT NOT NULL,
    artist_id   INTEGER NOT NULL REFERENCES artists(id),
    album_id    INTEGER REFERENCES albums(id)
  );
  CREATE INDEX tracks_by_name ON tracks (artist_id, name_key, kind);

  CREATE TABLE imports (
    id          INTEGER PRIMARY KEY,
    file_name   TEXT NOT NULL,
    file_sha256 TEXT NOT NULL,
    kind        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    inserted    INTEGER NOT NULL DEFAULT 0,
    duplicates  INTEGER NOT NULL DEFAULT 0,
    report_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE plays (
    id           INTEGER PRIMARY KEY,
    ts_end       INTEGER NOT NULL,
    ms_played    INTEGER NOT NULL CHECK (ms_played >= 0),
    track_id     INTEGER NOT NULL REFERENCES tracks(id),
    source       TEXT NOT NULL CHECK (source IN ('extended', 'basic')),
    import_id    INTEGER REFERENCES imports(id) ON DELETE SET NULL,
    reason_start TEXT,
    reason_end   TEXT,
    shuffle      INTEGER,
    skipped      INTEGER,
    offline      INTEGER,
    incognito    INTEGER,
    UNIQUE (ts_end, track_id, ms_played)
  );
  CREATE INDEX plays_by_track ON plays (track_id, ts_end);

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE VIRTUAL TABLE search_fts USING fts5 (
    track, artist, album,
    content = '',
    contentless_delete = 1,
    tokenize = 'unicode61 remove_diacritics 2'
  );
  `,
  /* v2: wall-clock end time in the user's time zone, for local-time statistics.
     Filled by the app (Library.ensureLocalTimes), never by SQL. */ `
  ALTER TABLE plays ADD COLUMN local_end INTEGER;
  CREATE INDEX plays_by_local_end ON plays (local_end);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: Database): number {
  return Number(db.selectValue('PRAGMA user_version') ?? 0);
}

export function applicationId(db: Database): number {
  return Number(db.selectValue('PRAGMA application_id') ?? 0);
}

/** Applies pending migrations atomically. Returns the resulting version. */
export function migrate(db: Database): number {
  const current = schemaVersion(db);
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database schema v${current} is newer than this app supports (v${SCHEMA_VERSION}).`,
    );
  }
  if (current === SCHEMA_VERSION) return current;

  db.transaction((tx) => {
    for (let v = current; v < SCHEMA_VERSION; v++) {
      const sql = MIGRATIONS[v];
      if (sql === undefined) throw new Error(`Missing migration for v${v + 1}`);
      tx.exec(sql);
    }
    tx.exec(`PRAGMA application_id = ${APPLICATION_ID}; PRAGMA user_version = ${SCHEMA_VERSION};`);
  });
  return SCHEMA_VERSION;
}

/** Connection-level settings applied every time a database is opened. */
export function configureConnection(db: Database): void {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA temp_store = MEMORY;');
}
