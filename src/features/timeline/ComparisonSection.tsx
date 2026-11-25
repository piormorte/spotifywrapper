import { useEffect, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import { formatDuration, formatInteger, formatPercent } from '../../lib/format.ts';
import { MS_PER_MINUTE } from '../../lib/units.ts';
import type { Overview } from '../../stats/overview.ts';
import { parseDayKey, type PeriodSpec } from '../../stats/period.ts';
import type { Comparison } from '../../stats/timeline.ts';
import { GroupedBarChart } from '../../ui/GroupedBarChart.tsx';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';
import { Section } from '../../ui/Section.tsx';
import { monthName } from '../series-labels.ts';

type Span = 'same' | 'full';

/**
 * A calendar year, or the same Jan 1 → `untilMonthDay` window of it ("06-29"),
 * so a partial year is compared like for like. Feb 29 falls back to Feb 28.
 */
function yearSpec(year: number, untilMonthDay: string | null): PeriodSpec {
  let end = `${String(year)}-${untilMonthDay ?? '12-31'}`;
  if (parseDayKey(end) === null) end = `${String(year)}-02-28`;
  return { preset: 'custom', start: `${String(year)}-01-01`, end };
}

/** Change from A to B as a signed percentage, or null when A is zero. */
function change(a: number, b: number): string | null {
  if (a === 0) return null;
  const delta = (b - a) / a;
  const text = formatPercent(Math.abs(delta));
  return delta === 0 ? '0%' : `${delta > 0 ? '+' : '−'}${text}`;
}

function monthlyMinutes(o: Overview): number[] {
  // Each side is one calendar year: 12 monthly buckets (zero-filled), clipped
  // to the data range at the edges.
  const months = new Array<number>(12).fill(0);
  for (const point of o.series) {
    const month = Number(point.key.slice(5, 7));
    if (point.key.length === 7 && month >= 1) months[month - 1] = point.msPlayed / MS_PER_MINUTE;
  }
  return months;
}

function YearSelect({
  id,
  label,
  years,
  value,
  onChange,
}: {
  id: string;
  label: string;
  years: readonly number[];
  value: number;
  onChange: (year: number) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-footnote text-text-2">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="numeric rounded-control bg-fill-1 px-3 py-1.5 text-callout text-text-1"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ComparisonSection({
  years,
  dataFirstDay,
  dataLastDay,
}: {
  years: readonly number[];
  /** First and last days with data ("YYYY-MM-DD"). */
  dataFirstDay: string;
  dataLastDay: string;
}) {
  const { client, summary } = useLibrary();
  const [yearA, setYearA] = useState(years.at(-2) ?? years[0] ?? 0);
  const [yearB, setYearB] = useState(years.at(-1) ?? 0);
  const [span, setSpan] = useState<Span>('same');
  const [data, setData] = useState<Comparison | null>(null);

  // A year is partial when the data starts after Jan 1 or ends before Dec 31 in it.
  const lastYear = Number(dataLastDay.slice(0, 4));
  const firstYear = Number(dataFirstDay.slice(0, 4));
  const endsEarly = !dataLastDay.endsWith('-12-31') && (yearA === lastYear || yearB === lastYear);
  const startsLate =
    !dataFirstDay.endsWith('-01-01') && (yearA === firstYear || yearB === firstYear);
  const partial = endsEarly || startsLate;
  const until = span === 'same' && endsEarly ? dataLastDay.slice(5) : null;
  const windowLabel = until
    ? `1 jan – ${String(Number(until.slice(3)))} ${monthName(Number(until.slice(0, 2)))}`
    : null;

  const monthsShown = until ? Number(until.slice(0, 2)) : 12;

  useEffect(() => {
    const lifecycle = { active: true };
    void client
      .call('compare', { a: yearSpec(yearA, until), b: yearSpec(yearB, until) })
      .then((result) => {
        if (lifecycle.active) setData(result);
      });
    return () => {
      lifecycle.active = false;
    };
  }, [client, yearA, yearB, until, summary]);

  const rows: [string, (o: Overview) => number, (v: number) => string][] = [
    ['Tempo ouvido', (o) => o.msPlayed, formatDuration],
    ['Streams', (o) => o.streams, formatInteger],
    ['Reproduções registradas', (o) => o.registeredPlays, formatInteger],
    ['Média diária', (o) => o.dailyAverageMs, (v) => `${formatInteger(v / MS_PER_MINUTE)} min`],
    ['Dias com escuta', (o) => o.listeningDays, formatInteger],
    ['Faixas diferentes', (o) => o.distinctTracks, formatInteger],
    ['Artistas diferentes', (o) => o.distinctArtists, formatInteger],
  ];

  return (
    <Section title="Comparar anos" caption="Mesmas definições da Visão geral">
      <div className="flex flex-wrap items-center gap-4">
        <YearSelect id="compare-a" label="Ano A" years={years} value={yearA} onChange={setYearA} />
        <YearSelect id="compare-b" label="Ano B" years={years} value={yearB} onChange={setYearB} />
        {endsEarly && (
          <SegmentedControl
            label="Intervalo comparado"
            segments={[
              { value: 'same', label: windowLabel ?? 'Mesmo intervalo' },
              { value: 'full', label: 'Ano inteiro' },
            ]}
            value={span}
            onChange={setSpan}
          />
        )}
      </div>
      {partial && (
        <p className="mt-3 max-w-[64ch] text-footnote text-text-3">
          {endsEarly && span === 'same'
            ? `Os dados terminam em ${String(Number(dataLastDay.slice(8)))} ${monthName(Number(dataLastDay.slice(5, 7)))} ${String(lastYear)}; os dois anos são comparados no mesmo intervalo.`
            : 'Um dos anos tem dados só em parte dele; a comparação do ano inteiro favorece o ano completo.'}
        </p>
      )}

      {data && (
        <>
          <table className="mt-8 w-full text-callout">
            <caption className="sr-only">
              Comparação entre {yearA} e {yearB}
            </caption>
            <thead>
              <tr className="text-left">
                <th scope="col" className="eyebrow pb-2 font-medium">
                  Métrica
                </th>
                <th scope="col" className="eyebrow pb-2 text-right font-medium">
                  {yearA}
                </th>
                <th scope="col" className="eyebrow pb-2 text-right font-medium">
                  {yearB}
                </th>
                <th
                  scope="col"
                  className="eyebrow hidden pb-2 text-right font-medium sm:table-cell"
                >
                  Variação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {rows.map(([label, pick, fmt]) => {
                const a = pick(data.a);
                const b = pick(data.b);
                return (
                  <tr key={label}>
                    <th scope="row" className="py-2.5 text-left font-normal text-text-2">
                      {label}
                    </th>
                    <td className="numeric py-2.5 text-right text-text-2">{fmt(a)}</td>
                    <td className="numeric py-2.5 text-right">{fmt(b)}</td>
                    <td className="numeric hidden py-2.5 text-right text-text-2 sm:table-cell">
                      {change(a, b) ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-6 text-footnote text-text-2">
            Artistas: {formatInteger(data.artists.shared)} em comum ·{' '}
            {formatInteger(data.artists.onlyA)} só em {yearA} · {formatInteger(data.artists.onlyB)}{' '}
            só em {yearB}
          </p>

          <div className="mt-10">
            <p className="mb-4 flex gap-5 text-footnote text-text-2">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-[2px] bg-fill-2" /> {yearA}
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-[2px] bg-text-1" /> {yearB}
              </span>
              <span className="text-text-3">Tempo ouvido por mês</span>
            </p>
            <GroupedBarChart
              title={`Tempo ouvido por mês: ${String(yearA)} e ${String(yearB)}`}
              series={[
                monthlyMinutes(data.a).slice(0, monthsShown),
                monthlyMinutes(data.b).slice(0, monthsShown),
              ]}
              seriesNames={[String(yearA), String(yearB)]}
              labels={Array.from({ length: monthsShown }, (_, i) => monthName(i + 1))}
              formatValue={(v) => `${formatInteger(v)} min`}
            />
          </div>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            {(
              [
                [yearA, data.a],
                [yearB, data.b],
              ] as const
            ).map(([year, o]) => (
              <div key={`top-${String(year)}`}>
                <h3 className="eyebrow mb-2">Artistas de {year}</h3>
                <ol className="divide-y divide-separator">
                  {o.topArtists.map((artist, i) => (
                    <li key={artist.id} className="flex items-baseline gap-4 py-2.5">
                      <span className="numeric w-4 text-right text-footnote text-text-3">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-callout">{artist.name}</span>
                      <span className="numeric text-footnote text-text-2">
                        {formatInteger(artist.streams)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
