import { createContext, useContext } from 'react';
import type { LibraryClient } from '../db/client.ts';
import type { StorageStatus } from '../db/protocol.ts';
import type { LibrarySummary } from '../db/queries.ts';

export interface LibraryState {
  readonly client: LibraryClient;
  readonly status: 'loading' | 'ready' | 'error';
  readonly storage: StorageStatus | null;
  readonly summary: LibrarySummary | null;
  readonly refresh: () => Promise<void>;
  readonly setSummary: (summary: LibrarySummary) => void;
}

export const LibraryContext = createContext<LibraryState | null>(null);

export function useLibrary(): LibraryState {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return context;
}
