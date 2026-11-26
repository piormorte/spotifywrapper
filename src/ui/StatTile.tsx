import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useCountUpText } from './useCountUpText.ts';

interface StatTileProps {
  /** What the number measures. */
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
  readonly note?: ReactNode;
  readonly icon?: LucideIcon;
  /** Comparison with another period, shown only when there is enough data. */
  readonly delta?: { readonly text: string; readonly direction: 'up' | 'down' | 'flat' } | null;
  readonly size?: 'hero' | 'large' | 'small';
  /** Value is a name (artist, track), set in the display face but not as a number. */
  readonly textual?: boolean;
  /** Visual element beside or under the value (e.g. cover art). */
  readonly media?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

const VALUE = {
  hero: 'text-hero font-[250]',
  large: 'text-display font-light',
  small: 'text-title-1 font-light',
} as const;

const TEXTUAL = {
  hero: 'text-display font-semibold',
  large: 'text-title-1 font-semibold',
  small: 'text-title-3 font-semibold',
} as const;

const DELTA_CLASS = {
  up: 'text-text-1',
  down: 'text-text-2',
  flat: 'text-text-3',
} as const;

/**
 * A statistic on a card. Different sizes give the overview its rhythm: one
 * hero figure, a few large ones, small supporting ones. dt/dd keep the label
 * and value associated for assistive technology; place tiles inside a <dl>.
 */
export function StatTile({
  label,
  value,
  unit,
  note,
  icon: Icon,
  delta,
  size = 'small',
  textual = false,
  media,
  className = '',
  style,
}: StatTileProps) {
  // Names never parse as numbers, so textual values show as they are.
  const shown = useCountUpText(value);
  return (
    <div
      className={`card enter relative flex min-w-0 flex-col overflow-hidden p-5 sm:p-6 ${className}`}
      style={style}
    >
      <dt className="eyebrow flex items-center gap-2">
        {Icon && <Icon aria-hidden size={15} strokeWidth={2} className="text-text-3" />}
        {label}
      </dt>
      <dd className="mt-auto flex min-w-0 flex-col pt-5">
        {media}
        <span className="min-w-0">
          <span
            className={`font-display ${textual ? `${TEXTUAL[size]} line-clamp-2 [overflow-wrap:anywhere]` : `numeric ${VALUE[size]}`}`}
          >
            {shown}
          </span>
          {unit && <span className="ml-1.5 text-callout text-text-2">{unit}</span>}
        </span>
        {note && <span className="mt-1.5 block text-footnote text-text-3">{note}</span>}
        {delta && (
          <span
            className={`numeric mt-3 inline-flex text-footnote ${DELTA_CLASS[delta.direction]}`}
          >
            <span aria-hidden className="mr-1">
              {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'}
            </span>
            {delta.text}
          </span>
        )}
      </dd>
    </div>
  );
}
