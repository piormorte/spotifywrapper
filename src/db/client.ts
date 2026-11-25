import type { ImportProgress } from './library.ts';
import type {
  LibraryOps,
  OpName,
  RequestMessage,
  ResponseMessage,
  SerializedError,
} from './protocol.ts';

/** Error raised in the worker, re-created on the UI thread with its code. */
export class LibraryError extends Error {
  readonly code: string;

  constructor(error: SerializedError) {
    super(error.message);
    this.name = error.name;
    this.code = error.code;
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  onProgress?: ((progress: ImportProgress) => void) | undefined;
}

/**
 * Typed RPC client for the database worker. All database work happens off the
 * UI thread; the UI only ever receives query results.
 */
export class LibraryClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(worker: Worker) {
    this.worker = worker;
    worker.addEventListener('message', (event: MessageEvent<ResponseMessage>) => {
      const msg = event.data;
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      if (msg.kind === 'progress') {
        entry.onProgress?.(msg.progress);
        return;
      }
      this.pending.delete(msg.id);
      if (msg.kind === 'result') entry.resolve(msg.result);
      else entry.reject(new LibraryError(msg.error));
    });
    worker.addEventListener('error', () => {
      for (const entry of this.pending.values()) {
        entry.reject(
          new LibraryError({
            name: 'WorkerError',
            code: 'worker_failed',
            message: 'O processamento local falhou. Recarregue a página e tente de novo.',
          }),
        );
      }
      this.pending.clear();
    });
  }

  call<K extends OpName>(
    op: K,
    arg: LibraryOps[K][0],
    options: { onProgress?: (progress: ImportProgress) => void; transfer?: Transferable[] } = {},
  ): Promise<LibraryOps[K][1]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        onProgress: options.onProgress,
      });
      const message: RequestMessage<K> = { id, op, arg };
      this.worker.postMessage(message, options.transfer ?? []);
    });
  }
}

let shared: LibraryClient | null = null;

/**
 * The single client for this page. One worker per page matters: the worker
 * holds exclusive handles on the database files.
 */
export function sharedLibraryClient(): LibraryClient {
  shared ??= new LibraryClient(
    new Worker(new URL('../workers/db.worker.ts', import.meta.url), {
      type: 'module',
      name: 'liner-db',
    }),
  );
  return shared;
}
