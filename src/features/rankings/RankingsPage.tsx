import { useEffect, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import { formatDuration, formatInteger, formatLocalDate, plural } from '../../lib/format.ts';
import type { PeriodSpec } from '../../stats/period.ts';
import type {
  AlbumTrack,
  Ranking,
  RankingKind,
  RankingRow,
  RankingSort,
} from '../../stats/rankings.ts';
import { Button } from '../../ui/Button.tsx';
import { Cover } from '../../ui/Cover.tsx';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';
import { PeriodPicker } from '../overview/PeriodPicker.tsx';

const TITLE: Record<RankingKind, string> = {
  tracks: 'Faixas',
  artists: 'Artistas',
  albums: 'Álbuns',
};
const NOUN: Record<RankingKind, [string, string]> = {
  tracks: ['faixa', 'faixas'],
  artists: ['artista', 'artistas'],
  albums: ['álbum', 'álbuns'],
};

type LimitChoice = '10' | '25' | '50' | '100' | 'all';
const LIMITS = [
  { value: '10', label: 'Top 10' },
  { value: '25', label: 'Top 25' },
  { value: '50', label: 'Top 50' },
  { value: '100', label: 'Top 100' },
  { value: 'all', label: 'Todos' },
] as const satisfies readonly { value: LimitChoice; label: string }[];

const SORTS = [
  { value: 'streams', label: 'Streams' },
  { value: 'plays', label: 'Reproduções', short: 'Reprod.' },
  { value: 'time', label: 'Tempo ouvido', short: 'Tempo' },
] as const satisfies readonly { value: RankingSort; label: string; short?: string }[];

const PAGE = 200;

function dayLabel(localMs: number): string {
  return formatLocalDate(localMs);
}

function AlbumTracks({ albumId, period }: { albumId: number; period: PeriodSpec }) {
  const { client } = useLibrary();
  const [tracks, setTracks] = useState<AlbumTrack[] | null>(null);
  useEffect(() => {
    const lifecycle = { active: true };
    void client.call('albumTracks', { albumId, period }).then((result) => {
      if (lifecycle.active) setTracks(result);
    });
    return () => {
      lifecycle.active = false;
    };
  }, [client, albumId, period]);

  if (!tracks) return <p className="py-2 text-footnote text-text-3">Carregando…</p>;
  return (
    <ol className="space-y-1 py-2 text-footnote">
      {tracks.map((t, i) => (
        <li key={t.id} className="flex gap-3">
          <span className="numeric w-4 text-right text-text-3">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-text-1">{t.name}</span>
          <span className="numeric text-text-2">
            {formatInteger(t.streams)} · {formatDuration(t.msPlayed)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function metricClass(active: boolean) {
  return `numeric text-right ${active ? 'text-text-1' : 'text-text-2'}`;
}

function Row({
  row,
  kind,
  sort,
  period,
}: {
  row: RankingRow;
  kind: RankingKind;
  sort: RankingSort;
  period: PeriodSpec;
}) {
  const [open, setOpen] = useState(false);
  const subtitle =
    kind === 'tracks'
      ? [row.artist, row.album].filter(Boolean).join(' · ')
      : kind === 'albums'
        ? (row.artist ?? '')
        : plural(row.distinctTracks ?? 0, 'faixa', 'faixas');
  const primary =
    sort === 'streams'
      ? `${formatInteger(row.streams)} streams`
      : sort === 'plays'
        ? `${formatInteger(row.registeredPlays)} reproduções`
        : formatDuration(row.msPlayed);

  return (
    <li className="rounded-tile px-2 py-2 transition-colors hover:bg-fill-1/50">
      <div className="grid grid-cols-[1.75rem_2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 md:grid-cols-[2rem_2.75rem_minmax(0,1fr)_6rem_7rem_6rem_7rem_7rem]">
        <span className="numeric text-right text-footnote text-text-3">{row.rank}</span>
        <Cover
          name={kind === 'tracks' ? (row.album ?? row.name) : row.name}
          shape={kind === 'artists' ? 'circle' : 'square'}
          className="size-11"
        />
        <span className="min-w-0">
          <span className="block truncate text-callout font-medium">{row.name}</span>
          <span className="block truncate text-footnote text-text-2">{subtitle}</span>
          {kind === 'albums' && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                setOpen((v) => !v);
              }}
              className="mt-1 text-footnote text-text-2 hover:text-text-1"
            >
              {open ? 'Ocultar faixas' : 'Faixas mais ouvidas'}
            </button>
          )}
        </span>
        {/* Phone: one metric, the active sort. */}
        <span className="numeric text-right text-callout md:hidden">{primary}</span>
        <span className={`hidden md:block ${metricClass(sort === 'streams')}`}>
          {formatInteger(row.streams)}
        </span>
        <span className={`hidden md:block ${metricClass(sort === 'plays')}`}>
          {formatInteger(row.registeredPlays)}
        </span>
        <span className={`hidden md:block ${metricClass(sort === 'time')}`}>
          {formatDuration(row.msPlayed)}
        </span>
        <span className="numeric hidden text-right text-footnote text-text-3 md:block">
          {dayLabel(row.firstPlay)}
        </span>
        <span className="numeric hidden text-right text-footnote text-text-3 md:block">
          {dayLabel(row.lastPlay)}
        </span>
      </div>
      {open && (
        <div className="mt-2 pl-[5.25rem] md:pl-[5.5rem]">
          <AlbumTracks albumId={row.id} period={period} />
        </div>
      )}
    </li>
  );
}

export function RankingsPage({
  kind,
  period,
  onPeriodChange,
}: {
  kind: RankingKind;
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
}) {
  const { client, status, summary } = useLibrary();
  const [limit, setLimit] = useState<LimitChoice>('25');
  const [sort, setSort] = useState<RankingSort>('streams');
  const [data, setData] = useState<Ranking | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    client
      .call('ranking', { kind, period, sort, limit: limit === 'all' ? null : Number(limit) })
      .then((result) => {
        if (!lifecycle.active) return;
        if (result) {
          setData(result);
          setShown(PAGE);
          setState('ready');
        } else if (period.preset !== 'custom') {
          setState('empty');
        }
      })
      .catch(() => {
        if (lifecycle.active) setState('error');
      });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, kind, period, sort, limit, summary]);

  const [one, many] = NOUN[kind];
  const header = (
    <div className="hairline mb-1 hidden grid-cols-[2rem_2.75rem_minmax(0,1fr)_6rem_7rem_6rem_7rem_7rem] gap-x-3 border-b px-2 pb-3 md:grid">
      <span />
      <span />
      <span className="eyebrow">
        {kind === 'tracks' ? 'Faixa' : kind === 'artists' ? 'Artista' : 'Álbum'}
      </span>
      <span className="eyebrow text-right">Streams</span>
      <span className="eyebrow text-right">Reproduções</span>
      <span className="eyebrow text-right">Tempo</span>
      <span className="eyebrow text-right">Primeira</span>
      <span className="eyebrow text-right">Última</span>
    </div>
  );

  return (
    <main className="mx-auto max-w-[1120px] px-4 pt-6 pb-20 sm:px-6 lg:px-10 lg:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-8">
        <div>
          <h1 className="font-display text-display font-semibold">{TITLE[kind]}</h1>
          {data && state === 'ready' && (
            <p className="numeric mt-2 text-callout text-text-2">
              {formatLocalDate(data.period.from)} – {formatLocalDate(data.period.to - 1)} ·{' '}
              {plural(data.total, one, many)} com reprodução
            </p>
          )}
        </div>
        {state === 'ready' && data && (
          <PeriodPicker
            value={period}
            onChange={onPeriodChange}
            dataYear={Number(data.dataLastDay.slice(0, 4))}
            bounds={{ first: data.dataFirstDay, last: data.dataLastDay }}
          />
        )}
      </header>

      {state === 'empty' && (
        <p className="mt-16 text-callout text-text-2">
          Ainda não há histórico.{' '}
          <a href="#importar" className="text-text-1 underline">
            Importar dados
          </a>
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="mt-16 text-callout text-critical">
          Não foi possível montar o ranking. Recarregue a página.
        </p>
      )}

      {state === 'ready' && data && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <SegmentedControl
              label="Quantidade"
              segments={LIMITS}
              value={limit}
              onChange={setLimit}
            />
            <SegmentedControl
              label="Ordenar por"
              segments={SORTS}
              value={sort}
              onChange={setSort}
            />
          </div>

          <div className="card mt-6 p-3 sm:p-4">
            {header}
            {data.rows.length === 0 ? (
              <p className="py-6 text-callout text-text-2">Nenhuma reprodução no período.</p>
            ) : (
              <ol aria-label={`Ranking de ${many}`} className="fade">
                {data.rows.slice(0, shown).map((row) => (
                  <Row key={row.id} row={row} kind={kind} sort={sort} period={period} />
                ))}
              </ol>
            )}
            {data.rows.length > shown && (
              <div className="mt-4 flex items-center gap-4 px-2 pb-2">
                <Button
                  onClick={() => {
                    setShown((n) => n + PAGE);
                  }}
                >
                  Mostrar mais
                </Button>
                <span className="numeric text-footnote text-text-3">
                  {formatInteger(shown)} de {formatInteger(data.rows.length)}
                </span>
              </div>
            )}
          </div>

          <p className="mt-10 max-w-[64ch] text-footnote text-text-3">
            Streams são reproduções de 30 s ou mais; reproduções incluem qualquer duração acima de
            zero. Primeira e última reprodução consideram todo o histórico, não só o período.
            Empates são decididos pelo tempo ouvido.
          </p>
        </>
      )}
    </main>
  );
}
