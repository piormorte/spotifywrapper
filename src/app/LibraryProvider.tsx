import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sharedLibraryClient } from '../db/client.ts';
import type { StorageStatus } from '../db/protocol.ts';
import type { LibrarySummary } from '../db/queries.ts';
import { LibraryContext, type LibraryState } from './library-context.ts';

/** Shares one database worker and the current library summary with the UI. */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(sharedLibraryClient);
  const [status, setStatus] = useState<LibraryState['status']>('loading');
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [summary, setSummary] = useState<LibrarySummary | null>(null);

  const refresh = useCallback(async () => {
    setSummary(await client.call('summary', undefined));
  }, [client]);

  useEffect(() => {
    const lifecycle = { active: true };
    void (async () => {
      try {
        const storageStatus = await client.call('init', undefined);
        const initial = await client.call('summary', undefined);
        if (!lifecycle.active) return;
        setStorage(storageStatus);
        setSummary(initial);
        setStatus('ready');
      } catch {
        if (lifecycle.active) setStatus('error');
      }
    })();
    return () => {
      lifecycle.active = false;
    };
  }, [client]);

  const value = useMemo<LibraryState>(
    () => ({ client, status, storage, summary, refresh, setSummary }),
    [client, status, storage, summary, refresh],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
