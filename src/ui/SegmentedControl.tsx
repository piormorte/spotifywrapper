import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface Segment<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Shorter label used on narrow screens. */
  readonly short?: string;
}

interface SegmentedControlProps<T extends string> {
  readonly label: string;
  readonly segments: readonly Segment<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Stretch to the container width with equal segments. */
  readonly fullWidth?: boolean;
}

/**
 * Single-choice control (radio group semantics) with a thumb that glides
 * between segments. Arrow keys move the selection.
 */
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
  fullWidth = false,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const selectedIndex = segments.findIndex((s) => s.value === value);

  useLayoutEffect(() => {
    const update = () => {
      const el = refs.current[selectedIndex];
      setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    update();
    const observer = new ResizeObserver(update);
    const parent = refs.current[0]?.parentElement;
    if (parent) observer.observe(parent);
    return () => {
      observer.disconnect();
    };
  }, [selectedIndex, segments]);

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = segments[(selectedIndex + step + segments.length) % segments.length];
    if (next) {
      onChange(next.value);
      refs.current[segments.indexOf(next)]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`relative max-w-full rounded-control bg-fill-1 p-0.5 ${fullWidth ? 'flex w-full' : 'inline-flex'}`}
    >
      {thumb && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-[calc(var(--radius-control)-2px)] bg-bg shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[left,width] duration-300 ease-emphasized"
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {segments.map((segment, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={segment.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(segment.value);
            }}
            className={`relative z-10 rounded-[calc(var(--radius-control)-2px)] py-1.5 text-footnote whitespace-nowrap transition-colors ${
              fullWidth ? 'flex-auto px-2.5' : 'shrink-0 px-3.5'
            } ${selected ? 'font-medium text-text-1' : 'text-text-2 hover:text-text-1'}`}
          >
            {segment.short ? (
              <>
                <span className="sm:hidden">{segment.short}</span>
                <span className="hidden sm:inline">{segment.label}</span>
              </>
            ) : (
              segment.label
            )}
          </button>
        );
      })}
    </div>
  );
}
