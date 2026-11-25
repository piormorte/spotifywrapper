import { useId } from 'react';
import { indexOfMax, layoutBars } from '../charts/bars.ts';
import { useElementWidth } from './useElementWidth.ts';

interface BarChartProps {
  /** Accessible description of what the chart shows. */
  readonly title: string;
  readonly values: readonly number[];
  /** One label per bar; only every `labelEvery`-th label is drawn. */
  readonly labels: readonly string[];
  readonly labelEvery?: number;
  readonly height?: number;
  /** Highlight the maximum with the accent color (one accent per chart). */
  readonly highlightMax?: boolean;
  readonly formatValue: (value: number) => string;
}

const LABEL_SPACE = 22;

/**
 * Single-series bar chart: no gridlines, no axis lines, sparse labels.
 * Geometry comes from charts/bars.ts so Canvas exports match exactly.
 */
export function BarChart({
  title,
  values,
  labels,
  labelEvery = 1,
  height = 160,
  highlightMax = true,
  formatValue,
}: BarChartProps) {
  const titleId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const plotHeight = height - LABEL_SPACE;
  const bars =
    width > 0
      ? layoutBars({
          values,
          width,
          height: plotHeight,
          padding: values.length <= 12 ? 0.55 : 0.32,
          minVisibleHeight: 2,
        })
      : [];
  const maxIndex = highlightMax ? indexOfMax(values) : -1;

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 && (
        <svg role="img" aria-labelledby={titleId} width={width} height={height} className="block">
          <title id={titleId}>{title}</title>
          {bars.map((bar) => (
            <rect
              key={bar.index}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={Math.min(2, bar.width / 2)}
              className={`transition-[y,height] duration-500 ease-emphasized ${
                bar.index === maxIndex ? 'fill-accent' : 'fill-fill-2'
              }`}
            >
              <title>{`${labels[bar.index] ?? ''}: ${formatValue(bar.value)}`}</title>
            </rect>
          ))}
          {bars.map((bar) =>
            bar.index % labelEvery === 0 ? (
              <text
                key={`label-${bar.index}`}
                x={
                  bar.index === 0
                    ? bar.x
                    : bar.index === bars.length - 1
                      ? bar.x + bar.width
                      : bar.x + bar.width / 2
                }
                y={height - 4}
                textAnchor={
                  bar.index === 0 ? 'start' : bar.index === bars.length - 1 ? 'end' : 'middle'
                }
                className="fill-text-3 text-caption"
              >
                {labels[bar.index]}
              </text>
            ) : null,
          )}
        </svg>
      )}
    </div>
  );
}
