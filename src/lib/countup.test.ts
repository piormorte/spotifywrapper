import { describe, expect, it } from 'vitest';
import { easeOutExpo, formatCountFrame, parseCountTarget } from './countup.ts';

describe('parseCountTarget', () => {
  it('parses grouped integers, decimals and percentages', () => {
    expect(parseCountTarget('48.213')).toEqual({
      value: 48213,
      decimals: 0,
      grouped: true,
      prefix: '',
      suffix: '',
    });
    expect(parseCountTarget('33,5')?.value).toBe(33.5);
    expect(parseCountTarget('42%')?.suffix).toBe('%');
    expect(parseCountTarget('−12%')?.prefix).toBe('−');
  });

  it('leaves dates, clocks and ungrouped long numbers alone', () => {
    expect(parseCountTarget('25 nov')).toBeNull();
    expect(parseCountTarget('1:23:45')).toBeNull();
    expect(parseCountTarget('2024')).toBeNull();
    expect(parseCountTarget('')).toBeNull();
  });
});

describe('formatCountFrame', () => {
  it('keeps the target shape', () => {
    const target = parseCountTarget('48.213');
    if (!target) throw new Error('expected a target');
    expect(formatCountFrame(target, 1234.4)).toBe('1.234');
    expect(formatCountFrame(target, 48213)).toBe('48.213');
    const decimal = parseCountTarget('1.033,5');
    if (!decimal) throw new Error('expected a target');
    expect(formatCountFrame(decimal, 7.25)).toBe('7,3');
    expect(formatCountFrame(decimal, 1033.5)).toBe('1.033,5');
  });
});

describe('easeOutExpo', () => {
  it('runs from 0 to exactly 1', () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(0.5)).toBeGreaterThan(0.9);
  });
});
