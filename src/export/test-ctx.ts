import type { Ctx } from './types.ts';

export interface DrawCall {
  readonly op: 'text' | 'rect' | 'roundRect';
  readonly text?: string;
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number;
  readonly font?: string;
  readonly fill?: string;
}

/** Test double: every character is `charWidth` px wide; draw calls are recorded. */
export function fakeCtx(charWidth = 10): Ctx & { calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const colorOf = (style: unknown) => (typeof style === 'string' ? style : 'pattern');
  let pending: { x: number; y: number; w: number; h: number } | null = null;
  return {
    calls,
    font: '',
    fillStyle: '#000',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    letterSpacing: '0px',
    globalAlpha: 1,
    measureText(text: string) {
      return { width: text.length * charWidth };
    },
    fillText(text: string, x: number, y: number) {
      calls.push({ op: 'text', text, x, y, font: this.font, fill: colorOf(this.fillStyle) });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ op: 'rect', x, y, w, h, fill: colorOf(this.fillStyle) });
    },
    beginPath() {
      pending = null;
    },
    roundRect(x: number, y: number, w: number, h: number) {
      pending = { x, y, w, h };
    },
    fill() {
      if (pending) calls.push({ op: 'roundRect', ...pending, fill: colorOf(this.fillStyle) });
    },
  };
}
