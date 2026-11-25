import { describe, expect, it } from 'vitest';
import { formatDecimal, formatInteger, formatPercent } from './format.ts';

describe('number formatting (pt-BR)', () => {
  it('groups thousands and rounds integers', () => {
    expect(formatInteger(48213.4)).toBe('48.213');
    expect(formatInteger(999.5)).toBe('1.000');
    expect(formatInteger(0)).toBe('0');
  });

  it('formats a fixed number of decimals', () => {
    expect(formatDecimal(33.48, 1)).toBe('33,5');
    expect(formatDecimal(2, 1)).toBe('2,0');
  });

  it('formats shares as percentages', () => {
    expect(formatPercent(0.4213)).toBe('42%');
    expect(formatPercent(0.4213, 1)).toBe('42,1%');
  });

  it('supports other locales', () => {
    expect(formatInteger(48213, 'en-US')).toBe('48,213');
  });
});
