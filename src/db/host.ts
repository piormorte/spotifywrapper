import { openFromBytes, type Database, type Sqlite3Static } from './sqlite.ts';

/**
 * Owns the physical database. The browser uses an OPFS-backed host
 * (src/workers/opfs-host.ts); tests and the no-OPFS fallback use memory.
 */
export interface DatabaseHost {
  readonly sqlite3: Sqlite3Static;
  /** False when data will not survive a reload (no OPFS available). */
  readonly persistent: boolean;
  readonly db: Database;
  /** Atomically replaces the database contents with `bytes`. */
  replace(bytes: Uint8Array): Promise<void>;
  /** Keeps a copy of the previous database before a destructive operation. */
  saveSafetyCopy(bytes: Uint8Array): Promise<void>;
}

export class MemoryHost implements DatabaseHost {
  readonly persistent = false;
  private current: Database;
  safetyCopy: Uint8Array | null = null;

  readonly sqlite3: Sqlite3Static;

  constructor(sqlite3: Sqlite3Static) {
    this.sqlite3 = sqlite3;
    this.current = new sqlite3.oo1.DB(':memory:');
  }

  get db(): Database {
    return this.current;
  }

  replace(bytes: Uint8Array): Promise<void> {
    const next = openFromBytes(this.sqlite3, bytes);
    this.current.close();
    this.current = next;
    return Promise.resolve();
  }

  saveSafetyCopy(bytes: Uint8Array): Promise<void> {
    this.safetyCopy = bytes.slice();
    return Promise.resolve();
  }
}
