/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { BackupError } from '../db/backup.ts';
import { MemoryHost, type DatabaseHost } from '../db/host.ts';
import { Library } from '../db/library.ts';
import type {
  LibraryOps,
  OpName,
  RequestMessage,
  ResponseMessage,
  StorageStatus,
} from '../db/protocol.ts';
import { deviceTimeZone } from '../lib/time.ts';
import { openOpfsHost } from './opfs-host.ts';

/**
 * Database worker: owns the SQLite connection and runs imports, queries and
 * backups off the UI thread. Logs never include listening data.
 */

declare const self: DedicatedWorkerGlobalScope;

async function start(): Promise<{ library: Library; storage: StorageStatus }> {
  const sqlite3 = await sqlite3InitModule();
  let host: DatabaseHost;
  let storage: StorageStatus;
  const storageApi = (self.navigator as Partial<WorkerNavigator>).storage;
  if (typeof storageApi?.getDirectory !== 'function') {
    host = new MemoryHost(sqlite3);
    storage = { persistent: false, reason: 'unsupported' };
  } else {
    try {
      host = await openOpfsHost(sqlite3);
      storage = { persistent: true };
    } catch {
      // Typically: another tab holds the database files.
      host = new MemoryHost(sqlite3);
      storage = { persistent: false, reason: 'unavailable' };
    }
  }
  return { library: new Library(host, __APP_VERSION__, deviceTimeZone()), storage };
}

const ready = start();

function post(message: ResponseMessage, transfer: Transferable[] = []) {
  self.postMessage(message, transfer);
}

type Handlers = {
  [K in OpName]: (
    library: Library,
    arg: LibraryOps[K][0],
    id: number,
  ) => Promise<LibraryOps[K][1]> | LibraryOps[K][1];
};

const handlers: Handlers = {
  init: async () => (await ready).storage,
  summary: (library) => library.summary(),
  history: (library, query) => library.history(query),
  overview: (library, spec) => library.overview(spec),
  analytics: (library, spec) => library.analytics(spec),
  personality: (library, spec) => library.personality(spec),
  fadedArtists: (library) => library.fadedArtists(),
  exportBundle: (library, spec) => library.exportBundle(spec),
  ranking: (library, query) => library.ranking(query),
  timeline: (library, { period, granularity }) => library.timeline(period, granularity),
  dominantArtists: (library) => library.dominantArtists(),
  yearsWithData: (library) => library.yearsWithData(),
  compare: (library, { a, b }) => library.compare(a, b),
  albumTracks: (library, { albumId, period }) => library.albumTracks(albumId, period),
  getTimeZone: (library) => library.timeZone(),
  setTimeZone: (library, timeZone) => {
    library.setTimeZone(timeZone);
    return library.summary();
  },
  imports: (library) => library.imports(),
  importFiles: (library, files, id) => {
    const inputs = files.map((file) => ({
      name: file.name,
      read: async () => new Uint8Array(await file.arrayBuffer()),
    }));
    return library.importFiles(inputs, (progress) => {
      post({ id, kind: 'progress', progress });
    });
  },
  backup: (library) => library.backup(),
  inspectBackup: (library, bytes) => library.inspectBackup(bytes),
  restore: (library, { bytes, mode }) => library.restore(bytes, mode),
  eraseAll: (library) => library.eraseAll(),
  getSetting: (library, key) => library.setting(key),
  setSetting: (library, { key, value }) => {
    library.updateSetting(key, value);
    return null;
  },
};

// Requests run one at a time, in order: a single connection, no interleaving.
let queue: Promise<unknown> = Promise.resolve();

self.addEventListener('message', (event: MessageEvent<RequestMessage>) => {
  const { id, op, arg } = event.data;
  queue = queue.then(async () => {
    try {
      const { library } = await ready;
      const handler = handlers[op] as (l: Library, a: unknown, id: number) => unknown;
      const result = await handler(library, arg, id);
      const transfer =
        op === 'backup' && result && typeof result === 'object' && 'bytes' in result
          ? [(result as { bytes: Uint8Array }).bytes.buffer]
          : [];
      post({ id, kind: 'result', result }, transfer);
    } catch (error) {
      post({
        id,
        kind: 'error',
        error: {
          name: error instanceof Error ? error.name : 'Error',
          code:
            error instanceof BackupError
              ? error.code
              : error instanceof Error && 'code' in error
                ? String((error as { code: unknown }).code)
                : 'unexpected',
          message:
            error instanceof BackupError
              ? error.message
              : 'Ocorreu um erro inesperado no processamento local.',
        },
      });
    }
  });
});
