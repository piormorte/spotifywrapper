import { formatLocalDate, plural } from '../../lib/format.ts';
import type { PeriodSpec, ResolvedPeriod } from '../../stats/period.ts';
import { PeriodPicker } from '../overview/PeriodPicker.tsx';

/** Title, period line and period picker shared by period-based screens. */
export function PageHeader({
  title,
  intro,
  data,
  period,
  onPeriodChange,
}: {
  title: string;
  intro?: string;
  data: { period: ResolvedPeriod; dataFirstDay: string; dataLastDay: string } | null;
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 className="font-display text-display font-semibold">{title}</h1>
        {data && (
          <p className="numeric mt-2 text-callout text-text-2">
            {formatLocalDate(data.period.from)} – {formatLocalDate(data.period.to - 1)} ·{' '}
            {plural(data.period.days, 'dia', 'dias')}
          </p>
        )}
        {intro && <p className="mt-3 max-w-[60ch] text-callout text-text-2">{intro}</p>}
      </div>
      {data && (
        <PeriodPicker
          value={period}
          onChange={onPeriodChange}
          dataYear={Number(data.dataLastDay.slice(0, 4))}
          bounds={{ first: data.dataFirstDay, last: data.dataLastDay }}
        />
      )}
    </header>
  );
}

export function EmptyLibrary() {
  return (
    <p className="mt-16 text-callout text-text-2">
      Ainda não há histórico.{' '}
      <a href="#importar" className="text-text-1 underline">
        Importar dados
      </a>
    </p>
  );
}
