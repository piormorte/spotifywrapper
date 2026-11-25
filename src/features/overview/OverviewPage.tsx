import { useEffect, useState } from 'react';
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
import type { Overview, RankedEntry } from '../../stats/overview.ts';
import { dayKey, parseDayKey, type Granularity, type PeriodSpec } from '../../stats/period.ts';
import { BarChart } from '../../ui/BarChart.tsx';
import { Figure } from '../../ui/Figure.tsx';
import { RankList } from '../../ui/RankList.tsx';
import { Section } from '../../ui/Section.tsx';
import { PeriodPicker } from './PeriodPicker.tsx';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDayKey(key: string, long = false): string {
  const ms = parseDayKey(key);
  if (ms === null) return key;
  return long ? formatLocalDateLong(ms) : formatLocalDate(ms);
}

function seriesLabel(key: string, granularity: Granularity): string {
  if (granularity === 'year') return key;
  if (granularity === 'month') return MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
  return String(Number(key.slice(8, 10)));
}

const SERIES_CAPTION: Record<Granularity, string> = {
  year: 'Tempo ouvido por ano',
  month: 'Tempo ouvido por mês',
  day: 'Tempo ouvido por dia',
};

function rankItems(entries: readonly RankedEntry[]) {
  return entries.map((e) => ({
    key: String(e.id),
    title: e.name,
    ...(e.artist ? { subtitle: e.artist } : {}),
    metric: formatInteger(e.streams),
    secondary: formatDuration(e.msPlayed),
  }));
}

function EmptyState() {
  return (
    <div className="mt-16 max-w-[52ch]">
      <p className="text-title-3 font-semibold">Ainda não há histórico neste dispositivo.</p>
      <p className="mt-2 text-callout text-text-2">
        Importe os arquivos do seu histórico de streaming para ver suas estatísticas. Tudo é
        processado localmente.
      </p>
      <a
        href="#importar"
        className="mt-6 inline-flex rounded-control bg-text-1 px-4 py-2 text-callout font-medium text-bg hover:opacity-85"
      >
        Importar dados
      </a>
    </div>
  );
}

function Definitions() {
  return (
    <Section title="Como calculamos">
      <dl className="grid max-w-[72ch] gap-x-10 gap-y-4 text-footnote sm:grid-cols-2">
        <div>
          <dt className="font-medium text-text-1">Streams</dt>
          <dd className="text-text-2">Reproduções com 30 segundos ou mais.</dd>
        </div>
        <div>
          <dt className="font-medium text-text-1">Reproduções registradas</dt>
          <dd className="text-text-2">Qualquer reprodução com duração maior que zero.</dd>
        </div>
        <div>
          <dt className="font-medium text-text-1">Tempo ouvido</dt>
          <dd className="text-text-2">Soma do tempo efetivamente reproduzido.</dd>
        </div>
        <div>
          <dt className="font-medium text-text-1">Data de cada reprodução</dt>
          <dd className="text-text-2">
            O momento em que ela terminou, no fuso horário escolhido em Ajustes.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-text-1">Rankings</dt>
          <dd className="text-text-2">Por streams; empates são decididos pelo tempo ouvido.</dd>
        </div>
        <div>
          <dt className="font-medium text-text-1">O que fica de fora</dt>
          <dd className="text-text-2">
            Podcasts e audiolivros não entram nas estatísticas de música.
          </dd>
        </div>
      </dl>
    </Section>
  );
}

