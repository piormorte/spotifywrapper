/**
 * Turns free text into a safe FTS5 query: every word must match as a prefix,
 * in any column. User input never reaches FTS syntax unescaped.
 */
export function toFtsQuery(input: string): string | null {
  const words = input
    .normalize('NFC')
    .split(/[\s"'()*:^{}[\]+\-.,;!?/\\|&<>=~`]+/u)
    .map((w) => w.trim())
    .filter((w) => w !== '');
  if (words.length === 0) return null;
  return words.map((w) => `"${w.replace(/"/g, '""')}"*`).join(' ');
}
