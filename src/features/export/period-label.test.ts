import { describe, expect, it } from 'vitest';
import { monthLabel, monthSpec, monthsBetween, periodLabel, yearSpec } from './period-label.ts';

describe('export period helpers', () => {
  it('labels periods', () => {
    expect(periodLabel({ preset: 'all' }, '2025-06-29')).toBe('Todo o período');
    expect(periodLabel({ preset: 'year' }, '2025-06-29')).toBe('2025');
    expect(periodLabel({ preset: 'custom', start: '2024-01-01', end: '2024-03-31' }, '')).toBe(
      '1 jan. 2024 – 31 mar. 2024',
    );
    expect(monthLabel('2025-03')).toBe('março 2025');
  });

  it('lists months and builds month and year ranges', () => {
    expect(monthsBetween('2024-11-15', '2025-02-01')).toEqual([
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
    ]);
    expect(monthSpec('2024-02')).toEqual({
      preset: 'custom',
      start: '2024-02-01',
      end: '2024-02-29',
    });
    expect(yearSpec(2023)).toEqual({ preset: 'custom', start: '2023-01-01', end: '2023-12-31' });
  });
});
