import { scaleBand, scaleLinear } from 'd3-scale';

/**
 * Framework-free bar geometry shared by the SVG UI and the Canvas exports,
 * so both render identical charts from the same numbers.
 */

export interface BarLayoutInput {
  readonly values: readonly number[];
  readonly width: number;
  readonly height: number;
  /** Gap between bars as a fraction of the band, in [0, 1). */
  readonly padding?: number;
  /** Non-zero values never render shorter than this, so they stay visible. */
  readonly minVisibleHeight?: number;
}

export interface BarRect {
  readonly index: number;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function layoutBars(input: BarLayoutInput): BarRect[] {
  const { values, width, height, padding = 0.3, minVisibleHeight = 1 } = input;
  if (width <= 0 || height <= 0) throw new RangeError('Chart size must be positive');
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`Bar values must be >= 0 (got ${v})`);
  }

  const x = scaleBand<number>()
    .domain(values.map((_, i) => i))
    .range([0, width])
    .paddingInner(padding)
    .paddingOuter(0);
  const max = Math.max(0, ...values);
  const y = scaleLinear()
    .domain([0, max === 0 ? 1 : max])
    .range([0, height]);

  return values.map((value, index) => {
    const raw = y(value);
    const h = value > 0 ? Math.max(raw, minVisibleHeight) : 0;
    return { index, value, x: x(index) ?? 0, y: height - h, width: x.bandwidth(), height: h };
  });
}

/** Index of the largest value (first one on ties), or -1 for an empty series. */
export function indexOfMax(values: readonly number[]): number {
  let best = -1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== undefined && (best === -1 || v > (values[best] ?? -Infinity))) best = i;
  }
  return best;
}
