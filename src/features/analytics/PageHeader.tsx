import type { ReactNode } from 'react';
import { formatLocalDate, plural } from '../../lib/format.ts';
import type { PeriodSpec, ResolvedPeriod } from '../../stats/period.ts';
import { LinkButton } from '../../ui/Button.tsx';
import { PeriodPicker } from '../overview/PeriodPicker.tsx';

/** Page wrapper shared by every screen inside the shell: width, gutters, rhythm. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main
      className={`mx-auto px-4 pt-4 pb-20 sm:px-6 lg:px-10 lg:pt-6 ${wide ? 'max-w-[1240px]' : 'max-w-[1120px]'}`}
    >
      {children}
    </main>
  );
}

/** Title, period line and period picker shared by period-based screens. */
export function PageHeader({
  title,
  eyebrow,
  intro,
  data,
  period,
  onPeriodChange,
  subtitle,
}: {
  title: string;
  eyebrow?: string;
  intro?: string;
  data: { period: ResolvedPeriod; dataFirstDay: string; dataLastDay: string } | null;
  period?: PeriodSpec;
  onPeriodChange?: (spec: PeriodSpec) => void;
  /** Replaces the default period line. */
  subtitle?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pt-2 pb-8 sm:pb-10">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-display font-semibold">{title}</h1>
        {subtitle ??
          (data && (
            <p className="numeric mt-2 text-callout text-text-2">
              {formatLocalDate(data.period.from)} – {formatLocalDate(data.period.to - 1)} ·{' '}
              {plural(data.period.days, 'dia', 'dias')}
            </p>
          ))}
        {intro && <p className="mt-3 max-w-[60ch] text-callout text-text-2">{intro}</p>}
      </div>
      {data && period && onPeriodChange && (
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

/** Empty library: an inviting, specific next step rather than a bare sentence. */
export function EmptyLibrary({
  title = 'Ainda não há histórico neste dispositivo.',
}: {
  title?: string;
}) {
  return (
    <div className="card ambient fade mt-4 flex flex-col items-start gap-4 p-8 sm:p-12">
      <div aria-hidden className="flex -space-x-3">
        {['#2a3f37', '#2d2f45', '#3f2f35'].map((c, i) => (
          <span
            key={c}
            className="size-12 rounded-[22%] shadow-[0_0_0_2px_var(--surface)]"
            style={{
              background: `linear-gradient(150deg, ${c}, #141416)`,
              transform: `rotate(${String((i - 1) * 6)}deg)`,
            }}
          />
        ))}
      </div>
      <div className="max-w-[52ch]">
        <p className="text-title-3 font-semibold">{title}</p>
        <p className="mt-2 text-callout text-text-2">
          Importe os arquivos do seu histórico de streaming para ver suas estatísticas. Tudo é
          processado localmente, e nada sai do seu dispositivo.
        </p>
      </div>
      <LinkButton href="#importar" variant="primary">
        Importar dados
      </LinkButton>
    </div>
  );
}

/** Calculation failed. */
export function LoadError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="card mt-4 p-6 text-callout text-critical">
      {children}
    </p>
  );
}
