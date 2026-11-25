import { useEffect, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import type { HistoryRow } from '../../db/queries.ts';
import type { ItemKind } from '../../importer/types.ts';
import {
  formatClock,
  formatInteger,
  formatLocalDateLong,
  formatLocalTime,
  plural,
} from '../../lib/format.ts';
import { STREAM_THRESHOLD_MS } from '../../lib/units.ts';
import { dayKey } from '../../stats/period.ts';
import { Button } from '../../ui/Button.tsx';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';

type KindChoice = ItemKind | 'all';
const KINDS = [
  { value: 'track', label: 'Música' },
  { value: 'episode', label: 'Podcasts' },
  { value: 'audiobook', label: 'Audiolivros', short: 'Livros' },
  { value: 'all', label: 'Tudo' },
] as const satisfies readonly { value: KindChoice; label: string; short?: string }[];

const PAGE_SIZE = 100;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [value, ms]);
  return debounced;
}

function groupByDay(rows: readonly HistoryRow[]): [string, HistoryRow[]][] {
  const groups: [string, HistoryRow[]][] = [];
  for (const row of rows) {
    const key = dayKey(row.localEnd);
    const last = groups.at(-1);
    if (last && last[0] === key) last[1].push(row);
    else groups.push([key, [row]]);
  }
  return groups;
}

function PlayRow({ row }: { row: HistoryRow }) {
  const short = row.msPlayed < STREAM_THRESHOLD_MS;
  const interrupted = row.reasonEnd !== null && row.reasonEnd !== 'trackdone';
  const detail = [row.artist, row.album].filter(Boolean).join(' · ');
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5">
      <span className="numeric text-footnote text-text-3">{formatLocalTime(row.localEnd)}</span>
      <span className="min-w-0">
        <span className="block truncate text-callout">{row.track}</span>
        <span className="block truncate text-footnote text-text-2">{detail}</span>
      </span>
      <span className="text-right">
        <span className={`numeric block text-footnote ${short ? 'text-text-3' : 'text-text-2'}`}>
          {formatClock(row.msPlayed)}
        </span>
        {(short || interrupted || row.source === 'basic') && (
          <span className="block text-caption tracking-normal text-text-3 normal-case">
            {short ? 'menos de 30 s' : interrupted ? 'interrompida' : 'dados da conta'}
          </span>
        )}
      </span>
    </li>
  );
}

export function HistoryPage() {
  const { client, status, summary } = useLibrary();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<KindChoice>('track');
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const query = useDebounced(text.trim(), 250);

  const params = {
    ...(query ? { text: query } : {}),
    ...(kind === 'all' ? {} : { kind }),
    limit: PAGE_SIZE,
  };

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    void client
      .call('history', {
        ...(query ? { text: query } : {}),
        ...(kind === 'all' ? {} : { kind }),
        limit: PAGE_SIZE,
      })
      .then((page) => {
        if (!lifecycle.active) return;
        setRows([...page.rows]);
        setTotal(page.total);
      });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, query, kind, summary]);

  const loadMore = async () => {
    const last = rows.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await client.call('history', {
        ...params,
        after: { tsEnd: last.tsEnd, id: last.id },
      });
      setRows((current) => [...current, ...page.rows]);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className="mx-auto max-w-[880px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
      <h1 className="font-display text-display font-semibold">Histórico</h1>
      <p className="mt-2 text-callout text-text-2">
        Cada reprodução registrada, da mais recente para a mais antiga.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <label htmlFor="history-search" className="sr-only">
          Buscar por faixa, artista ou álbum
        </label>
        <input
          id="history-search"
          type="search"
          placeholder="Buscar faixa, artista ou álbum"
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          className="w-full min-w-0 rounded-control bg-fill-1 px-3.5 py-2 text-callout text-text-1 placeholder:text-text-3 sm:w-80"
        />
        <SegmentedControl label="Tipo" segments={KINDS} value={kind} onChange={setKind} />
      </div>

      <p aria-live="polite" className="numeric mt-6 text-footnote text-text-2">
        {total === null ? '' : plural(total, 'reprodução', 'reproduções')}
        {query && total !== null ? ` para “${query}”` : ''}
      </p>

      {total === 0 && (summary?.records ?? 0) === 0 && (
        <p className="mt-6 text-callout text-text-2">
          Ainda não há histórico.{' '}
          <a href="#importar" className="text-text-1 underline">
            Importar dados
          </a>
        </p>
      )}

      <div className="mt-6 space-y-8">
        {groupByDay(rows).map(([day, items]) => (
          <section key={day} aria-label={formatLocalDateLong(items[0]?.localEnd ?? 0)}>
            <h2 className="eyebrow hairline border-b pb-2">
              {formatLocalDateLong(items[0]?.localEnd ?? 0)}
            </h2>
            <ol className="divide-y divide-separator">
              {items.map((row) => (
                <PlayRow key={row.id} row={row} />
              ))}
            </ol>
          </section>
        ))}
      </div>

      {total !== null && rows.length < total && (
        <div className="mt-8 flex items-center gap-4">
          <Button disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Carregando…' : 'Carregar mais'}
          </Button>
          <span className="numeric text-footnote text-text-3">
            {formatInteger(rows.length)} de {formatInteger(total)}
          </span>
        </div>
      )}
    </main>
  );
}
