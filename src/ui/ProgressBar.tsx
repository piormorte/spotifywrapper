interface ProgressBarProps {
  readonly label: string;
  /** 0–1, or null for indeterminate. */
  readonly value: number | null;
}

/** Hairline progress indicator in the accent color. */
export function ProgressBar({ label, value }: ProgressBarProps) {
  const pct = value === null ? null : Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct ?? undefined}
      className="h-1 w-full overflow-hidden rounded-full bg-fill-1"
    >
      <div
        className={`motion-move h-full rounded-full bg-accent transition-[width] duration-300 ease-standard ${
          pct === null ? 'w-1/3 animate-pulse' : ''
        }`}
        style={pct === null ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}
