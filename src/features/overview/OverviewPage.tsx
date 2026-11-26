import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Disc3,
  Flame,
  Mic2,
  Music2,
  PlayCircle,
  Repeat,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import {
  formatDecimal,
  formatDuration,
  formatInteger,
  formatLocalDate,
  formatLocalDateLong,
  formatPercent,
  plural,
} from '../../lib/format.ts';
import { MS_PER_MINUTE, msToDays, msToHours } from '../../lib/units.ts';
import type { Analytics } from '../../stats/analytics.ts';
import type { Overview, RankedEntry } from '../../stats/overview.ts';
import {
  dayKey,
  parseDayKey,
  previousPeriod,
  type Granularity,
  type PeriodSpec,
} from '../../stats/period.ts';
import { identityTraits, joinPhrases } from '../../stats/personality.ts';
import { BarChart } from '../../ui/BarChart.tsx';
import { LinkButton } from '../../ui/Button.tsx';
import { Cover } from '../../ui/Cover.tsx';
import { RankList } from '../../ui/RankList.tsx';
import { Section } from '../../ui/Section.tsx';
import { ShareBars } from '../../ui/ShareBars.tsx';
import { ScreenSkeleton, Skeleton } from '../../ui/Skeleton.tsx';
import { StatTile } from '../../ui/StatTile.tsx';
import { EmptyLibrary, LoadError, Page } from '../analytics/PageHeader.tsx';
import { usePeriodQuery } from '../analytics/usePeriodQuery.ts';
import { periodLabel } from '../export/period-label.ts';
import { labelEvery, seriesLabel } from '../series-labels.ts';
import { identityLead, relativeChange } from './identity.ts';
import { PeriodPicker } from './PeriodPicker.tsx';

function formatDayKey(key: string, long = false): string {
  const ms = parseDayKey(key);
  if (ms === null) return key;
  return long ? formatLocalDateLong(ms) : formatLocalDate(ms);
}

const SERIES_CAPTION: Record<Granularity, string> = {
  year: 'Tempo ouvido por ano',
  month: 'Tempo ouvido por mês',
  week: 'Tempo ouvido por semana',
  day: 'Tempo ouvido por dia',
};

const stagger = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

type Delta = { text: string; direction: 'up' | 'down' | 'flat' } | null;

function delta(current: number, previous: number | undefined): Delta {
  if (previous === undefined) return null;
  const change = relativeChange(current, previous);
  if (change === null) return null;
  const direction = Math.abs(change) < 0.005 ? 'flat' : change > 0 ? 'up' : 'down';
  return {
    text: `${change > 0 ? '+' : change < 0 ? '−' : ''}${formatPercent(Math.abs(change))} vs. período anterior`,
    direction,
  };
}

// ── Hero ──────────────────────────────────────────────────────────────────

function CoverMosaic({ data }: { data: Overview }) {
  // Albums first; artists fill in when the export has few album names.
  const names = [
    ...data.topAlbums.map((a) => ({ name: a.name, by: a.artist })),
    ...data.topArtists.map((a) => ({ name: a.name, by: null })),
  ].slice(0, 6);
  if (names.length === 0) return null;
  const slots = [
    'col-start-1 row-start-1 row-span-2 col-span-2',
    'col-start-3 row-start-1',
    'col-start-3 row-start-2',
    'col-start-1 row-start-3',
    'col-start-2 row-start-3',
    'col-start-3 row-start-3',
  ];
  return (
    <div
      aria-hidden
      className="grid aspect-square w-full max-w-[420px] grid-cols-3 grid-rows-3 gap-2.5 sm:gap-3"
    >
      {names.map((item, i) => (
        <div
          key={`${item.name}-${String(i)}`}
          className={`enter ${slots[i] ?? ''}`}
          style={stagger(i + 2)}
        >
          <Cover
            name={item.name}
            byline={item.by}
            variant={i === 0 ? 'title' : 'initials'}
            className="motion-drift size-full shadow-[0_18px_40px_-18px_rgb(0_0_0/0.7)]"
            style={stagger(i)}
          />
        </div>
      ))}
    </div>
  );
}

