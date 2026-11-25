import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { ImportInput } from './library.ts';
import { Library } from './library.ts';
import { MemoryHost } from './host.ts';
import type { Sqlite3Static } from './sqlite.ts';

/** Test helpers (Node). Not imported by application code. */

let sqlite: Promise<Sqlite3Static> | null = null;

export function loadSqlite(): Promise<Sqlite3Static> {
  sqlite ??= sqlite3InitModule();
  return sqlite;
}

export async function newLibrary(): Promise<{ library: Library; host: MemoryHost }> {
  const host = new MemoryHost(await loadSqlite());
  return { library: new Library(host, 'test'), host };
}

export function bytesFile(name: string, bytes: Uint8Array): ImportInput {
  return { name, read: () => Promise.resolve(bytes) };
}

export function jsonFile(name: string, records: unknown[]): ImportInput {
  return bytesFile(name, new TextEncoder().encode(JSON.stringify(records)));
}

export function extendedRecord(
  ts: string,
  msPlayed: number,
  track: string,
  artist: string,
  album: string | null,
  uri: string | null,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ts,
    ms_played: msPlayed,
    master_metadata_track_name: track,
    master_metadata_album_artist_name: artist,
    master_metadata_album_album_name: album,
    spotify_track_uri: uri,
    reason_start: 'clickrow',
    reason_end: 'trackdone',
    shuffle: false,
    skipped: false,
    offline: false,
    incognito_mode: false,
    ...extra,
  };
}
