import { describe, expect, it } from 'vitest';
import { indexOfMax, layoutBars } from './bars.ts';

describe('layoutBars', () => {
  it('scales the tallest bar to the full height and aligns bars to the baseline', () => {
    const bars = layoutBars({ values: [10, 5, 0], width: 300, height: 100, padding: 0 });
    expect(bars.map((b) => b.height)).toEqual([100, 50, 0]);
    expect(bars.every((b) => b.y + b.height === 100)).toBe(true);
    expect(bars.map((b) => b.x)).toEqual([0, 100, 200]);
    expect(bars[0]?.width).toBe(100);
  });

  it('keeps tiny non-zero values visible', () => {
    const bars = layoutBars({ values: [1000, 1], width: 100, height: 100, minVisibleHeight: 2 });
    expect(bars[1]?.height).toBe(2);
  });

  it('handles an all-zero series without dividing by zero', () => {
    const bars = layoutBars({ values: [0, 0], width: 10, height: 10 });
    expect(bars.map((b) => b.height)).toEqual([0, 0]);
  });

  it('rejects invalid input', () => {
    expect(() => layoutBars({ values: [-1], width: 10, height: 10 })).toThrow(RangeError);
    expect(() => layoutBars({ values: [1], width: 0, height: 10 })).toThrow(RangeError);
  });
});

describe('indexOfMax', () => {
  it('returns the first maximum or -1 when empty', () => {
    expect(indexOfMax([1, 3, 3, 2])).toBe(1);
    expect(indexOfMax([])).toBe(-1);
  });
});

describe('layoutGroupedBars', () => {
  it('places series side by side on a shared scale', async () => {
    const { layoutGroupedBars } = await import('./bars.ts');
    const rects = layoutGroupedBars({
      series: [
        [10, 5],
        [20, 0, 4],
      ],
      width: 300,
      height: 100,
      groupPadding: 0,
      barGap: 0,
    });
    expect(rects).toHaveLength(6);
    expect(rects.map((r) => [r.index, r.series, r.x, r.width, r.height])).toEqual([
      [0, 0, 0, 50, 50],
      [0, 1, 50, 50, 100],
      [1, 0, 100, 50, 25],
      [1, 1, 150, 50, 0],
      [2, 0, 200, 50, 0],
      [2, 1, 250, 50, 20],
    ]);
  });

  it('returns nothing for empty input', async () => {
    const { layoutGroupedBars } = await import('./bars.ts');
    expect(layoutGroupedBars({ series: [], width: 10, height: 10 })).toEqual([]);
  });
});
