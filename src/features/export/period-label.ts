import { formatLocalDate } from '../../lib/format.ts';
import { parseDayKey, type PeriodSpec } from '../../stats/period.ts';

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function monthLabel(key: string): string {
  return `${MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? ''} ${key.slice(0, 4)}`;
}

/** Human label for a period, shown as the piece's kicker. */
export function periodLabel(spec: PeriodSpec, dataLastDay: string): string {
  switch (spec.preset) {
    case 'all':
      return 'Todo o período';
    case 'year':
      return dataLastDay.slice(0, 4);
    case '12m':
      return 'Últimos 12 meses';
    case '6m':
      return 'Últimos 6 meses';
    case '30d':
      return 'Últimos 30 dias';
    case 'custom': {
      const a = parseDayKey(spec.start);
      const b = parseDayKey(spec.end);
      return a === null || b === null ? '' : `${formatLocalDate(a)} – ${formatLocalDate(b)}`;
    }
  }
}

/** Every "YYYY-MM" from the first to the last day with data. */
export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  let y = Number(first.slice(0, 4));
  let m = Number(first.slice(5, 7));
  const endY = Number(last.slice(0, 4));
  const endM = Number(last.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${String(y)}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function monthSpec(key: string): PeriodSpec {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    preset: 'custom',
    start: `${key}-01`,
    end: `${key}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function yearSpec(year: number): PeriodSpec {
  return { preset: 'custom', start: `${String(year)}-01-01`, end: `${String(year)}-12-31` };
}
