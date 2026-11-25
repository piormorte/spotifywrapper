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

describe('date and size formatting', () => {
  const t = Date.UTC(2024, 0, 5, 16, 45);
  it('formats dates in a given time zone', async () => {
    const { formatDate, formatDateTime } = await import('./format.ts');
    expect(formatDate(t, 'America/Sao_Paulo')).toBe('5 de janeiro de 2024');
    expect(formatDateTime(t, 'America/Sao_Paulo')).toBe('5 de jan. de 2024, 13:45');
  });

  it('formats byte sizes', async () => {
    const { formatBytes } = await import('./format.ts');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(13_002_342)).toBe('12,4 MB');
  });
});

describe('short forms', () => {
  it('formats short dates, plurals and hours', async () => {
    const { formatDateShort, plural, formatHours } = await import('./format.ts');
    expect(formatDateShort(Date.UTC(2024, 0, 5, 12), 'UTC')).toBe('5 jan. 2024');
    expect(plural(1, 'registro', 'registros')).toBe('1 registro');
    expect(plural(1200, 'registro', 'registros')).toBe('1.200 registros');
    expect(formatHours(4.46)).toBe('4,5');
    expect(formatHours(803.4)).toBe('803');
  });
});

describe('formatDuration', () => {
  it('switches from minutes to hours at one hour', async () => {
    const { formatDuration } = await import('./format.ts');
    expect(formatDuration(45 * 60_000)).toBe('45 min');
    expect(formatDuration(90 * 60_000)).toBe('1,5 h');
    expect(formatDuration(27 * 3_600_000)).toBe('27 h');
  });
});

describe('local wall-clock formatting', () => {
  it('formats local ms without shifting zones', async () => {
    const { formatLocalDate, formatLocalDateLong, formatLocalTime, formatClock } =
      await import('./format.ts');
    const local = Date.UTC(2024, 0, 5, 23, 30);
    expect(formatLocalDate(local)).toBe('5 jan. 2024');
    expect(formatLocalDateLong(local)).toBe('sexta-feira, 5 janeiro 2024');
    expect(formatLocalTime(local)).toBe('23:30');
    expect(formatClock(185_000)).toBe('3:05');
    expect(formatClock(3_729_000)).toBe('1:02:09');
  });
});
