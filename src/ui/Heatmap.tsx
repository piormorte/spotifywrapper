interface HeatmapProps {
  readonly title: string;
  /** values[row][column] */
  readonly values: readonly (readonly number[])[];
  readonly rowLabels: readonly string[];
  /** Label shown above every `columnLabelEvery`-th column. */
  readonly columnLabels: readonly string[];
  readonly columnLabelEvery?: number;
  readonly formatCell: (row: number, column: number, value: number) => string;
}

/**
 * Monochrome grid: opacity of the primary text color encodes the value
 * (square-root scale so quiet hours stay distinguishable). No accent.
 */
export function Heatmap({
  title,
  values,
  rowLabels,
  columnLabels,
  columnLabelEvery = 6,
  formatCell,
}: HeatmapProps) {
  const max = Math.max(0, ...values.flat());
  const columns = values[0]?.length ?? 0;

  return (
    <figure aria-label={title} className="w-full">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `2.25rem repeat(${String(columns)}, minmax(0, 1fr))` }}
      >
        <span />
        {Array.from({ length: columns }, (_, c) => (
          <span
            key={`h${String(c)}`}
            className="text-caption tracking-normal text-text-3 normal-case"
          >
            {c % columnLabelEvery === 0 ? columnLabels[c] : ''}
          </span>
        ))}
        {values.map((row, r) => (
          <div key={`r${String(r)}`} className="contents">
            <span className="self-center text-footnote text-text-2">{rowLabels[r]}</span>
            {row.map((value, c) => {
              const intensity = max > 0 ? Math.sqrt(value / max) : 0;
              return (
                <span
                  key={`c${String(c)}`}
                  title={formatCell(r, c, value)}
                  className="aspect-square rounded-[3px] bg-fill-1"
                >
                  <span
                    aria-hidden
                    className="block h-full w-full rounded-[3px] bg-text-1"
                    style={{ opacity: intensity * 0.9 }}
                  />
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </figure>
  );
}
