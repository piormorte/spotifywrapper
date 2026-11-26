import { ChevronLeft, ChevronRight, RotateCcw, Share, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useLibrary } from '../../app/library-context.ts';
import { Mark } from '../../app/Wordmark.tsx';
import {
  formatDecimal,
  formatDuration,
  formatInteger,
  formatLocalDateLong,
  formatPercent,
  plural,
} from '../../lib/format.ts';
import { MS_PER_MINUTE, msToDays, msToHours } from '../../lib/units.ts';
import type { Analytics } from '../../stats/analytics.ts';
import type { Overview } from '../../stats/overview.ts';
import { parseDayKey, type PeriodSpec } from '../../stats/period.ts';
import { identityTraits, joinPhrases, type Observation } from '../../stats/personality.ts';
import { LinkButton, Button } from '../../ui/Button.tsx';
import { Cover } from '../../ui/Cover.tsx';
import { coverArt } from '../../ui/cover-art.ts';
import { useCountUp } from '../../ui/motion.ts';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';
import { usePeriodQuery } from '../analytics/usePeriodQuery.ts';
import { periodLabel } from '../export/period-label.ts';
import { identityLead } from '../overview/identity.ts';

/**
 * Retrospectiva: the listening history told as a sequence of full-screen
 * slides. Every figure comes from the same overview and analytics as the rest
 * of the app; a slide whose data is missing is left out rather than padded.
 */

interface Story {
  readonly overview: Overview;
  readonly analytics: Analytics;
  readonly observations: readonly Observation[];
}

interface SlideProps {
  readonly story: Story;
  readonly active: boolean;
  readonly spec: PeriodSpec;
}

const s = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

function titleFor(spec: PeriodSpec, lastDay: string): string {
  switch (spec.preset) {
    case 'all':
      return 'Sua história em música';
    case 'year':
      return `Seu ${lastDay.slice(0, 4)} em música`;
    case '12m':
      return 'Seus últimos 12 meses em música';
    case '6m':
      return 'Seus últimos 6 meses em música';
    case '30d':
      return 'Seus últimos 30 dias em música';
    case 'custom':
      return 'Seu período em música';
  }
}

