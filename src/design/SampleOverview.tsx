import { useState } from 'react';
import { formatDecimal, formatInteger, formatPercent } from '../lib/format.ts';
import { MS_PER_MINUTE, msToDays, msToHours } from '../lib/units.ts';
import { BarChart } from '../ui/BarChart.tsx';
import { Figure } from '../ui/Figure.tsx';
import { RankList } from '../ui/RankList.tsx';
import { Section } from '../ui/Section.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { DEMO_DATA_END, demoOverview, type DemoPeriod } from './demo-data.ts';

/**
 * Sample screen for the Stage 1 visual review. Uses fictional data only and
 * says so on screen. Not the real Overview (that is built in Stage 3).
 */

const PERIODS = [
  { value: 'all', label: 'Todo o período', short: 'Tudo' },
  { value: 'year', label: 'Este ano', short: 'Ano' },
  { value: '12m', label: '12 meses', short: '12 m' },
  { value: '6m', label: '6 meses', short: '6 m' },
  { value: '30d', label: '30 dias', short: '30 d' },
] as const satisfies readonly { value: DemoPeriod; label: string; short: string }[];

const SERIES_CAPTION: Record<DemoPeriod, string> = {
  all: 'Minutos por ano',
  year: 'Minutos por mês',
  '12m': 'Minutos por mês',
  '6m': 'Minutos por mês',
  '30d': 'Minutos por dia',
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const weekdayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });

const minutes = (m: number) => `${formatInteger(m)} min`;

export function SampleOverview() {
  const [period, setPeriod] = useState<DemoPeriod>('all');
  const data = demoOverview(period);
  const ms = data.minutes * MS_PER_MINUTE;

  return (
    <main className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
      <p className="mb-10 text-footnote text-text-3" role="note">
        Prévia de design. Todos os nomes e números desta tela são fictícios.
      </p>

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-display font-semibold">Visão geral</h1>
          <p className="mt-2 text-callout text-text-2">
            Dados até {dateFormat.format(DEMO_DATA_END)}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <SegmentedControl
            label="Período"
            segments={PERIODS}
            value={period}
            onChange={setPeriod}
            fullWidth
          />
        </div>
      </header>

      <dl className="mt-16 lg:mt-20">
        <Figure
          size="hero"
          label="Tempo ouvido"
          value={formatInteger(data.minutes)}
          unit="minutos"
          note={`${formatInteger(msToHours(ms))} horas · ${formatDecimal(msToDays(ms), 1)} dias de reprodução contínua`}
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
          value={formatInteger(data.registered)}
          note="Qualquer reprodução acima de 0 s"
        />
        <Figure
          label="Média diária"
          value={formatInteger(data.dailyAverageMinutes)}
          unit="min"
          note="Tempo ouvido ÷ dias do período"
        />
        <Figure label="Faixas" value={formatInteger(data.tracks)} note="Diferentes" />
        <Figure label="Artistas" value={formatInteger(data.artists)} note="Diferentes" />
        <Figure label="Álbuns" value={formatInteger(data.albums)} note="Diferentes" />
      </dl>

      <div className="mt-20 space-y-20">
        <Section
          title="Ao longo do tempo"
          caption={`${SERIES_CAPTION[period]} · em destaque, o maior`}
        >
          <BarChart
            title={`${SERIES_CAPTION[period]} no período`}
            values={data.series.values}
            labels={data.series.labels}
            labelEvery={data.series.every}
            height={200}
            formatValue={minutes}
          />
        </Section>

        <Section title="Mais ouvidos" caption="Ordenado por streams">
          <div className="grid gap-12 md:grid-cols-3 md:gap-8">
            <div>
              <h3 className="eyebrow mb-2">Artistas</h3>
              <RankList
                label="Artistas mais ouvidos"
                items={data.topArtists.slice(0, 5).map((a) => ({
                  key: a.name,
                  title: a.name,
                  metric: formatInteger(a.streams),
                }))}
              />
            </div>
            <div>
              <h3 className="eyebrow mb-2">Faixas</h3>
              <RankList
                label="Faixas mais ouvidas"
                items={data.topTracks.slice(0, 5).map((t) => ({
                  key: t.name,
                  title: t.name,
                  subtitle: t.artist,
                  metric: formatInteger(t.streams),
                }))}
              />
            </div>
            <div>
              <h3 className="eyebrow mb-2">Álbuns</h3>
              <RankList
                label="Álbuns mais ouvidos"
                items={data.topAlbums.slice(0, 5).map((a) => ({
                  key: a.name,
                  title: a.name,
                  subtitle: a.artist,
                  metric: formatInteger(a.streams),
                }))}
              />
            </div>
          </div>
        </Section>

        <div className="grid gap-20 md:grid-cols-[2fr_1fr] md:gap-12">
          <Section title="Hora do dia" caption="Distribuição do tempo ouvido">
            <BarChart
              title="Tempo ouvido por hora do dia"
              values={data.hours}
              labels={data.hours.map((_, h) => `${h}h`)}
              labelEvery={6}
              height={160}
              highlightMax={false}
              formatValue={(v) => formatPercent(v / data.hours.reduce((a, b) => a + b, 0))}
            />
          </Section>
          <Section title="Dia de pico" caption="Maior tempo ouvido em um dia">
            <dl>
              <Figure
                size="display"
                label="Tempo ouvido"
                value={formatInteger(data.peakDay.minutes)}
                unit="min"
                note={`${weekdayFormat.format(data.peakDay.date)}, ${dateFormat.format(data.peakDay.date)}`}
              />
            </dl>
          </Section>
        </div>
      </div>
    </main>
  );
}
