/**
 * Count-up animation support for pre-formatted figures ("48.213", "33,5", "42%").
 * Only plain pt-BR numbers animate; anything else (dates, clocks, years) is
 * shown as is. The final frame always renders the original string untouched.
 */

export interface CountTarget {
  readonly value: number;
  readonly decimals: number;
  readonly grouped: boolean;
  readonly prefix: string;
  readonly suffix: string;
}

const PATTERN = /^([+−-]?)(\d{1,3}(?:\.\d{3})+|\d{1,3})(?:,(\d+))?(\s?%?)$/u;

/** Parses a formatted number, or returns null when it should not animate. */
export function parseCountTarget(text: string): CountTarget | null {
  const match = PATTERN.exec(text);
  if (!match) return null;
  const [, sign = '', integer = '', fraction = '', suffix = ''] = match;
  const digits = integer.replaceAll('.', '');
  const value = Number(`${digits}${fraction ? `.${fraction}` : ''}`);
  if (!Number.isFinite(value)) return null;
  return { value, decimals: fraction.length, grouped: integer.includes('.'), prefix: sign, suffix };
}

function group(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
}

/** Renders an intermediate value in the same shape as the target. */
export function formatCountFrame(target: CountTarget, value: number): string {
  const fixed = Math.abs(value).toFixed(target.decimals);
  const [integer = '0', fraction] = fixed.split('.');
  const body = `${target.grouped ? group(integer) : integer}${fraction ? `,${fraction}` : ''}`;
  return `${target.prefix}${body}${target.suffix}`;
}

/** Ease-out (exponential): fast start, long gentle settle, like iOS counters. */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}
