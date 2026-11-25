/**
 * Locale-aware number formatting for the UI and exports.
 * Formatters are created once per locale; Intl construction is comparatively expensive.
 */

export const DEFAULT_LOCALE = 'pt-BR';

const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let nf = cache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, options);
    cache.set(key, nf);
  }
  return nf;
}

/** Whole number with grouping, rounded half away from zero ("48.213"). */
export function formatInteger(value: number, locale = DEFAULT_LOCALE): string {
  return formatter(locale, { maximumFractionDigits: 0 }).format(Math.round(value));
}

/** Fixed number of fraction digits ("33,5"). */
export function formatDecimal(value: number, digits: number, locale = DEFAULT_LOCALE): string {
  return formatter(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Share in [0, 1] as a percentage ("42%"). */
export function formatPercent(share: number, digits = 0, locale = DEFAULT_LOCALE): string {
  return formatter(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(share);
}
