import type { PeriodSpec } from '../../stats/period.ts';

/** Subject and verb of the identity sentence for a period ("Seu 2024 soou como"). */
export function identityLead(spec: PeriodSpec, dataLastDay: string): string {
  switch (spec.preset) {
    case 'all':
      return 'Sua história soou como';
    case 'year':
      return `Seu ${dataLastDay.slice(0, 4)} soou como`;
    case '12m':
      return 'Seus últimos 12 meses soaram como';
    case '6m':
      return 'Seus últimos 6 meses soaram como';
    case '30d':
      return 'Seus últimos 30 dias soaram como';
    case 'custom':
      return 'Este período soou como';
  }
}

/** Relative change, or null when the base is zero (no meaningful comparison). */
export function relativeChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}