function Hero({
  data,
  analytics,
  spec,
  displayName,
}: {
  data: Overview;
  analytics: Analytics | null;
  spec: PeriodSpec;
  displayName: string;
}) {
  const traits = analytics ? identityTraits(analytics) : [];
  const label = periodLabel(spec, data.dataLastDay);
  return (
    <section
      aria-labelledby="hero-title"
      className="card ambient relative overflow-hidden rounded-panel p-6 sm:p-10 lg:p-12"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0">
          <p className="eyebrow enter" style={stagger(0)}>
            Sua identidade musical
          </p>
          <h1
            id="hero-title"
            className="enter mt-3 font-display text-display font-semibold text-balance"
            style={stagger(1)}
          >
            Sua música, sua história.
          </h1>
          <p className="enter numeric mt-4 text-callout text-text-2" style={stagger(2)}>
            {displayName && <span className="font-medium text-text-1">{displayName} · </span>}
            {label}
          </p>
          <div className="mt-8 min-h-[4.5rem] max-w-[34ch]">
            {analytics ? (
              traits.length > 0 && (
                <p className="fade font-display text-title-2 font-medium text-text-2">
                  {identityLead(spec, data.dataLastDay)}{' '}
                  <span className="text-text-1">{joinPhrases(traits.map((t) => t.phrase))}</span>.
                </p>
              )
            ) : (
              <div className="space-y-2.5" aria-hidden>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
              </div>
            )}
            {traits.length > 0 && (
              <p className="fade mt-3 text-footnote text-text-3">
                Com base em: {traits.map((t) => t.basis).join(' · ')}.
              </p>
            )}
          </div>
          <div className="enter mt-8 flex flex-wrap gap-3" style={stagger(4)}>
            <LinkButton href="#retrospectiva" variant="primary">
              <Sparkles aria-hidden size={16} strokeWidth={2} />
              Abrir retrospectiva
            </LinkButton>
            <LinkButton href="#sua-musica" variant="secondary">
              Sua música
            </LinkButton>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <CoverMosaic data={data} />
        </div>
      </div>
    </section>
  );
}

// ── Statistics ────────────────────────────────────────────────────────────

function Stats({ data, previous }: { data: Overview; previous: Overview | null }) {
  const minutes = data.msPlayed / MS_PER_MINUTE;
  const topArtist = data.topArtists[0];
  const topTrack = data.topTracks[0];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatTile
        size="hero"
        icon={Clock3}
        label="Tempo ouvido"
        value={formatInteger(minutes)}
        unit="minutos"
        note={`${formatInteger(msToHours(data.msPlayed))} horas · ${formatDecimal(msToDays(data.msPlayed), 1)} dias de reprodução contínua`}
        delta={delta(data.msPlayed, previous?.msPlayed)}
        className="col-span-2 min-h-[15rem] lg:row-span-2"
        style={stagger(0)}
      />
      <StatTile
        size="large"
        textual
        icon={Mic2}
        label="Artista mais ouvido"
        value={topArtist?.name ?? '—'}
        note={
          topArtist
            ? `${plural(topArtist.streams, 'stream', 'streams')} · ${formatDuration(topArtist.msPlayed)}`
            : 'Sem streams no período'
        }
        media={topArtist && <Cover name={topArtist.name} shape="circle" className="mb-4 size-14" />}
        className="col-span-2"
        style={stagger(1)}
      />
      <StatTile
        icon={PlayCircle}
        label="Streams"
        value={formatInteger(data.streams)}
        note="Reproduções de 30 s ou mais"
        delta={delta(data.streams, previous?.streams)}
        style={stagger(2)}
      />
      <StatTile
        icon={Users}
        label="Artistas"
        value={formatInteger(data.distinctArtists)}
        note="Diferentes no período"
        delta={delta(data.distinctArtists, previous?.distinctArtists)}
        style={stagger(3)}
      />
      <StatTile
        size="large"
        textual
        icon={Repeat}
        label="Música mais ouvida"
        value={topTrack?.name ?? '—'}
        note={
          topTrack
            ? `${topTrack.artist ?? ''} · ${plural(topTrack.streams, 'stream', 'streams')}`
            : 'Sem streams no período'
        }
        media={
          topTrack && <Cover name={topTrack.album ?? topTrack.name} className="mb-4 size-14" />
        }
        className="col-span-2"
        style={stagger(4)}
      />
      <StatTile
        icon={Disc3}
        label="Álbuns"
        value={formatInteger(data.distinctAlbums)}
        note="Diferentes no período"
        style={stagger(5)}
      />
      <StatTile
        icon={Music2}
        label="Faixas"
        value={formatInteger(data.distinctTracks)}
        note="Diferentes no período"
        style={stagger(6)}
      />
      <StatTile
        icon={CalendarDays}
        label="Média diária"
        value={formatInteger(data.dailyAverageMs / MS_PER_MINUTE)}
        unit="min"
        note={`${plural(data.listeningDays, 'dia', 'dias')} com escuta em ${formatInteger(data.period.days)}`}
        style={stagger(7)}
      />
      <StatTile
        icon={PlayCircle}
        label="Reproduções registradas"
        value={formatInteger(data.registeredPlays)}
        note="Qualquer reprodução acima de 0 s"
        style={stagger(8)}
      />
      <StatTile
        icon={Flame}
        label="Dia de pico"
        value={data.peakDay ? formatInteger(data.peakDay.msPlayed / MS_PER_MINUTE) : '0'}
        unit="min"
        note={data.peakDay ? formatDayKey(data.peakDay.day, true) : 'Sem reproduções no período'}
        className="col-span-2"
        style={stagger(9)}
      />
    </dl>
  );
}

