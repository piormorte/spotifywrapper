import { useId } from 'react';
import { layoutGroupedBars } from '../charts/bars.ts';
import { useElementWidth } from './useElementWidth.ts';

interface GroupedBarChartProps {
  readonly title: string;
  /** Two or more series; the last one is drawn in the primary text color. */
  readonly series: readonly (readonly number[])[];
  readonly seriesNames: readonly string[];
  readonly labels: readonly string[];
  readonly height?: number;
  readonly formatValue: (value: number) => string;
}

const LABEL_SPACE = 22;
/** Earlier series in gray, the latest in the primary text color. Never the accent. */
const SERIES_CLASS = ['fill-fill-2', 'fill-text-1'];

export function GroupedBarChart({
  title,
  series,
  seriesNames,
  labels,
  height = 180,
  formatValue,
}: GroupedBarChartProps) {
  const titleId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const plot = height - LABEL_SPACE;
  const rects =
    width > 0 ? layoutGroupedBars({ series, width, height: plot, minVisibleHeight: 2 }) : [];
  const groupCenters = new Map<number, number>();
  for (const r of rects) {
    if (r.series === series.length - 1) groupCenters.set(r.index, r.x + r.width);
  }

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 && (
        <svg role="img" aria-labelledby={titleId} width={width} height={height} className="block">
          <title id={titleId}>{title}</title>
          {rects.map((r) => (
            <rect
              key={`${r.index}-${r.series}`}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              rx={Math.min(2, r.width / 2)}
              className={SERIES_CLASS[Math.min(r.series, SERIES_CLASS.length - 1)]}
            >
              <title>{`${labels[r.index] ?? ''} · ${seriesNames[r.series] ?? ''}: ${formatValue(r.value)}`}</title>
            </rect>
          ))}
          {labels.map((label, i) => {
            const first = rects.find((r) => r.index === i && r.series === 0);
            const end = groupCenters.get(i);
            if (!first || end === undefined) return null;
            return (
              <text
                key={label + String(i)}
                x={(first.x + end) / 2}
                y={height - 4}
                textAnchor="middle"
                className="fill-text-3 text-caption"
              >
                {label}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
