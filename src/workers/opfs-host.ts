import type { SAHPoolUtil } from '@sqlite.org/sqlite-wasm';
import type { DatabaseHost } from '../db/host.ts';
import type { Database, Sqlite3Static } from '../db/sqlite.ts';

/**
 * Persistent database in the Origin Private File System, using SQLite's
 * "opfs-sahpool" VFS (no COOP/COEP headers required).
 */

const DB_FILE = '/liner.sqlite3';
const SAFETY_FILE = '/liner-previous.sqlite3';

class OpfsHost implements DatabaseHost {
  readonly persistent = true;
  readonly sqlite3: Sqlite3Static;
  private readonly pool: SAHPoolUtil;
  private current: Database;

  constructor(sqlite3: Sqlite3Static, pool: SAHPoolUtil) {
    this.sqlite3 = sqlite3;
    this.pool = pool;
    this.current = new pool.OpfsSAHPoolDb(DB_FILE);
  }

  get db(): Database {
    return this.current;
  }

  async replace(bytes: Uint8Array): Promise<void> {
    this.current.close();
    try {
      await this.pool.importDb(DB_FILE, bytes);
    } finally {
      this.current = new this.pool.OpfsSAHPoolDb(DB_FILE);
    }
  }

  async saveSafetyCopy(bytes: Uint8Array): Promise<void> {
    await this.pool.importDb(SAFETY_FILE, bytes);
  }
}

export async function openOpfsHost(sqlite3: Sqlite3Static): Promise<DatabaseHost> {
  const pool = await sqlite3.installOpfsSAHPoolVfs({
    name: 'liner-sahpool',
    directory: '.liner',
    initialCapacity: 6,
  });
  return new OpfsHost(sqlite3, pool);
}
