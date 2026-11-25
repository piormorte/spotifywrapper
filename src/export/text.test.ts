import { describe, expect, it } from 'vitest';
import { fitText, wrapText } from './text.ts';
import { fakeCtx } from './test-ctx.ts';

describe('text fitting', () => {
  const ctx = fakeCtx(); // every character is 10 px wide

  it('keeps text that fits and ellipsizes text that does not', () => {
    expect(fitText(ctx, 'abcde', 50)).toBe('abcde');
    expect(fitText(ctx, 'abcdefghij', 50)).toBe('abcd…');
    expect(fitText(ctx, 'abcdef', 5)).toBe('…');
  });

  it('wraps by words and ellipsizes the last allowed line', () => {
    expect(wrapText(ctx, 'one two three four', 90, 3)).toEqual(['one two', 'three', 'four']);
    expect(wrapText(ctx, 'one two three four five six', 90, 2)).toEqual(['one two', 'three fo…']);
  });
});
