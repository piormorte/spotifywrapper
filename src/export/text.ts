import type { Ctx } from './types.ts';

/** Shortens `text` with an ellipsis so it fits `maxWidth` in the current font. */
export function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid).trimEnd() + ellipsis).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? ellipsis : text.slice(0, lo).trimEnd() + ellipsis;
}

/** Breaks `text` into lines no wider than `maxWidth`; the last line is ellipsized. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const [i, word] of words.entries()) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) {
      lines.push(fitText(ctx, [word, ...words.slice(i + 1)].join(' '), maxWidth));
      return lines;
    }
  }
  if (line) lines.push(fitText(ctx, line, maxWidth));
  return lines.slice(0, maxLines);
}
