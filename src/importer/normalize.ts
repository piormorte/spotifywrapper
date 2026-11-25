/** Text normalization and identity keys. Pure and deterministic. */

/** NFC, trimmed, inner whitespace collapsed. Returns null for empty input. */
export function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}

/** Case- and width-insensitive key for matching names ("Beyoncé" = "BEYONCÉ"). */
export function nameKey(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

/** 53-bit string hash (cyrb53), hex-encoded. Not cryptographic; used for local identity keys. */
export function hash53(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function artistKey(artistName: string): string {
  return nameKey(artistName);
}

export function albumKey(artistName: string, albumName: string): string {
  return `${nameKey(artistName)}\u0000${nameKey(albumName)}`;
}

/** Identity of an item without a Spotify URI (local files, basic exports). */
export function nameBasedTrackKey(kind: string, artistName: string, trackName: string): string {
  return `name:${kind}:${hash53(`${nameKey(artistName)}\u0000${nameKey(trackName)}`)}`;
}

const URI_PATTERN = /^spotify:(track|episode|audiobook|chapter):[A-Za-z0-9]{10,32}$/;

/** Returns the URI if it is a well-formed Spotify item URI, otherwise null. */
export function cleanUri(value: unknown): string | null {
  return typeof value === 'string' && URI_PATTERN.test(value) ? value : null;
}
