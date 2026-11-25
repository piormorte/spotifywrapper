import { useEffect, useRef } from 'react';
import { formatInteger } from '../lib/format.ts';
import { demoOverview } from './demo-data.ts';

/**
 * Export direction specimen (Stage 1): a 1080 × 1920 story drawn directly on
 * Canvas with the bundled Inter, using fictional data. The real export engine
 * is built in Stage 7; this only fixes the editorial language for approval.
 */

const W = 1080;
const H = 1920;
const FONT = '"Inter Variable", sans-serif';

interface Palette {
  readonly bg: string;
  readonly text1: string;
  readonly text2: string;
  readonly text3: string;
  readonly rule: string;
  readonly accent: string;
}

const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: '#000000',
    text1: '#f5f5f7',
    text2: '#a1a1a6',
    text3: '#6e6e73',
    rule: 'rgba(255,255,255,0.14)',
    accent: '#47d7a0',
  },
  light: {
    bg: '#f5f5f7',
    text1: '#1d1d1f',
    text2: '#6e6e73',
    text3: '#86868b',
    rule: 'rgba(0,0,0,0.12)',
    accent: '#08784f',
  },
};

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
  options: { align?: CanvasTextAlign; tracking?: number } = {},
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = options.align ?? 'left';
  ctx.letterSpacing = `${options.tracking ?? 0}px`;
  ctx.fillText(value, x, y);
}

function draw(ctx: CanvasRenderingContext2D, palette: Palette) {
  const data = demoOverview('year');
  const m = 96;

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  text(ctx, 'Liner', m, m + 40, `600 44px ${FONT}`, palette.text1, { tracking: -1.2 });
  text(ctx, 'PRÉVIA · DADOS FICTÍCIOS', W - m, m + 40, `500 24px ${FONT}`, palette.text3, {
    align: 'right',
    tracking: 2.4,
  });

  text(ctx, '2026', m, 420, `600 40px ${FONT}`, palette.accent, { tracking: -0.4 });
  text(ctx, 'em escuta', m, 474, `400 40px ${FONT}`, palette.text2, { tracking: -0.4 });

  text(ctx, formatInteger(data.minutes), m - 8, 760, `200 236px ${FONT}`, palette.text1, {
    tracking: -14,
  });
  text(ctx, 'minutos ouvidos', m, 836, `400 40px ${FONT}`, palette.text2, { tracking: -0.4 });

  ctx.fillStyle = palette.rule;
  ctx.fillRect(m, 960, W - 2 * m, 2);
  text(ctx, 'ARTISTAS MAIS OUVIDOS', m, 1030, `500 24px ${FONT}`, palette.text3, { tracking: 2.4 });

  data.topArtists.slice(0, 5).forEach((artist, i) => {
    const y = 1130 + i * 118;
    text(ctx, String(i + 1), m, y, `300 52px ${FONT}`, palette.text3, { tracking: -1 });
    text(ctx, artist.name, m + 84, y, `500 56px ${FONT}`, palette.text1, { tracking: -1.6 });
    text(ctx, formatInteger(artist.streams), W - m, y, `400 40px ${FONT}`, palette.text2, {
      align: 'right',
    });
  });

  ctx.fillStyle = palette.rule;
  ctx.fillRect(m, H - 200, W - 2 * m, 2);
  text(ctx, 'Streams = reproduções de 30 s ou mais', m, H - 128, `400 28px ${FONT}`, palette.text3);
}

export function StorySpecimen({ variant }: { readonly variant: 'dark' | 'light' }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      document.fonts.load(`200 100px ${FONT}`),
      document.fonts.load(`600 100px ${FONT}`),
    ]).then(() => {
      const ctx = ref.current?.getContext('2d');
      if (ctx && !cancelled) draw(ctx, PALETTES[variant]);
    });
    return () => {
      cancelled = true;
    };
  }, [variant]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      role="img"
      aria-label={`Exemplo de exportação para Stories, tema ${variant === 'dark' ? 'escuro' : 'claro'}, com dados fictícios`}
      className="hairline block h-auto w-full rounded-[6px] border"
    />
  );
}
