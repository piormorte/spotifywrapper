import type { ReactNode } from 'react';
import { useCountUpText } from './useCountUpText.ts';

interface FigureProps {
  /** What the number measures, e.g. "Streams". */
  readonly label: string;
  /** Pre-formatted value. */
  readonly value: string;
  /** Unit shown after the value, e.g. "min". */
  readonly unit?: string;
  /** Clarifies the measure, e.g. "reproduções com 30 s ou mais". */
  readonly note?: ReactNode;
  readonly size?: 'hero' | 'display' | 'title';
}

const VALUE_SIZE = {
  hero: 'text-hero font-[250]',
  display: 'text-display font-light',
  title: 'text-title-1 font-light',
} as const;

/** A statistic presented typographically: label, number, unit, note. */
export function Figure({ label, value, unit, note, size = 'title' }: FigureProps) {
  const shown = useCountUpText(value);
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2">
        <span className={`numeric font-display ${VALUE_SIZE[size]}`}>{shown}</span>
        {unit && <span className="ml-1.5 text-callout text-text-2">{unit}</span>}
        {note && <p className="mt-1.5 text-footnote text-text-3">{note}</p>}
      </dd>
    </div>
  );
}
