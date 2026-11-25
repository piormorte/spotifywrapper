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

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, f);
  }
  return f;
}

/** "5 de janeiro de 2024" in the given (or device) time zone. */
export function formatDate(ms: number, timeZone?: string, locale = DEFAULT_LOCALE): string {
  return dateFormatter(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(ms);
}

/** "5 jan. 2024, 13:45" in the given (or device) time zone. */
export function formatDateTime(ms: number, timeZone?: string, locale = DEFAULT_LOCALE): string {
  return dateFormatter(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(ms);
}

/** File size in KB/MB with one decimal ("12,4 MB"). */
export function formatBytes(bytes: number, locale = DEFAULT_LOCALE): string {
  if (bytes < 1024 * 1024) return `${formatDecimal(bytes / 1024, 0, locale)} KB`;
  return `${formatDecimal(bytes / (1024 * 1024), 1, locale)} MB`;
}

/** "5 jan. 2024" in the given (or device) time zone. */
export function formatDateShort(ms: number, timeZone?: string, locale = DEFAULT_LOCALE): string {
  return dateFormatter(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  })
    .format(ms)
    .replace(/ de /g, ' ');
}

/** Count with the right noun form: "1 registro", "2 registros". */
export function plural(count: number, one: string, many: string, locale = DEFAULT_LOCALE): string {
  return `${formatInteger(count, locale)} ${count === 1 ? one : many}`;
}

/** Hours with one decimal below 10 h, whole hours above ("4,5" / "803"). */
export function formatHours(hours: number, locale = DEFAULT_LOCALE): string {
  return hours < 10 ? formatDecimal(hours, 1, locale) : formatInteger(hours, locale);
}
