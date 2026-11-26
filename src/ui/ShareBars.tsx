export interface ShareItem {
  readonly key: string;
  readonly label: string;
  /** 0–1 */
  readonly share: number;
  /** Pre-formatted value shown at the end of the row. */
  readonly value: string;
}

/**
 * Horizontal composition bars: one row per item, the largest in the accent
 * (once), the rest in the neutral series fill.
 */
export function ShareBars({
  label,
  items,
  highlightMax = true,
}: {
  readonly label: string;
  readonly items: readonly ShareItem[];
  readonly highlightMax?: boolean;
}) {
  const max = Math.max(0, ...items.map((i) => i.share));
  const maxIndex = highlightMax && max > 0 ? items.findIndex((i) => i.share === max) : -1;
  return (
    <ul aria-label={label} className="space-y-3.5">
      {items.map((item, index) => (
        <li key={item.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-footnote">
            <span className="truncate font-medium text-text-1">{item.label}</span>
            <span className="numeric shrink-0 text-text-2">{item.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fill-1">
            <div
              className={`motion-move h-full rounded-full transition-[width] duration-700 ease-out ${
                index === maxIndex ? 'bg-accent' : 'bg-fill-2'
              }`}
              style={{ width: `${Math.max(item.share > 0 ? 1.5 : 0, item.share * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
