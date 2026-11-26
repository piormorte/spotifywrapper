import { useId, useState, type PointerEvent } from 'react';
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
 * Single-series bar chart: no gridlines, no axis lines, sparse labels, a
 * quiet tooltip on hover. Geometry comes from charts/bars.ts so Canvas
 * exports match exactly.
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
  const [hover, setHover] = useState<number | null>(null);
  const plotHeight = height - LABEL_SPACE;
  const bars =
    width > 0
      ? layoutBars({
          values,
          width,
          height: plotHeight,
          padding: values.length <= 12 ? 0.5 : 0.28,
          minVisibleHeight: 2,
        })
      : [];
  const maxIndex = highlightMax ? indexOfMax(values) : -1;

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (bars.length === 0) return;
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    const step = width / bars.length;
    setHover(Math.min(bars.length - 1, Math.max(0, Math.floor(x / step))));
  };

  const hovered = hover === null ? undefined : bars[hover];

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          role="img"
          aria-labelledby={titleId}
          width={width}
          height={height}
          className="block touch-pan-y"
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            setHover(null);
          }}
        >
          <title id={titleId}>{title}</title>
          {bars.map((bar) => (
            <rect
              key={bar.index}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={Math.min(3, bar.width / 2)}
              className={`motion-move transition-[y,height,fill,opacity] duration-500 ease-emphasized ${
                bar.index === maxIndex ? 'fill-accent' : 'fill-fill-2'
              } ${hover !== null && hover !== bar.index ? 'opacity-55' : 'opacity-100'}`}
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
      {hovered && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-tile bg-surface-2 px-2.5 py-1.5 text-footnote whitespace-nowrap shadow-raised"
          style={{
            left: Math.min(Math.max(hovered.x + hovered.width / 2, 56), width - 56),
            top: Math.max(hovered.y - 8, 40),
          }}
        >
          <span className="block text-caption text-text-3">{labels[hovered.index]}</span>
          <span className="numeric font-medium text-text-1">{formatValue(hovered.value)}</span>
        </div>
      )}
    </div>
  );
}
