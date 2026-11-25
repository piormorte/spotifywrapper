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