function OverviewContent({ data }: { data: Overview }) {
  const minutes = data.msPlayed / MS_PER_MINUTE;
  const values = data.series.map((p) => p.msPlayed / MS_PER_MINUTE);
  const labelEvery =
    data.period.granularity === 'day'
      ? Math.ceil(data.series.length / 8)
      : data.series.length > 12
        ? 3
        : 1;
  const hourTotal = data.hours.reduce((a, b) => a + b, 0);

  return (
    <>
      <dl className="mt-16 lg:mt-20">
        <Figure
          size="hero"
          label="Tempo ouvido"
          value={formatInteger(minutes)}
          unit="minutos"
          note={`${formatInteger(msToHours(data.msPlayed))} horas · ${formatDecimal(msToDays(data.msPlayed), 1)} dias de reprodução contínua`}
        />
      </dl>

      <dl className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3">
        <Figure
          label="Streams"
          value={formatInteger(data.streams)}
          note="Reproduções de 30 s ou mais"
        />
        <Figure
          label="Reproduções registradas"
          value={formatInteger(data.registeredPlays)}
          note="Qualquer reprodução acima de 0 s"
        />
        <Figure
          label="Média diária"
          value={formatInteger(data.dailyAverageMs / MS_PER_MINUTE)}
          unit="min"
          note={`Em ${plural(data.period.days, 'dia', 'dias')} · ${plural(data.listeningDays, 'dia', 'dias')} com escuta`}
        />
        <Figure label="Faixas" value={formatInteger(data.distinctTracks)} note="Diferentes" />
        <Figure label="Artistas" value={formatInteger(data.distinctArtists)} note="Diferentes" />
        <Figure label="Álbuns" value={formatInteger(data.distinctAlbums)} note="Diferentes" />
      </dl>

      <div className="mt-20 space-y-20">
        <Section
          title="Ao longo do tempo"
          caption={`${SERIES_CAPTION[data.period.granularity]} · em destaque, o maior`}
        >
          <BarChart
            title={`${SERIES_CAPTION[data.period.granularity]} no período`}
            values={values}
            labels={data.series.map((p) => seriesLabel(p.key, data.period.granularity))}
            labelEvery={labelEvery}
            height={200}
            formatValue={(v) => `${formatInteger(v)} min`}
          />
        </Section>

        <Section title="Mais ouvidos" caption="Por streams · tempo ouvido abaixo">
          <div className="grid gap-12 md:grid-cols-3 md:gap-8">
            <div>
              <h3 className="eyebrow mb-2">Artistas</h3>
              <RankList label="Artistas mais ouvidos" items={rankItems(data.topArtists)} />
            </div>
            <div>
              <h3 className="eyebrow mb-2">Faixas</h3>
              <RankList label="Faixas mais ouvidas" items={rankItems(data.topTracks)} />
            </div>
            <div>
              <h3 className="eyebrow mb-2">Álbuns</h3>
              {data.topAlbums.length > 0 ? (
                <RankList label="Álbuns mais ouvidos" items={rankItems(data.topAlbums)} />
              ) : (
                <p className="py-3 text-footnote text-text-3">
                  Sem informação de álbum no período.
                </p>
              )}
            </div>
          </div>
        </Section>

        <div className="grid gap-20 md:grid-cols-[2fr_1fr] md:gap-12">
          <Section title="Hora do dia" caption="Parcela do tempo ouvido">
            <BarChart
              title="Tempo ouvido por hora do dia"
              values={data.hours}
              labels={data.hours.map((_, h) => `${h}h`)}
              labelEvery={6}
              height={160}
              highlightMax={false}
              formatValue={(v) => formatPercent(hourTotal > 0 ? v / hourTotal : 0)}
            />
          </Section>
          <Section title="Dia de pico" caption="Maior tempo ouvido em um dia">
            {data.peakDay ? (
              <dl>
                <Figure
                  size="display"
                  label="Tempo ouvido"
                  value={formatInteger(data.peakDay.msPlayed / MS_PER_MINUTE)}
                  unit="min"
                  note={formatDayKey(data.peakDay.day, true)}
                />
              </dl>
            ) : (
              <p className="text-footnote text-text-3">Sem reproduções no período.</p>
            )}
          </Section>
        </div>

        <Definitions />
      </div>
    </>
  );
}

export function OverviewPage({
  period: spec,
  onPeriodChange: setSpec,
}: {
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
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
    <main className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-display font-semibold">Visão geral</h1>
          {data && state === 'ready' && (
            <p className="numeric mt-2 text-callout text-text-2">
              {periodLine} · {plural(data.period.days, 'dia', 'dias')}
            </p>
          )}
        </div>
        {state === 'ready' && data && (
          <PeriodPicker
            value={spec}
            onChange={setSpec}
            dataYear={dataYear}
            bounds={{ first: data.dataFirstDay, last: data.dataLastDay }}
          />
        )}
      </header>

      {state === 'empty' && <EmptyState />}
      {state === 'error' && (
        <p role="alert" className="mt-16 text-callout text-critical">
          Não foi possível calcular as estatísticas. Recarregue a página.
        </p>
      )}
      {state === 'ready' && data && (
        <div
          aria-busy={updating}
          className={`transition-opacity duration-200 ${updating ? 'opacity-40' : 'opacity-100'}`}
        >
          <OverviewContent data={data} />
        </div>
      )}
    </main>
  );
}
