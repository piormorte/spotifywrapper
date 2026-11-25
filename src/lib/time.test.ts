import { describe, expect, it } from 'vitest';
import {
  isValidTimeZone,
  localDayKey,
  localHour,
  timeZoneOffsetMs,
  zonedTimeToUtc,
} from './time.ts';

const H = 3_600_000;

describe('time zones', () => {
  it('computes offsets, including historical and DST rules', () => {
    expect(timeZoneOffsetMs(Date.UTC(2024, 0, 15), 'America/Sao_Paulo')).toBe(-3 * H);
    // Brazil still observed DST in January 2018 (UTC−2).
    expect(timeZoneOffsetMs(Date.UTC(2018, 0, 15), 'America/Sao_Paulo')).toBe(-2 * H);
    expect(timeZoneOffsetMs(Date.UTC(2024, 6, 1), 'Europe/Lisbon')).toBe(1 * H);
    expect(timeZoneOffsetMs(Date.UTC(2024, 0, 1), 'Asia/Kolkata')).toBe(5.5 * H);
    expect(timeZoneOffsetMs(Date.UTC(2024, 0, 1), 'UTC')).toBe(0);
  });

  it('derives local day and hour from a UTC instant', () => {
    const t = Date.UTC(2024, 2, 1, 1, 30); // 01:30 UTC
    expect(localDayKey(t, 'America/Sao_Paulo')).toBe('2024-02-29');
    expect(localHour(t, 'America/Sao_Paulo')).toBe(22);
    expect(localDayKey(t, 'UTC')).toBe('2024-03-01');
  });

  it('converts wall-clock time to UTC', () => {
    const local = { year: 2024, month: 1, day: 5, hour: 13, minute: 45 };
    expect(zonedTimeToUtc(local, 'America/Sao_Paulo')).toBe(Date.UTC(2024, 0, 5, 16, 45));
    expect(zonedTimeToUtc(local, 'UTC')).toBe(Date.UTC(2024, 0, 5, 13, 45));
  });

  it('resolves DST gaps and overlaps deterministically', () => {
    // 2024-03-31 01:30 does not exist in Lisbon (clocks jump 01:00 → 02:00).
    const gap = zonedTimeToUtc(
      { year: 2024, month: 3, day: 31, hour: 1, minute: 30 },
      'Europe/Lisbon',
    );
    expect(gap).toBe(Date.UTC(2024, 2, 31, 1, 30));
    // 2024-10-27 01:30 happens twice in Lisbon; the earlier instant (UTC+1) wins.
    const overlap = zonedTimeToUtc(
      { year: 2024, month: 10, day: 27, hour: 1, minute: 30 },
      'Europe/Lisbon',
    );
    expect(overlap).toBe(Date.UTC(2024, 9, 27, 0, 30));
  });

  it('validates zone names', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
