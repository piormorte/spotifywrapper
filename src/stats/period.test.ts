import { describe, expect, it } from 'vitest';
import {
  addMonths,
  bucketKeys,
  dayKey,
  granularityFor,
  parseDayKey,
  resolvePeriod,
} from './period.ts';

const D = 86_400_000;
const at = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m - 1, d, h);
const range = { first: at(2016, 5, 10, 14), last: at(2024, 3, 15, 22) };

describe('day keys', () => {
  it('round-trips and validates', () => {
    expect(dayKey(at(2024, 2, 29, 23))).toBe('2024-02-29');
    expect(parseDayKey('2024-02-29')).toBe(at(2024, 2, 29));
    expect(parseDayKey('2023-02-29')).toBeNull();
    expect(parseDayKey('2024-2-1')).toBeNull();
  });

  it('adds months clamping to month length', () => {
    expect(dayKey(addMonths(at(2024, 3, 31), -1))).toBe('2024-02-29');
    expect(dayKey(addMonths(at(2024, 3, 16), -12))).toBe('2023-03-16');
  });
});

describe('resolvePeriod', () => {
  it('all time spans first to last data day, inclusive', () => {
    const p = resolvePeriod({ preset: 'all' }, range);
    expect(p).toMatchObject({ from: at(2016, 5, 10), to: at(2024, 3, 16), granularity: 'year' });
    expect(p?.days).toBe((at(2024, 3, 16) - at(2016, 5, 10)) / D);
  });

  it('presets end on the last day with data', () => {
    expect(resolvePeriod({ preset: 'year' }, range)).toMatchObject({
      from: at(2024, 1, 1),
      to: at(2024, 3, 16),
      days: 75,
      granularity: 'month',
    });
    expect(resolvePeriod({ preset: '12m' }, range)).toMatchObject({
      from: at(2023, 3, 16),
      days: 366,
    });
    expect(resolvePeriod({ preset: '6m' }, range)).toMatchObject({ from: at(2023, 9, 16) });
    expect(resolvePeriod({ preset: '30d' }, range)).toMatchObject({
      from: at(2024, 2, 15),
      days: 30,
      granularity: 'day',
    });
  });

  it('never starts a preset before the first day with data', () => {
    const short = { first: at(2024, 3, 1, 9), last: at(2024, 3, 15) };
    expect(resolvePeriod({ preset: '12m' }, short)).toMatchObject({
      from: at(2024, 3, 1),
      days: 15,
    });
  });

  it('resolves custom ranges inclusively and rejects invalid ones', () => {
    expect(
      resolvePeriod({ preset: 'custom', start: '2020-01-01', end: '2020-01-31' }, range),
    ).toMatchObject({ from: at(2020, 1, 1), to: at(2020, 2, 1), days: 31 });
    expect(
      resolvePeriod({ preset: 'custom', start: '2020-02-01', end: '2020-01-01' }, range),
    ).toBeNull();
    expect(resolvePeriod({ preset: 'custom', start: 'x', end: '2020-01-01' }, range)).toBeNull();
  });
});

describe('buckets', () => {
  it('chooses granularity by length', () => {
    expect(granularityFor(30)).toBe('day');
    expect(granularityFor(63)).toBe('month');
    expect(granularityFor(800)).toBe('year');
  });

  it('lists every bucket in the period', () => {
    const p = resolvePeriod({ preset: 'year' }, range);
    expect(p && bucketKeys(p)).toEqual(['2024-01', '2024-02', '2024-03']);
    const all = resolvePeriod({ preset: 'all' }, range);
    expect(all && bucketKeys(all)).toEqual([
      '2016',
      '2017',
      '2018',
      '2019',
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
    ]);
    const d = resolvePeriod({ preset: 'custom', start: '2024-02-27', end: '2024-03-01' }, range);
    expect(d && bucketKeys(d)).toEqual(['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01']);
  });
});

describe('weeks', () => {
  it('starts ISO weeks on Monday', async () => {
    const { weekStart, weekday, bucketKeysBetween } = await import('./period.ts');
    expect(dayKey(weekStart(at(2024, 3, 6)))).toBe('2024-03-04'); // Wednesday → Monday
    expect(dayKey(weekStart(at(2024, 3, 4)))).toBe('2024-03-04');
    expect(dayKey(weekStart(at(2024, 3, 10, 23)))).toBe('2024-03-04'); // Sunday
    expect(weekday(at(2024, 3, 4))).toBe(0);
    expect(weekday(at(2024, 3, 10))).toBe(6);
    expect(bucketKeysBetween(at(2024, 3, 6), at(2024, 3, 20), 'week')).toEqual([
      '2024-03-04',
      '2024-03-11',
      '2024-03-18',
    ]);
  });
});