// ── Top artists ───────────────────────────────────────────────────────────

function TopArtists({ data }: { data: Overview }) {
  const [first, ...rest] = data.topArtists;
  if (!first) return null;
  const share = (e: RankedEntry) => (data.streams > 0 ? e.streams / data.streams : 0);
  return (
    <Section
      title="Artistas mais ouvidos"
      caption="Por streams · participação nos streams do período"
      surface={false}
      action={
        <LinkButton href="#artistas" variant="ghost" className="-mr-2 px-2.5 py-1.5 text-footnote">
          Ver todos os artistas
          <ArrowRight aria-hidden size={14} />
        </LinkButton>
      }
    >
      <ol
        aria-label="Artistas mais ouvidos"
        className="grid gap-3 sm:gap-4 md:grid-cols-4 md:grid-rows-2"
      >
        <li
          className="card card-interactive enter relative overflow-hidden md:col-span-2 md:row-span-2"
          style={stagger(0)}
        >
          <Cover
            name={first.name}
            variant="blank"
            className="aspect-[4/3] w-full rounded-none md:aspect-auto md:h-full md:min-h-[22rem]"
          />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5 sm:p-6">
            <span className="numeric rounded-pill bg-black/35 px-2.5 py-1 text-footnote font-semibold text-white backdrop-blur-md">
              Nº 1
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-5 pt-16 text-white sm:p-6 sm:pt-20">
            <p className="truncate font-display text-title-1 font-semibold">{first.name}</p>
            <p className="numeric mt-1 text-footnote text-white/80">
              {plural(first.streams, 'stream', 'streams')} · {formatPercent(share(first))} dos
              streams · {formatDuration(first.msPlayed)}
            </p>
          </div>
        </li>
        {rest.map((artist, i) => (
          <li
            key={artist.id}
            className="card card-interactive enter flex min-w-0 items-center gap-4 p-4 md:flex-col md:items-start md:justify-between md:p-5"
            style={stagger(i + 1)}
          >
            <Cover name={artist.name} shape="circle" className="size-14 md:size-16" />
            <div className="min-w-0 flex-1 md:w-full md:flex-none">
              <p className="numeric text-footnote text-text-3">Nº {i + 2}</p>
              <p className="truncate text-callout font-semibold">{artist.name}</p>
              <p className="numeric mt-0.5 truncate text-footnote text-text-2">
                {formatInteger(artist.streams)} streams · {formatPercent(share(artist))}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// ── Tracks, albums, activity ──────────────────────────────────────────────

function TopTracks({ data }: { data: Overview }) {
  return (
    <Section
      title="Faixas mais ouvidas"
      caption="Por streams · tempo ouvido abaixo"
      action={
        <LinkButton href="#faixas" variant="ghost" className="-mr-2 px-2.5 py-1.5 text-footnote">
          Ver todas
          <ArrowRight aria-hidden size={14} />
        </LinkButton>
      }
    >
      <RankList
        label="Faixas mais ouvidas"
        art="square"
        items={data.topTracks.map((t) => ({
          key: String(t.id),
          title: t.name,
          subtitle: [t.artist, t.album].filter(Boolean).join(' · '),
          metric: formatInteger(t.streams),
          secondary: formatDuration(t.msPlayed),
          cover: t.album ?? t.name,
        }))}
      />
    </Section>
  );
}

function TopAlbums({ data }: { data: Overview }) {
  return (
    <Section
      title="Álbuns mais ouvidos"
      caption="Por streams"
      surface={false}
      action={
        <LinkButton href="#albuns" variant="ghost" className="-mr-2 px-2.5 py-1.5 text-footnote">
          Ver todos
          <ArrowRight aria-hidden size={14} />
        </LinkButton>
      }
    >
      {data.topAlbums.length > 0 ? (
        <ol
          aria-label="Álbuns mais ouvidos"
          className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5"
        >
          {data.topAlbums.map((album, i) => (
            <li key={album.id} className="enter group min-w-0" style={stagger(i)}>
              <Cover
                name={album.name}
                variant="title"
                byline={album.artist}
                className="aspect-square w-full shadow-[0_18px_36px_-20px_rgb(0_0_0/0.6)] transition-transform duration-300 ease-out group-hover:-translate-y-[calc(var(--motion-distance)*0.25)]"
              />
              <p className="mt-3 truncate text-callout font-medium">
                <span className="numeric mr-1.5 text-text-3">{i + 1}</span>
                {album.name}
              </p>
              <p className="truncate text-footnote text-text-2">
                {album.artist} · {formatInteger(album.streams)} streams
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="card p-6 text-footnote text-text-3">Sem informação de álbum no período.</p>
      )}
    </Section>
  );
}

function Rhythm({ data, analytics }: { data: Overview; analytics: Analytics | null }) {
  const hourTotal = data.hours.reduce((a, b) => a + b, 0);
  const parts = analytics?.dayparts;
  return (
    <Section title="Ritmo do dia" caption="Parcela do tempo ouvido">
      <BarChart
        title="Tempo ouvido por hora do dia"
        values={data.hours}
        labels={data.hours.map((_, h) => `${String(h)}h`)}
        labelEvery={6}
        height={150}
        highlightMax={false}
        formatValue={(v) => formatPercent(hourTotal > 0 ? v / hourTotal : 0)}
      />
      <div className="hairline mt-6 border-t pt-5">
        {parts ? (
          <ShareBars
            label="Tempo ouvido por parte do dia"
            highlightMax={false}
            items={[
              { key: 'night', label: 'Madrugada · 0h–5h', share: parts.night },
              { key: 'morning', label: 'Manhã · 6h–11h', share: parts.morning },
              { key: 'afternoon', label: 'Tarde · 12h–17h', share: parts.afternoon },
              { key: 'evening', label: 'Noite · 18h–23h', share: parts.evening },
            ].map((p) => ({ ...p, value: formatPercent(p.share) }))}
          />
        ) : (
          <div className="space-y-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function OverTime({ data, analytics }: { data: Overview; analytics: Analytics | null }) {
  const values = data.series.map((p) => p.msPlayed / MS_PER_MINUTE);
  const every = labelEvery(data.series.length, data.period.granularity);
  return (
    <Section
      title="Ao longo do tempo"
      caption={`${SERIES_CAPTION[data.period.granularity]} · em destaque, o maior`}
    >
      <BarChart
        title={`${SERIES_CAPTION[data.period.granularity]} no período`}
        values={values}
        labels={data.series.map((p) => seriesLabel(p.key, data.period.granularity))}
        labelEvery={every}
        height={220}
        formatValue={(v) => `${formatInteger(v)} min`}
      />
      {analytics && (
        <dl className="hairline fade mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-5 sm:grid-cols-4">
          {[
            ['Dias úteis', `${formatInteger(analytics.weekdayAverageMs / MS_PER_MINUTE)} min/dia`],
            [
              'Fim de semana',
              `${formatInteger(analytics.weekendAverageMs / MS_PER_MINUTE)} min/dia`,
            ],
            ['Maior sequência', plural(analytics.longestStreak?.days ?? 0, 'dia', 'dias')],
            [
              'Hora mais ativa',
              analytics.mostActiveHour ? `${String(analytics.mostActiveHour.hour)}h` : '—',
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-footnote text-text-3">{label}</dt>
              <dd className="numeric mt-0.5 text-callout font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}

function Definitions() {
  const items = [
    ['Streams', 'Reproduções com 30 segundos ou mais.'],
    ['Reproduções registradas', 'Qualquer reprodução com duração maior que zero.'],
    ['Tempo ouvido', 'Soma do tempo efetivamente reproduzido.'],
    [
      'Data de cada reprodução',
      'O momento em que ela terminou, no fuso horário escolhido em Ajustes.',
    ],
    ['Rankings', 'Por streams; empates são decididos pelo tempo ouvido.'],
    [
      'O que fica de fora',
      'Podcasts e audiolivros não entram nas estatísticas de música. Os arquivos não trazem capas nem gêneros: as artes são geradas a partir dos nomes.',
    ],
  ] as const;
  return (
    <Section title="Como calculamos" surface={false}>
      <dl className="grid gap-x-10 gap-y-4 px-1 text-footnote sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([term, text]) => (
          <div key={term}>
            <dt className="font-medium text-text-1">{term}</dt>
            <dd className="text-text-2">{text}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function OverviewContent({
  data,
  spec,
  displayName,
}: {
  data: Overview;
  spec: PeriodSpec;
  displayName: string;
}) {
  const { client } = useLibrary();
  const personality = usePeriodQuery('personality', spec);
  const analytics = personality.status === 'ready' ? personality.data.analytics : null;
  const [loaded, setLoaded] = useState<{ key: string; data: Overview | null }>({
    key: '',
    data: null,
  });
  const previousSpec = previousPeriod(data.period, data.dataFirstDay);
  const previousKey =
    previousSpec?.preset === 'custom' ? `${previousSpec.start}:${previousSpec.end}` : '';

  useEffect(() => {
    if (!previousSpec) return;
    const lifecycle = { active: true };
    void client.call('overview', previousSpec).then((result) => {
      if (lifecycle.active) setLoaded({ key: previousKey, data: result });
    });
    return () => {
      lifecycle.active = false;
    };
    // previousKey captures previousSpec by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, previousKey]);

  return (
    <div className="space-y-12 sm:space-y-16">
      <Hero data={data} analytics={analytics} spec={spec} displayName={displayName} />
      <Stats
        data={data}
        previous={previousKey && loaded.key === previousKey ? loaded.data : null}
      />
      <TopArtists data={data} />
      <div className="grid gap-12 sm:gap-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
        <TopTracks data={data} />
        <Rhythm data={data} analytics={analytics} />
      </div>
      <TopAlbums data={data} />
      <OverTime data={data} analytics={analytics} />
      <Definitions />
    </div>
  );
}

export function OverviewPage({
  period: spec,
  onPeriodChange: setSpec,
  displayName = '',
}: {
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
  displayName?: string;
}) {
  const { client, status, summary } = useLibrary();
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    const timer = setTimeout(() => {
      if (lifecycle.active) setUpdating(true);
    }, 150);
    client
      .call('overview', spec)
      .then((result) => {
        if (!lifecycle.active) return;
        setUpdating(false);
        // An invalid custom range keeps the previous figures on screen.
        if (result) {
          setData(result);
          setState('ready');
        } else if (spec.preset !== 'custom') {
          setState('empty');
        }
      })
      .catch(() => {
        if (lifecycle.active) setState('error');
      })
      .finally(() => {
        clearTimeout(timer);
      });
    return () => {
      lifecycle.active = false;
      clearTimeout(timer);
    };
  }, [client, status, spec, summary]);

  const dataYear = data ? Number(data.dataLastDay.slice(0, 4)) : null;
  const periodLine = data
    ? `${formatDayKey(dayKey(data.period.from))} – ${formatDayKey(dayKey(data.period.to - 1))}`
    : '';

  return (
    <Page wide>
      {state !== 'ready' && (
        <header className="pt-2 pb-8">
          <h1 className="font-display text-display font-semibold">Visão geral</h1>
        </header>
      )}
      {state === 'ready' && data && (
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-2 pb-6">
          <div>
            <p className="eyebrow">Visão geral</p>
            <p className="numeric mt-1.5 text-callout text-text-2">
              {periodLine} · {plural(data.period.days, 'dia', 'dias')}
            </p>
          </div>
          <PeriodPicker
            value={spec}
            onChange={setSpec}
            dataYear={dataYear}
            bounds={{ first: data.dataFirstDay, last: data.dataLastDay }}
          />
        </div>
      )}

      {state === 'loading' && <ScreenSkeleton label="Calculando a visão geral…" />}
      {state === 'empty' && <EmptyLibrary />}
      {state === 'error' && (
        <LoadError>Não foi possível calcular as estatísticas. Recarregue a página.</LoadError>
      )}
      {state === 'ready' && data && (
        <div
          aria-busy={updating}
          className={`transition-opacity duration-200 ${updating ? 'opacity-50' : 'opacity-100'}`}
        >
          <OverviewContent data={data} spec={spec} displayName={displayName} />
        </div>
      )}
    </Page>
  );
}
