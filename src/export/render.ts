import type { Block } from './blocks.ts';
import { fitText } from './text.ts';
import { font, type Palette } from './theme.ts';
import type { Ctx, Size } from './types.ts';

/** A composed piece: header texts, blocks in reading order, footer note. */
export interface ExportDoc {
  /** Small top-left mark ("Liner"), or null to hide. */
  readonly brand: string | null;
  /** Top-right small caps (date range), or null. */
  readonly dateLine: string | null;
  /** Accent line above the title (period label), or null. */
  readonly kicker: string | null;
  readonly title: string;
  readonly blocks: readonly Block[];
  /** Bottom note (definitions, data freshness), or null. */
  readonly footer: string | null;
}

export interface Placement {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Design unit: 1 at 1080 px on the short side. */
export function unitFor(size: Size): number {
  return Math.min(size.width, size.height) / 1080;
}

function isWide(size: Size): boolean {
  return size.width / size.height >= 1.3;
}

/**
 * Lays blocks out top to bottom in the space between header and footer.
 * A block that does not fit is shrunk (fewer rows) until it does, or left
 * out. Wide formats use two columns: lead blocks left, the rest right.
 */
export function layoutDoc(
  ctx: Ctx,
  size: Size,
  doc: ExportDoc,
): {
  placements: Placement[];
  blocks: Map<string, Block>;
  contentTop: number;
  contentBottom: number;
} {
  const u = unitFor(size);
  const margin = 88 * u;
  const gap = 64 * u;
  const headerHeight = 50 * u + (doc.kicker ? 56 * u : 0) + 84 * u + 72 * u;
  const footerHeight = doc.footer ? 80 * u : 24 * u;
  const contentTop = margin + headerHeight;
  const contentBottom = size.height - margin - footerHeight;

  const wide = isWide(size);
  const inner = size.width - 2 * margin;
  const columns = wide
    ? [
        { x: margin, width: inner * 0.46, blocks: doc.blocks.filter((b) => b.lead) },
        {
          x: margin + inner * 0.54,
          width: inner * 0.46,
          blocks: doc.blocks.filter((b) => !b.lead),
        },
      ]
    : [{ x: margin, width: inner, blocks: doc.blocks }];

  const placements: Placement[] = [];
  const used = new Map<string, Block>();
  for (const column of columns) {
    // Flow the column; if a block had to be left out, shrink the largest
    // shrinkable block placed before it and try again, so every block gets
    // a chance before any is dropped.
    let blocks = [...column.blocks];
    let result = flowColumn(ctx, blocks, column.x, column.width, contentTop, contentBottom, gap, u);
    for (let attempt = 0; attempt < 24 && result.dropped.length > 0; attempt++) {
      const firstDropped = blocks.indexOf(result.dropped[0] as Block);
      let candidate = -1;
      let tallest = 0;
      blocks.slice(0, firstDropped).forEach((b, i) => {
        const h = b.measure(ctx, column.width, u);
        if (b.shrink?.() && h > tallest) {
          tallest = h;
          candidate = i;
        }
      });
      const shrunk = candidate >= 0 ? blocks[candidate]?.shrink?.() : null;
      if (!shrunk) break;
      blocks = blocks.map((b, i) => (i === candidate ? shrunk : b));
      result = flowColumn(ctx, blocks, column.x, column.width, contentTop, contentBottom, gap, u);
    }
    for (const { block, place } of result.placed) {
      placements.push(place);
      used.set(block.id, block);
    }
  }
  return { placements, blocks: used, contentTop, contentBottom };
}

function flowColumn(
  ctx: Ctx,
  blocks: readonly Block[],
  x: number,
  width: number,
  top: number,
  bottom: number,
  gap: number,
  u: number,
): { placed: { block: Block; place: Placement }[]; dropped: Block[] } {
  const placed: { block: Block; place: Placement }[] = [];
  const dropped: Block[] = [];
  let y = top;
  for (const original of blocks) {
    let block: Block | null = original;
    while (block && y + block.measure(ctx, width, u) > bottom) {
      block = block.shrink ? block.shrink() : null;
    }
    if (!block) {
      dropped.push(original);
      continue;
    }
    const height = block.measure(ctx, width, u);
    placed.push({ block, place: { id: block.id, x, y, width, height } });
    y += height + gap;
  }
  return { placed, dropped };
}

/** Draws a full piece onto a canvas of `size`. */
export function renderDoc(ctx: Ctx, size: Size, doc: ExportDoc, p: Palette): Placement[] {
  const u = unitFor(size);
  const margin = 88 * u;
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.textBaseline = 'alphabetic';

  const setText = (f: string, color: string, align: CanvasTextAlign, tracking: number) => {
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.letterSpacing = `${String(tracking)}px`;
  };

  // Header.
  let y = margin + 34 * u;
  if (doc.brand) {
    setText(font(600, 40 * u), p.text1, 'left', -1.1 * u);
    ctx.fillText(doc.brand, margin, y);
  }
  if (doc.dateLine) {
    setText(font(500, 22 * u), p.text3, 'right', 2.2 * u);
    ctx.fillText(doc.dateLine.toUpperCase(), size.width - margin, y);
  }
  y += 16 * u;
  if (doc.kicker) {
    y += 56 * u;
    setText(font(600, 40 * u), p.accent, 'left', -0.4 * u);
    ctx.fillText(fitText(ctx, doc.kicker, size.width - 2 * margin), margin, y);
  }
  y += 84 * u;
  setText(font(600, 76 * u), p.text1, 'left', -2.6 * u);
  ctx.fillText(fitText(ctx, doc.title, size.width - 2 * margin), margin, y);

  // Blocks.
  const { placements, blocks } = layoutDoc(ctx, size, doc);
  for (const place of placements) {
    blocks.get(place.id)?.draw(ctx, place.x, place.y, place.width, u, p);
  }

  // Footer.
  if (doc.footer) {
    const fy = size.height - margin;
    ctx.fillStyle = p.rule;
    ctx.fillRect(margin, fy - 64 * u, size.width - 2 * margin, Math.max(1, 2 * u));
    setText(font(400, 24 * u), p.text3, 'left', 0);
    ctx.fillText(fitText(ctx, doc.footer, size.width - 2 * margin), margin, fy - 10 * u);
  }
  return placements;
}
