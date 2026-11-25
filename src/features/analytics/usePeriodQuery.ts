import { useEffect, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import type { LibraryOps } from '../../db/protocol.ts';
import type { PeriodSpec } from '../../stats/period.ts';

type PeriodOp = 'analytics' | 'personality';
type State<T> = { status: 'loading' | 'empty' | 'error' } | { status: 'ready'; data: T };

/**
 * Loads a period-based statistic and keeps the last valid result while a
 * custom range is being edited. Re-runs after imports (summary changes).
 */
export function usePeriodQuery<K extends PeriodOp>(
  op: K,
  period: PeriodSpec,
): State<NonNullable<LibraryOps[K][1]>> {
  const { client, status, summary } = useLibrary();
  const [state, setState] = useState<State<NonNullable<LibraryOps[K][1]>>>({ status: 'loading' });

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    client
      .call(op, period)
      .then((result) => {
        if (!lifecycle.active) return;
        if (result) setState({ status: 'ready', data: result });
        else if (period.preset !== 'custom') setState({ status: 'empty' });
      })
      .catch(() => {
        if (lifecycle.active) setState({ status: 'error' });
      });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, op, period, summary]);

  return state;
}
