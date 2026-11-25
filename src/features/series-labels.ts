import type { Granularity } from '../stats/period.ts';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Short axis label for a bucket key ("2024", "mar", "4/3", "5"). */
export function seriesLabel(key: string, granularity: Granularity): string {
  switch (granularity) {
    case 'year':
      return key;
    case 'month':
      return MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
    case 'week':
      return `${String(Number(key.slice(8, 10)))}/${String(Number(key.slice(5, 7)))}`;
    case 'day':
      return String(Number(key.slice(8, 10)));
  }
}

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? '';
}

export const GRANULARITY_NOUN: Record<Granularity, string> = {
  year: 'ano',
  month: 'mês',
  week: 'semana',
  day: 'dia',
};

/** Shows every n-th label so axis text never collides. */
export function labelEvery(count: number, granularity: Granularity): number {
  const target = granularity === 'year' ? 12 : granularity === 'month' ? 12 : 8;
  return Math.max(1, Math.ceil(count / target));
}
