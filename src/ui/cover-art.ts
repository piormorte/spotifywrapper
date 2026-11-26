/**
 * Typographic cover art. The exported history has no images and v1 never
 * fetches any (docs/PLANNING.md §3.3), so albums and artists get a generated,
 * deterministic artwork: a muted two-tone gradient whose hue comes from the
 * name, and the name's initials. It never imitates a real cover.
 */

export interface CoverArt {
  /** Hue in degrees, 0–359. */
  readonly hue: number;
  /** Second hue for the gradient. */
  readonly hue2: number;
  /** Light source position, one of four corners. */
  readonly corner: 0 | 1 | 2 | 3;
  /** Up to two initials, uppercase. */
  readonly initials: string;
}

/** 32-bit FNV-1a over the code points of a string. */
export function hashName(name: string): number {
  let h = 0x811c9dc5;
  for (const ch of name.normalize('NFKC').toLocaleLowerCase('pt-BR')) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Words that never give an initial ("The Band" → "B"). */
const SKIP = new Set([
  'the',
  'a',
  'an',
  'o',
  'os',
  'as',
  'el',
  'la',
  'le',
  'les',
  'de',
  'da',
  'do',
]);

export function initialsOf(name: string): string {
  const words = name
    .normalize('NFC')
    .split(/[\s\-–—_/&+.,:;()[\]]+/u)
    .filter((w) => /\p{L}|\p{N}/u.test(w));
  const meaningful = words.filter((w) => !SKIP.has(w.toLocaleLowerCase('pt-BR')));
  const pick = (meaningful.length > 0 ? meaningful : words).slice(0, 2);
  const letters = pick.map((w) => Array.from(w.replace(/[^\p{L}\p{N}]/gu, ''))[0] ?? '');
  return letters.join('').toLocaleUpperCase('pt-BR') || '·';
}

export function coverArt(name: string): CoverArt {
  const h = hashName(name);
  const hue = h % 360;
  return {
    hue,
    hue2: (hue + 28 + ((h >>> 9) % 50)) % 360,
    corner: ((h >>> 17) % 4) as CoverArt['corner'],
    initials: initialsOf(name),
  };
}

const CORNERS = ['0% 0%', '100% 0%', '100% 100%', '0% 100%'] as const;

/** CSS background for the artwork: deliberately low chroma, dark enough for white type. */
export function coverBackground(art: CoverArt): string {
  const at = CORNERS[art.corner];
  return [
    `radial-gradient(120% 120% at ${at}, oklch(0.52 0.085 ${art.hue}) 0%, transparent 62%)`,
    `linear-gradient(155deg, oklch(0.34 0.06 ${art.hue}) 0%, oklch(0.2 0.035 ${art.hue2}) 100%)`,
  ].join(', ');
}
