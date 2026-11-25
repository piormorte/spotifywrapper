import type { ThemeId } from './types.ts';

/** Export palettes: the app's tokens, fixed so pieces look the same everywhere. */
export interface Palette {
  readonly bg: string;
  readonly text1: string;
  readonly text2: string;
  readonly text3: string;
  readonly fill: string;
  readonly rule: string;
  readonly accent: string;
}

export const PALETTES: Record<ThemeId, Palette> = {
  dark: {
    bg: '#000000',
    text1: '#f5f5f7',
    text2: '#a1a1a6',
    text3: '#7c7c82',
    fill: '#2c2c2e',
    rule: 'rgba(255,255,255,0.14)',
    accent: '#47d7a0',
  },
  light: {
    bg: '#f5f5f7',
    text1: '#1d1d1f',
    text2: '#6e6e73',
    text3: '#737378',
    fill: '#d2d2d7',
    rule: 'rgba(0,0,0,0.12)',
    accent: '#08784f',
  },
};

/** Bundled Inter: exports never depend on the platform's fonts. */
export const EXPORT_FONT = '"Inter Variable", sans-serif';

export function font(weight: number, size: number): string {
  return `${String(weight)} ${String(Math.round(size))}px ${EXPORT_FONT}`;
}