/** Animated entrance for slide content, replayed each time the slide is shown. */
function Reveal({
  active,
  i = 0,
  className = '',
  children,
}: {
  active: boolean;
  i?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${active ? 'enter' : 'opacity-0'} ${className}`} style={s(i)}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow text-accent">{children}</p>;
}

// ── Slides ────────────────────────────────────────────────────────────────

function IntroSlide({
  story,
  active,
  spec,
  displayName,
  onPeriodChange,
}: SlideProps & { displayName: string; onPeriodChange: (spec: PeriodSpec) => void }) {
  const o = story.overview;
  const names = [
    ...o.topAlbums.map((a) => ({ name: a.name, by: a.artist })),
    ...o.topArtists.map((a) => ({ name: a.name, by: null })),
  ].slice(0, 7);
  const spots: readonly CSSProperties[] = [
    { left: '4%', top: '8%', width: '30%', ['--drift-rotate' as string]: '-6deg' },
    { right: '6%', top: '4%', width: '24%', ['--drift-rotate' as string]: '5deg' },
    { left: '38%', top: '-4%', width: '18%', ['--drift-rotate' as string]: '2deg' },
    { right: '2%', bottom: '18%', width: '28%', ['--drift-rotate' as string]: '-4deg' },
    { left: '-2%', bottom: '10%', width: '22%', ['--drift-rotate' as string]: '7deg' },
    { left: '30%', bottom: '-6%', width: '20%', ['--drift-rotate' as string]: '-3deg' },
    { right: '30%', bottom: '4%', width: '14%', ['--drift-rotate' as string]: '4deg' },
  ];
  const lastYear = o.dataLastDay.slice(0, 4);
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-6 pt-20 pb-28 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
        {names.map((n, i) => (
          <div
            key={`${n.name}-${String(i)}`}
            className={`absolute ${active ? 'enter' : 'opacity-0'}`}
            style={{ ...spots[i], ...s(i + 1) }}
          >
            <Cover
              name={n.name}
              byline={n.by}
              variant={i < 2 ? 'title' : 'initials'}
              className="motion-drift aspect-square w-full shadow-[0_30px_60px_-24px_rgb(0_0_0/0.9)]"
              style={{
                ...s(i),
                ...spots[i],
                left: undefined,
                right: undefined,
                top: undefined,
                bottom: undefined,
                width: undefined,
              }}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_50%,rgb(6_6_7/0.92)_0%,rgb(6_6_7/0.55)_60%,transparent_100%)]" />
      </div>
      <div className="relative max-w-[900px]">
        <Reveal active={active} i={0}>
          <Eyebrow>Retrospectiva · {periodLabel(spec, o.dataLastDay)}</Eyebrow>
        </Reveal>
        <Reveal active={active} i={1}>
          <h1 className="mt-4 font-display text-hero font-semibold text-balance">
            {titleFor(spec, o.dataLastDay)}
          </h1>
        </Reveal>
        {displayName && (
          <Reveal active={active} i={2}>
            <p className="mt-5 text-title-3 text-text-2">Feita para {displayName}.</p>
          </Reveal>
        )}
      </div>
      <Reveal active={active} i={3} className="relative mt-10">
        <SegmentedControl
          label="Período da retrospectiva"
          value={spec.preset === 'custom' ? 'all' : spec.preset}
          onChange={(preset) => {
            onPeriodChange({ preset });
          }}
          segments={[
            { value: 'all', label: 'Tudo' },
            { value: 'year', label: lastYear },
            { value: '12m', label: '12 meses' },
            { value: '30d', label: '30 dias' },
          ]}
        />
      </Reveal>
    </div>
  );
}

function TimeSlide({ story, active }: SlideProps) {
  const o = story.overview;
  const minutes = Math.round(o.msPlayed / MS_PER_MINUTE);
  const shown = useCountUp(minutes, active);
  const peak = o.peakDay;
  const peakMs = peak ? parseDayKey(peak.day) : null;
  return (
    <div className="flex min-h-full flex-col justify-center px-6 pt-20 pb-28 sm:px-12 lg:px-20">
      <Reveal active={active}>
        <Eyebrow>Seu tempo ouvindo</Eyebrow>
      </Reveal>
      <Reveal active={active} i={1}>
        <p className="mt-4 text-title-2 text-text-2">Você ouviu</p>
        <p className="numeric mt-2 font-display text-mega font-[250] break-all" aria-hidden>
          {formatInteger(shown)}
        </p>
        <p className="sr-only">{formatInteger(minutes)} minutos</p>
        <p className="mt-3 font-display text-title-1 font-semibold" aria-hidden>
          minutos de música
        </p>
      </Reveal>
      <Reveal active={active} i={3} className="mt-10 max-w-[40ch] text-title-3 text-text-2">
        <p>
          São {plural(Math.round(msToHours(o.msPlayed)), 'hora', 'horas')}, ou{' '}
          <span className="text-text-1">{formatDecimal(msToDays(o.msPlayed), 1)} dias</span> sem
          parar.
        </p>
        {peak && peakMs !== null && (
          <p className="mt-3 text-callout text-text-3">
            Seu dia de pico foi {formatLocalDateLong(peakMs)}, com{' '}
            {formatInteger(peak.msPlayed / MS_PER_MINUTE)} minutos.
          </p>
        )}
      </Reveal>
    </div>
  );
}

function ArtistSlide({ story, active }: SlideProps) {
  const o = story.overview;
  const [top, ...rest] = o.topArtists;
  if (!top) return null;
  const share = o.streams > 0 ? top.streams / o.streams : 0;
  return (
    <div className="grid min-h-full content-center items-center gap-8 px-6 pt-20 pb-28 sm:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:px-20">
      <Reveal
        active={active}
        i={1}
        className="mx-auto w-full max-w-[min(38vh,440px)] lg:max-w-[min(60vh,440px)]"
      >
        <Cover
          name={top.name}
          variant="title"
          className="motion-drift aspect-square w-full shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)]"
        />
      </Reveal>
      <div className="min-w-0">
        <Reveal active={active}>
          <Eyebrow>Seu artista nº 1</Eyebrow>
        </Reveal>
        <Reveal active={active} i={2}>
          <h2 className="mt-3 font-display text-display font-semibold text-balance [overflow-wrap:anywhere]">
            {top.name}
          </h2>
        </Reveal>
        <Reveal active={active} i={3}>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-separator pt-6">
            {[
              ['Streams', formatInteger(top.streams)],
              ['Dos seus streams', formatPercent(share)],
              ['Tempo ouvido', formatDuration(top.msPlayed)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-footnote text-text-3">{label}</dt>
                <dd className="numeric mt-1 font-display text-title-1 font-light">{value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        {rest.length > 0 && (
          <Reveal active={active} i={4}>
            <p className="mt-8 text-footnote text-text-3">Também no seu top</p>
            <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-2" start={2}>
              {rest.map((a, i) => (
                <li key={a.id} className="flex items-center gap-2 text-callout">
                  <span className="numeric text-text-3">{i + 2}</span>
                  <span className="max-w-[14ch] truncate">{a.name}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        )}
      </div>
    </div>
  );
}

function SoundtrackSlide({ story, active }: SlideProps) {
  const tracks = story.overview.topTracks;
  return (
    <div className="flex min-h-full flex-col justify-center px-6 pt-20 pb-28 sm:px-12 lg:px-20">
      <Reveal active={active}>
        <Eyebrow>Sua trilha sonora</Eyebrow>
        <h2 className="mt-3 font-display text-display font-semibold">As faixas que mais tocaram</h2>
      </Reveal>
      <ol className="mt-10 max-w-[760px] space-y-2 sm:space-y-3">
        {tracks.map((t, i) => (
          <li key={t.id}>
            <Reveal
              active={active}
              i={i + 2}
              className={`flex items-center gap-4 rounded-card p-2 sm:gap-5 ${i === 0 ? 'bg-white/[0.06] p-3 sm:p-4' : ''}`}
            >
              <span
                className={`numeric w-7 shrink-0 text-right font-display ${i === 0 ? 'text-title-1 font-semibold text-accent' : 'text-title-3 text-text-3'}`}
              >
                {i + 1}
              </span>
              <Cover
                name={t.album ?? t.name}
                className={`motion-drift ${i === 0 ? 'size-16 sm:size-20' : 'size-12 sm:size-14'}`}
                style={s(i)}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate font-semibold ${i === 0 ? 'text-title-2' : 'text-body'}`}
                >
                  {t.name}
                </span>
                <span className="block truncate text-footnote text-text-2">
                  {[t.artist, t.album].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="numeric shrink-0 text-right text-footnote text-text-2">
                {plural(t.streams, 'stream', 'streams')}
              </span>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TasteSlide({ story, active }: SlideProps) {
  const { overview: o, analytics: a } = story;
  const total = o.streams;
  const parts = o.topArtists.map((artist) => ({
    name: artist.name,
    share: total > 0 ? artist.streams / total : 0,
  }));
  const rest = Math.max(0, 1 - parts.reduce((sum, p) => sum + p.share, 0));
  const periodStartsLater = a.period.from > (parseDayKey(a.dataFirstDay) ?? 0);
  const artists = useCountUp(a.diversity.artists, active, 1200);
  return (
    <div className="flex min-h-full flex-col justify-center px-6 pt-20 pb-28 sm:px-12 lg:px-20">
      <Reveal active={active}>
        <Eyebrow>Seu gosto musical</Eyebrow>
      </Reveal>
      <Reveal active={active} i={1}>
        <p className="numeric mt-4 font-display text-hero font-[250]" aria-hidden>
          {formatInteger(artists)}
        </p>
        <h2 className="mt-2 font-display text-title-1 font-semibold">
          <span className="sr-only">{formatInteger(a.diversity.artists)} </span>
          artistas no seu repertório
        </h2>
        <p className="mt-3 max-w-[44ch] text-title-3 text-text-2">
          Sua escuta equivale a ouvir{' '}
          <span className="text-text-1">
            {plural(Math.round(a.diversity.effectiveArtists), 'artista', 'artistas')}
          </span>{' '}
          exatamente por igual.
        </p>
      </Reveal>
      <Reveal active={active} i={3} className="mt-10 max-w-[760px]">
        <p className="mb-3 text-footnote text-text-3">Participação nos streams</p>
        <div
          className="flex h-4 overflow-hidden rounded-pill bg-white/[0.06]"
          role="img"
          aria-label={`Os 5 artistas mais ouvidos somam ${formatPercent(1 - rest)} dos streams`}
        >
          {parts.map((p, i) => (
            <span
              key={p.name}
              className="motion-move h-full border-r-2 border-[#060607] transition-[width] duration-1000 ease-out last:border-r-0"
              style={{
                width: active ? `${String(p.share * 100)}%` : '0%',
                background:
                  i === 0 ? 'var(--accent)' : `rgb(255 255 255 / ${String(0.55 - i * 0.1)})`,
              }}
            />
          ))}
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-footnote">
          {parts.map((p, i) => (
            <li key={p.name} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{
                  background:
                    i === 0 ? 'var(--accent)' : `rgb(255 255 255 / ${String(0.55 - i * 0.1)})`,
                }}
              />
              <span className="max-w-[16ch] truncate">{p.name}</span>
              <span className="numeric text-text-3">{formatPercent(p.share)}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 text-text-3">
            <span aria-hidden className="size-2 rounded-full bg-white/[0.12]" />
            Todos os outros <span className="numeric">{formatPercent(rest)}</span>
          </li>
        </ul>
        {periodStartsLater && a.discovery.newArtists > 0 && (
          <p className="mt-8 text-callout text-text-2">
            <span className="text-text-1">
              {plural(a.discovery.newArtists, 'artista', 'artistas')}
            </span>{' '}
            {a.discovery.newArtists === 1 ? 'apareceu' : 'apareceram'} pela primeira vez no seu
            histórico neste período.
          </p>
        )}
        <p className="mt-6 text-footnote text-text-3">
          Os arquivos exportados não trazem gêneros. Seu gosto aqui é medido pela variedade de
          artistas.
        </p>
      </Reveal>
    </div>
  );
}

function PersonalitySlide({ story, active, spec }: SlideProps) {
  const traits = identityTraits(story.analytics);
  const picks = story.observations
    .filter((o) =>
      ['daypart', 'repetition', 'concentration', 'night', 'week', 'discovery'].includes(o.id),
    )
    .slice(0, 3);
  return (
    <div className="flex min-h-full flex-col justify-center px-6 pt-20 pb-28 sm:px-12 lg:px-20">
      <Reveal active={active}>
        <Eyebrow>Sua personalidade de escuta</Eyebrow>
      </Reveal>
      <Reveal active={active} i={1}>
        <h2 className="mt-4 max-w-[22ch] font-display text-display font-semibold text-balance">
          <span className="text-text-2">{identityLead(spec, story.overview.dataLastDay)} </span>
          {joinPhrases(traits.map((t) => t.phrase))}.
        </h2>
      </Reveal>
      <ul className="mt-10 grid max-w-[1000px] gap-3 md:grid-cols-3">
        {picks.map((o, i) => (
          <li key={o.id}>
            <Reveal
              active={active}
              i={i + 3}
              className="h-full rounded-card bg-white/[0.06] p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
            >
              <p className="font-semibold">{o.title}</p>
              <p className="mt-2 text-callout text-text-2">{o.text}</p>
            </Reveal>
          </li>
        ))}
      </ul>
      <Reveal active={active} i={6}>
        <p className="mt-6 text-footnote text-text-3">
          Observações com limites fixos, calculadas a partir dos seus números. Descrevem os dados,
          não você.
        </p>
      </Reveal>
    </div>
  );
}

function RecapSlide({ story, active, spec, onRestart }: SlideProps & { onRestart: () => void }) {
  const o = story.overview;
  const a = story.analytics;
  const artist = o.topArtists[0];
  const track = o.topTracks[0];
  const album = o.topAlbums[0];
  const hour = a.mostActiveHour;
  const covers = o.topAlbums.slice(0, 4);
  const items = [
    ['Artista favorito', artist?.name],
    ['Música favorita', track?.name],
    ['Minutos ouvidos', formatInteger(o.msPlayed / MS_PER_MINUTE)],
    album
      ? ['Álbum favorito', album.name]
      : ['Hora favorita', hour ? `${String(hour.hour)}h` : undefined],
  ].filter((x): x is [string, string] => typeof x[1] === 'string');
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-5 pt-20 pb-28">
      <Reveal
        active={active}
        className="w-full max-w-[400px] overflow-hidden rounded-panel bg-[linear-gradient(160deg,rgb(255_255_255/0.09),rgb(255_255_255/0.03))] p-6 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1),0_40px_80px_-30px_rgb(0_0_0/0.9)] sm:p-7"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-display text-callout font-semibold">
            <Mark /> Liner
          </span>
          <span className="numeric text-footnote text-accent">
            {periodLabel(spec, o.dataLastDay)}
          </span>
        </div>
        {covers.length > 0 && (
          <div aria-hidden className="mt-6 grid grid-cols-4 gap-2">
            {covers.map((c) => (
              <Cover key={c.id} name={c.name} className="aspect-square w-full" />
            ))}
          </div>
        )}
        <h2 className="sr-only">Resumo da retrospectiva</h2>
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          {items.map(([label, value], i) => (
            <div key={label} className={i === 2 ? 'col-span-2' : 'min-w-0'}>
              <dt className="text-caption font-semibold tracking-[0.06em] text-text-3 uppercase">
                {label}
              </dt>
              <dd
                className={
                  i === 2
                    ? 'numeric mt-1 font-display text-display font-[250]'
                    : 'mt-1 line-clamp-2 font-display text-title-3 font-semibold [overflow-wrap:anywhere]'
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
      <Reveal active={active} i={2} className="flex flex-wrap justify-center gap-3">
        <LinkButton href="#exportar" variant="primary">
          <Share aria-hidden size={16} />
          Criar imagem para compartilhar
        </LinkButton>
        <Button onClick={onRestart}>
          <RotateCcw aria-hidden size={16} />
          Ver de novo
        </Button>
      </Reveal>
    </div>
  );
}

// ── Stage ─────────────────────────────────────────────────────────────────

function useStory(spec: PeriodSpec) {
  const { client, status, summary } = useLibrary();
  const personality = usePeriodQuery('personality', spec);
  const [overview, setOverview] = useState<Overview | null | 'empty' | 'error'>(null);

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    client
      .call('overview', spec)
      .then((result) => {
        if (!lifecycle.active) return;
        if (result) setOverview(result);
        else if (spec.preset !== 'custom') setOverview('empty');
      })
      .catch(() => {
        if (lifecycle.active) setOverview('error');
      });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, spec, summary]);

  if (overview === 'error' || personality.status === 'error') return 'error' as const;
  if (overview === 'empty' || personality.status === 'empty') return 'empty' as const;
  if (!overview || personality.status !== 'ready') return null;
  return {
    overview,
    analytics: personality.data.analytics,
    observations: personality.data.observations,
  } satisfies Story;
}

export function WrappedPage({
  period,
  onPeriodChange,
  displayName = '',
}: {
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
  displayName?: string;
}) {
  const story = useStory(period);
  // The slide index belongs to one period: a new period starts the story over.
  const periodKey = JSON.stringify(period);
  const [nav, setNav] = useState({ key: periodKey, index: 0 });
  const index = nav.key === periodKey ? nav.index : 0;
  const setIndex = useCallback(
    (next: number) => {
      setNav({ key: periodKey, index: next });
    },
    [periodKey],
  );
  const pointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  const ready = story !== null && story !== 'empty' && story !== 'error';
  const hasStreams = ready && story.overview.streams > 0;

  const slides: { id: string; label: string; render: (active: boolean) => ReactNode }[] = [];
  if (ready) {
    const props = (active: boolean) => ({ story, active, spec: period });
    slides.push({
      id: 'intro',
      label: 'Abertura',
      render: (active) => (
        <IntroSlide {...props(active)} displayName={displayName} onPeriodChange={onPeriodChange} />
      ),
    });
    if (hasStreams) {
      slides.push(
        { id: 'time', label: 'Tempo ouvido', render: (active) => <TimeSlide {...props(active)} /> },
        {
          id: 'artist',
          label: 'Artista nº 1',
          render: (active) => <ArtistSlide {...props(active)} />,
        },
        {
          id: 'soundtrack',
          label: 'Trilha sonora',
          render: (active) => <SoundtrackSlide {...props(active)} />,
        },
        {
          id: 'taste',
          label: 'Gosto musical',
          render: (active) => <TasteSlide {...props(active)} />,
        },
        {
          id: 'personality',
          label: 'Personalidade',
          render: (active) => <PersonalitySlide {...props(active)} />,
        },
        {
          id: 'recap',
          label: 'Resumo',
          render: (active) => (
            <RecapSlide
              {...props(active)}
              onRestart={() => {
                setIndex(0);
              }}
            />
          ),
        },
      );
    }
  }

  const count = slides.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(count - 1, next)));
    },
    [count, setIndex],
  );

  const exit = () => {
    window.location.hash = '#visao-geral';
  };

  // Listen on the window: focus may sit on <body> after a slide turns inert.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    if (target.closest('[role="radiogroup"]')) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'PageDown':
        event.preventDefault();
        go(current + 1);
        break;
      case ' ':
        if (target.closest('button, a')) return;
        event.preventDefault();
        go(current + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        go(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        go(0);
        break;
      case 'End':
        event.preventDefault();
        go(count - 1);
        break;
      case 'Escape':
        event.preventDefault();
        exit();
        break;
    }
  };

  const keyHandler = useRef(onKeyDown);
  useEffect(() => {
    keyHandler.current = onKeyDown;
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      keyHandler.current(event);
    };
    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent) => {
    pointer.current = { x: event.clientX, y: event.clientY, t: performance.now() };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start) return;
    if ((event.target as HTMLElement).closest('button, a, [role="radiogroup"]')) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      go(current + (dx < 0 ? 1 : -1));
      return;
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && performance.now() - start.t < 500) {
      const width = window.innerWidth;
      go(current + (event.clientX < width * 0.3 ? -1 : 1));
    }
  };

  const hue =
    ready && story.overview.topArtists[0] ? coverArt(story.overview.topArtists[0].name).hue : 160;
  const glows = [
    `radial-gradient(70% 60% at 50% 0%, oklch(0.42 0.08 ${String(hue)} / 0.55), transparent 70%)`,
    `radial-gradient(60% 50% at 0% 100%, oklch(0.4 0.07 ${String((hue + 140) % 360)} / 0.35), transparent 70%)`,
    `radial-gradient(55% 55% at 100% 30%, rgb(71 215 160 / 0.12), transparent 70%)`,
  ];

  return (
    <main
      ref={stage}
      tabIndex={-1}
      aria-roledescription="apresentação"
      aria-label="Retrospectiva"
      className="stage-dark fixed inset-0 z-40 overflow-hidden bg-bg text-text-1 outline-none"
    >
      {/* Ambient light, shifting a little with each slide. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-transform duration-[1200ms] ease-out"
        style={{
          backgroundImage: glows.join(', '),
          transform: `translate3d(calc(var(--motion-distance) * ${String(current % 2 === 0 ? -2 : 2)}), 0, 0) scale(1.1)`,
        }}
      />

      {/* Top bar: progress and exit. */}
      <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-bg via-bg/70 to-transparent px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-4 sm:px-6">
        <div className="flex items-center gap-3">
          <ol aria-label="Progresso" className="flex flex-1 gap-1.5">
            {slides.map((slide, i) => (
              <li key={slide.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => {
                    go(i);
                  }}
                  aria-label={`${slide.label} (${String(i + 1)} de ${String(count)})`}
                  aria-current={i === current ? 'step' : undefined}
                  className="block w-full py-2"
                >
                  <span className="block h-[3px] overflow-hidden rounded-full bg-white/20">
                    <span
                      className={`block h-full rounded-full bg-white transition-[width] duration-500 ease-out ${
                        i <= current ? 'w-full' : 'w-0'
                      }`}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <a
            href="#visao-geral"
            aria-label="Sair da retrospectiva"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X aria-hidden size={18} />
          </a>
        </div>
      </div>

      {/* Slides */}
      <div
        className="relative z-10 h-full touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {story === null && (
          <div className="grid h-full place-items-center">
            <p aria-live="polite" className="fade text-callout text-text-2">
              Preparando sua retrospectiva…
            </p>
          </div>
        )}
        {(story === 'empty' || story === 'error') && (
          <div className="mx-auto flex h-full max-w-[44ch] flex-col items-start justify-center gap-4 px-6">
            <h1 className="font-display text-display font-semibold">Retrospectiva</h1>
            <p role={story === 'error' ? 'alert' : undefined} className="text-callout text-text-2">
              {story === 'error'
                ? 'Não foi possível montar a retrospectiva. Recarregue a página.'
                : 'Ainda não há histórico neste dispositivo. Importe seus arquivos para ver sua retrospectiva.'}
            </p>
            {story === 'empty' && (
              <LinkButton href="#importar" variant="primary">
                Importar dados
              </LinkButton>
            )}
          </div>
        )}
        {slides.map((slide, i) => {
          const active = i === current;
          return (
            <section
              key={slide.id}
              aria-roledescription="slide"
              aria-label={`${slide.label}, ${String(i + 1)} de ${String(count)}`}
              aria-hidden={!active}
              inert={!active}
              className={`absolute inset-0 overflow-y-auto transition-[opacity,transform] duration-700 ease-out ${
                active ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              style={{
                transform: active
                  ? 'none'
                  : `translate3d(calc(var(--motion-distance) * ${i < current ? '-3' : '3'}), 0, 0) scale(var(--motion-scale))`,
              }}
            >
              <div className="mx-auto h-full max-w-[1280px] [&>*]:min-h-full">
                {slide.render(active)}
              </div>
            </section>
          );
        })}
        {ready && !hasStreams && (
          <p className="absolute inset-x-0 bottom-28 text-center text-callout text-text-2">
            Sem streams neste período. Escolha outro período acima.
          </p>
        )}
      </div>

      {/* Previous / next */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-bg via-bg/80 to-transparent px-4 pt-10 pb-[max(env(safe-area-inset-bottom),1rem)] sm:px-6">
          <button
            type="button"
            onClick={() => {
              go(current - 1);
            }}
            disabled={current === 0}
            aria-label="Anterior"
            className="grid size-11 place-items-center rounded-full bg-white/10 text-white transition-[background-color,opacity] hover:bg-white/20 disabled:opacity-0"
          >
            <ChevronLeft aria-hidden size={20} />
          </button>
          <p aria-live="polite" className="numeric text-footnote text-text-3">
            {current + 1} / {count}
          </p>
          <button
            type="button"
            onClick={() => {
              go(current + 1);
            }}
            disabled={current === count - 1}
            aria-label="Próximo"
            className="grid size-11 place-items-center rounded-full bg-white text-black transition-[background-color,opacity] hover:bg-white/85 disabled:opacity-0"
          >
            <ChevronRight aria-hidden size={20} />
          </button>
        </div>
      )}
    </main>
  );
}
