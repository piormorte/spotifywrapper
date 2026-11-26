import type { CSSProperties } from 'react';
import { coverArt, coverBackground } from './cover-art.ts';

interface CoverProps {
  /** Album or artist name the artwork is generated from. */
  readonly name: string;
  /** Square for albums and tracks, circle for artists. */
  readonly shape?: 'square' | 'circle';
  /**
   * `initials`: monogram (small sizes). `title`: the full name set as type
   * (large tiles, where the cover is the composition). `blank`: artwork only,
   * when the caller lays its own type over it.
   */
  readonly variant?: 'initials' | 'title' | 'blank';
  /** Secondary line in the `title` variant, e.g. the artist. */
  readonly byline?: string | null | undefined;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Generated typographic artwork (see cover-art.ts). Decorative: the name is
 * always present as text next to it, so the artwork is hidden from assistive
 * technology.
 */
export function Cover({
  name,
  shape = 'square',
  variant = 'initials',
  byline,
  className = '',
  style,
}: CoverProps) {
  const art = coverArt(name);
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-[18%]';
  return (
    <div
      aria-hidden
      className={`relative isolate shrink-0 overflow-hidden text-white select-none ${radius} ${className}`}
      style={{
        background: coverBackground(art),
        boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.12)',
        containerType: 'inline-size',
        ...style,
      }}
    >
      {/* Fine grain so the gradient reads as a printed surface, not a flat fill. */}
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, rgb(255 255 255 / 0.25) 0 1px, transparent 1px 7px)',
        }}
      />
      {variant === 'initials' ? (
        <span
          className="absolute inset-0 grid place-items-center font-display font-semibold tracking-[-0.04em] text-white/90"
          style={{ fontSize: shape === 'circle' ? '36cqi' : '40cqi' }}
        >
          {art.initials}
        </span>
      ) : variant === 'blank' ? null : (
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-[2cqi] p-[8cqi]">
          <span
            className="line-clamp-3 font-display font-semibold tracking-[-0.035em] text-white [overflow-wrap:anywhere]"
            style={{ fontSize: '11cqi', lineHeight: 0.98 }}
          >
            {name}
          </span>
          {byline && (
            <span className="truncate font-medium text-white/70" style={{ fontSize: '5.2cqi' }}>
              {byline}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
