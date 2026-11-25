import { useRef, type KeyboardEvent } from 'react';

export interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface OptionListProps<T extends string> {
  readonly label: string;
  readonly options: readonly Option<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Tailwind grid classes for the layout. */
  readonly className?: string;
}

/**
 * A grid of single-choice options (radio group semantics) for longer lists
 * than a segmented control fits. Arrow keys, Home and End move the selection;
 * only the selected option is in the tab order.
 */
export function OptionList<T extends string>({
  label,
  options,
  value,
  onChange,
  className = 'grid gap-1',
}: OptionListProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (event: KeyboardEvent) => {
    const last = options.length - 1;
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? selected === last
          ? 0
          : selected + 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? selected === 0
            ? last
            : selected - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={className}>
      {options.map((o, i) => {
        const isSelected = i === selected;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              onChange(o.value);
            }}
            className={`pressable rounded-control px-3 py-1.5 text-left text-callout ${
              isSelected ? 'bg-fill-1 font-medium text-text-1' : 'text-text-2 hover:text-text-1'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
