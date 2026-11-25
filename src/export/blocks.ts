import { indexOfMax, layoutBars } from '../charts/bars.ts';
import { fitText, wrapText } from './text.ts';
import { font, type Palette } from './theme.ts';
import type { Ctx } from './types.ts';

/**
 * Layout blocks for export pieces. Sizes are in units `u` (1 u = 1 px on a
 * 1080-wide story), so every format scales from the same design.
 */
export interface Block {
  readonly id: string;
  /** Placed in the first column of wide formats. */
  readonly lead?: boolean;
  measure(ctx: Ctx, width: number, u: number): number;
  draw(ctx: Ctx, x: number, y: number, width: number, u: number, p: Palette): void;
  /** A smaller variant (fewer rows), or null when it cannot shrink. */
  shrink?(): Block | null;
}

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  f: string,
  color: string,
  align: CanvasTextAlign = 'left',
  tracking = 0,
) {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${String(tracking)}px`;
  ctx.fillText(value, x, y);
}

function eyebrow(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  u: number,
  p: Palette,
  align: CanvasTextAlign = 'left',
) {
  text(ctx, value.toUpperCase(), x, y, font(500, 22 * u), p.text3, align, 2.2 * u);
}

/** The piece's main number: label, value, unit, note. */
export function heroBlock(label: string, value: string, unit: string, note: string): Block {
  return {
    id: 'hero',
    lead: true,
    measure: (_ctx, _w, u) => 30 * u + 220 * u + 64 * u + 48 * u,
    draw(ctx, x, y, width, u, p) {
      eyebrow(ctx, label, x, y + 22 * u, u, p);
      ctx.font = font(200, 220 * u);
      ctx.letterSpacing = `${String(-12 * u)}px`;
      let size = 220 * u;
      // Shrink very long numbers to the column.
      while (size > 80 * u && ctx.measureText(value).width > width * 0.98) {
        size -= 10 * u;
        ctx.font = font(200, size);
      }
      text(
        ctx,
        value,
        x - 6 * u,
        y + 30 * u + size * 0.92,
        font(200, size),
        p.text1,
        'left',
        -size * 0.055,
      );
      text(
        ctx,
        unit,
        x,
        y + 30 * u + 200 * u + 44 * u,
        font(400, 36 * u),
        p.text2,
        'left',
        -0.4 * u,
      );
      text(
        ctx,
        fitText(ctx, note, width),
        x,
        y + 30 * u + 200 * u + 92 * u,
        font(400, 26 * u),
        p.text3,
      );
    },
  };
}

export interface StatItem {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
}

/** A grid of labelled figures. */
export function statsBlock(items: readonly StatItem[], lead = false): Block {
  const columns = (width: number, u: number) => (width / u > 760 ? 3 : 2);
  return {
    id: 'stats',
    lead,
    measure(_ctx, width, u) {
      const rows = Math.ceil(items.length / columns(width, u));
      return rows * 132 * u - 32 * u;
    },
    draw(ctx, x, y, width, u, p) {
      const cols = columns(width, u);
      const colWidth = width / cols;
      items.forEach((item, i) => {
        const cx = x + (i % cols) * colWidth;
        const cy = y + Math.floor(i / cols) * 132 * u;
        ctx.font = font(500, 22 * u);
        ctx.letterSpacing = `${String(2.2 * u)}px`;
        eyebrow(
          ctx,
          fitText(ctx, item.label.toUpperCase(), colWidth - 24 * u),
          cx,
          cy + 22 * u,
          u,
          p,
        );
        ctx.font = font(300, 64 * u);
        const valueWidth = ctx.measureText(item.value).width;
        text(ctx, item.value, cx, cy + 92 * u, font(300, 64 * u), p.text1, 'left', -1.5 * u);
        if (item.unit)
          text(ctx, item.unit, cx + valueWidth + 10 * u, cy + 92 * u, font(400, 28 * u), p.text2);
      });
    },
  };
}

export interface ListItem {
  readonly name: string;
  readonly sub?: string | null;
  readonly metric: string;
  readonly secondary?: string;
}

/** A ranked list. Shrinks by dropping rows, down to three. */
export function listBlock(title: string, items: readonly ListItem[], count = items.length): Block {
  const shown = items.slice(0, count);
  const rowHeight = (u: number, item: ListItem) => (item.sub || item.secondary ? 92 : 72) * u;
  return {
    id: `list:${title}`,
    measure: (_ctx, _w, u) => 44 * u + shown.reduce((h, item) => h + rowHeight(u, item), 0),
    draw(ctx, x, y, width, u, p) {
      eyebrow(ctx, title, x, y + 22 * u, u, p);
      ctx.fillStyle = p.rule;
      ctx.fillRect(x, y + 40 * u, width, Math.max(1, 2 * u));
      let cy = y + 44 * u;
      shown.forEach((item, i) => {
        const h = rowHeight(u, item);
        const base = cy + 54 * u;
        text(ctx, String(i + 1), x, base, font(300, 40 * u), p.text3, 'left', -0.8 * u);
        ctx.font = font(400, 34 * u);
        const metricWidth = Math.max(ctx.measureText(item.metric).width, 60 * u);
        const nameX = x + 70 * u;
        const nameWidth = width - 70 * u - metricWidth - 28 * u;
        ctx.font = font(500, 42 * u);
        text(
          ctx,
          fitText(ctx, item.name, nameWidth),
          nameX,
          base,
          font(500, 42 * u),
          p.text1,
          'left',
          -1.1 * u,
        );
        text(ctx, item.metric, x + width, base, font(400, 34 * u), p.text2, 'right');
        if (item.sub) {
          ctx.font = font(400, 28 * u);
          text(
            ctx,
            fitText(ctx, item.sub, nameWidth),
            nameX,
            base + 36 * u,
            font(400, 28 * u),
            p.text3,
          );
        }
        if (item.secondary) {
          text(ctx, item.secondary, x + width, base + 36 * u, font(400, 26 * u), p.text3, 'right');
        }
        cy += h;
      });
    },
    shrink: () => (shown.length > 3 ? listBlock(title, items, shown.length - 1) : null),
  };
}

/** Single-series bars; the maximum is drawn in the primary text color. */
export function barsBlock(
  title: string,
  values: readonly number[],
  labels: readonly string[],
  caption: string,
): Block {
  return {
    id: `bars:${title}`,
    measure: (_ctx, _w, u) => 44 * u + 260 * u + 44 * u,
    draw(ctx, x, y, width, u, p) {
      eyebrow(ctx, title, x, y + 22 * u, u, p);
      text(ctx, caption, x + width, y + 22 * u, font(400, 22 * u), p.text3, 'right');
      const top = y + 56 * u;
      const height = 248 * u;
      if (values.length === 0) return;
      const bars = layoutBars({
        values,
        width,
        height,
        padding: values.length > 20 ? 0.25 : 0.45,
        minVisibleHeight: 2 * u,
      });
      const max = indexOfMax(values);
      for (const bar of bars) {
        ctx.fillStyle = bar.index === max ? p.text1 : p.fill;
        ctx.beginPath();
        ctx.roundRect(
          x + bar.x,
          top + bar.y,
          bar.width,
          bar.height,
          Math.min(3 * u, bar.width / 2),
        );
        ctx.fill();
      }
      const every = Math.max(1, Math.ceil(labels.length / 8));
      bars.forEach((bar, i) => {
        if (i % every !== 0) return;
        text(
          ctx,
          labels[i] ?? '',
          x + bar.x + bar.width / 2,
          top + height + 34 * u,
          font(400, 22 * u),
          p.text3,
          'center',
        );
      });
    },
  };
}

export interface ObservationItem {
  readonly title: string;
  readonly text: string;
}

/** Headline + sentence pairs (the listening profile). Shrinks by dropping items. */
export function observationsBlock(items: readonly ObservationItem[], count = items.length): Block {
  const shown = items.slice(0, count);
  const lines = (ctx: Ctx, width: number, u: number, body: string) => {
    ctx.font = font(400, 32 * u);
    return wrapText(ctx, body, width, 3);
  };
  return {
    id: 'observations',
    measure(ctx, width, u) {
      return (
        shown.reduce(
          (h, item) => h + 60 * u + lines(ctx, width, u, item.text).length * 44 * u + 44 * u,
          0,
        ) -
        44 * u
      );
    },
    draw(ctx, x, y, width, u, p) {
      let cy = y;
      for (const item of shown) {
        ctx.font = font(600, 46 * u);
        text(
          ctx,
          fitText(ctx, item.title, width),
          x,
          cy + 44 * u,
          font(600, 46 * u),
          p.text1,
          'left',
          -1.2 * u,
        );
        const body = lines(ctx, width, u, item.text);
        body.forEach((line, i) => {
          text(ctx, line, x, cy + 60 * u + 34 * u + i * 44 * u, font(400, 32 * u), p.text2);
        });
        cy += 60 * u + body.length * 44 * u + 44 * u;
      }
    },
    shrink: () => (shown.length > 1 ? observationsBlock(items, shown.length - 1) : null),
  };
}
