import { useEffect, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import {
  formatDuration,
  formatInteger,
  formatLocalDate,
  formatPercent,
  plural,
} from '../../lib/format.ts';
import { MS_PER_MINUTE } from '../../lib/units.ts';
import type { Granularity, PeriodSpec } from '../../stats/period.ts';
import { MAX_DAILY_DAYS, type Timeline, type YearLeader } from '../../stats/timeline.ts';
import { BarChart } from '../../ui/BarChart.tsx';
import { Heatmap } from '../../ui/Heatmap.tsx';
import { Section } from '../../ui/Section.tsx';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';
import { PeriodPicker } from '../overview/PeriodPicker.tsx';
import { GRANULARITY_NOUN, labelEvery, seriesLabel } from '../series-labels.ts';
import { ComparisonSection } from './ComparisonSection.tsx';

type GranularityChoice = Granularity | 'auto';
type Metric = 'time' | 'streams';

const GRANULARITIES = [
  { value: 'auto', label: 'Automático', short: 'Auto' },
  { value: 'year', label: 'Ano' },
  { value: 'month', label: 'Mês' },
  { value: 'week', label: 'Semana', short: 'Sem.' },
  { value: 'day', label: 'Dia' },
] as const satisfies readonly { value: GranularityChoice; label: string; short?: string }[];

const METRICS = [
  { value: 'time', label: 'Tempo ouvido', short: 'Tempo' },
  { value: 'streams', label: 'Streams' },
] as const satisfies readonly { value: Metric; label: string; short?: string }[];

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const WEEKDAYS_LONG = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
];

function peakCell(heatmap: Timeline['heatmap']): { day: number; hour: number } | null {
  let best: { day: number; hour: number; value: number } | null = null;
  heatmap.forEach((row, day) => {
    row.forEach((value, hour) => {
      if (value > 0 && (!best || value > best.value)) best = { day, hour, value };
    });
  });
  return best;
}

export function TimelinePage({
  period,
  onPeriodChange,
}: {
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
}) {
  const { client, status, summary } = useLibrary();
  const [granularity, setGranularity] = useState<GranularityChoice>('auto');
  const [metric, setMetric] = useState<Metric>('time');
  const [data, setData] = useState<Timeline | null>(null);
  const [leaders, setLeaders] = useState<YearLeader[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    client
      .call('timeline', { period, granularity: granularity === 'auto' ? null : granularity })
      .then((result) => {
        if (!lifecycle.active) return;
        if (result) {
          setData(result);
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
  }, [client, status, period, granularity, summary]);

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    void Promise.all([
      client.call('dominantArtists', undefined),
      client.call('yearsWithData', undefined),
    ]).then(([l, y]) => {
      if (!lifecycle.active) return;
      setLeaders(l);
      setYears(y);
    });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, summary]);

  const values =
    data?.activity.map((p) => (metric === 'time' ? p.msPlayed / MS_PER_MINUTE : p.streams)) ?? [];
  const peak = data ? peakCell(data.heatmap) : null;
  const heatTotal = data ? data.heatmap.flat().reduce((a, b) => a + b, 0) : 0;
  const dailyDisabled = (data?.period.days ?? 0) > MAX_DAILY_DAYS;

  return (
    <main className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-display font-semibold">Linha do tempo</h1>
          {data && state === 'ready' && (
            <p className="numeric mt-2 text-callout text-text-2">
              {formatLocalDate(data.period.from)} – {formatLocalDate(data.period.to - 1)} ·{' '}
              {plural(data.period.days, 'dia', 'dias')}
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
          Não foi possível montar a linha do tempo. Recarregue a página.
        </p>
      )}

      {state === 'ready' && data && (
        <div className="mt-16 space-y-20">
          <Section
            title="Atividade"
            caption={`${metric === 'time' ? 'Minutos' : 'Streams'} por ${GRANULARITY_NOUN[data.granularity]} · em destaque, o maior`}
          >
            <div className="mb-8 flex flex-wrap gap-3">
              <SegmentedControl
                label="Agrupar por"
                segments={GRANULARITIES}
                value={granularity}
                onChange={setGranularity}
              />
              <SegmentedControl
                label="Medida"
                segments={METRICS}
                value={metric}
                onChange={setMetric}
              />
            </div>
            <BarChart
              title={`Atividade por ${GRANULARITY_NOUN[data.granularity]}`}
              values={values}
              labels={data.activity.map((p) => seriesLabel(p.key, data.granularity))}
              labelEvery={labelEvery(data.activity.length, data.granularity)}
              height={220}
              formatValue={(v) =>
                metric === 'time' ? `${formatInteger(v)} min` : `${formatInteger(v)} streams`
              }
            />
            {granularity === 'day' && dailyDisabled && (
              <p className="mt-3 text-footnote text-text-3">
                Períodos acima de dois anos são mostrados por semana.
              </p>
            )}
          </Section>

          <Section
            title="Quando você ouve"
            caption={
              peak
                ? `Mais ativo: ${WEEKDAYS_LONG[peak.day] ?? ''}, ${String(peak.hour)}h`
                : 'Tempo ouvido por dia da semana e hora'
            }
          >
            <Heatmap
              title="Tempo ouvido por dia da semana e hora do dia"
              values={data.heatmap}
              rowLabels={WEEKDAYS}
              columnLabels={Array.from({ length: 24 }, (_, h) => `${String(h)}h`)}
              formatCell={(r, c, v) =>
                `${WEEKDAYS_LONG[r] ?? ''}, ${String(c)}h: ${formatDuration(v)} (${formatPercent(heatTotal > 0 ? v / heatTotal : 0, 1)})`
              }
            />
          </Section>

          {leaders.length > 0 && (
            <Section title="Artista de cada ano" caption="Mais streams no ano · todo o histórico">
              <ol className="divide-y divide-separator">
                {leaders.map((l) => (
                  <li
                    key={l.year}
                    className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 py-3"
                  >
                    <span className="numeric text-callout text-text-2">{l.year}</span>
                    <span className="truncate text-callout font-medium">{l.artist}</span>
                    <span className="numeric text-right text-footnote text-text-2">
                      {formatInteger(l.streams)} streams · {formatPercent(l.share)} do ano
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {years.length >= 2 && (
            <ComparisonSection
              years={years}
              dataFirstDay={data.dataFirstDay}
              dataLastDay={data.dataLastDay}
            />
          )}
        </div>
      )}
    </main>
  );
}
