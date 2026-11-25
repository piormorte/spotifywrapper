import type { Analytics } from '../stats/analytics.ts';
import type { Overview } from '../stats/overview.ts';
import type { Observation } from '../stats/personality.ts';
import type { RankingRow } from '../stats/rankings.ts';

/** Everything an export piece may show, computed once for a period. */
export interface ExportBundle {
  readonly overview: Overview;
  readonly analytics: Analytics;
  readonly observations: readonly Observation[];
  readonly topArtists: readonly RankingRow[];
  readonly topTracks: readonly RankingRow[];
  readonly topAlbums: readonly RankingRow[];
}

export type TemplateId =
  | 'wrapped'
  | 'year'
  | 'top-artists'
  | 'top-tracks'
  | 'top-albums'
  | 'personality'
  | 'monthly'
  | 'custom';

/** Building blocks the "custom" template can show. */
export type BlockId =
  | 'time'
  | 'counts'
  | 'top-artists'
  | 'top-tracks'
  | 'top-albums'
  | 'chart'
  | 'peak'
  | 'habits'
  | 'personality';

export type ThemeId = 'dark' | 'light';

export interface ExportOptions {
  readonly template: TemplateId;
  readonly theme: ThemeId;
  /** Replaces the template's title when not empty. */
  readonly title: string;
  readonly showPeriod: boolean;
  readonly showDefinitions: boolean;
  readonly showBrand: boolean;
  /** Blocks for the custom template, in order. */
  readonly blocks: readonly BlockId[];
  /** Label of the period, e.g. "2024" or "março 2025". */
  readonly periodLabel: string;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export const FORMATS = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 675 },
} as const satisfies Record<string, Size>;

export const CUSTOM_SIZE_LIMITS = { min: 600, max: 4000 } as const;

/** A4 portrait at 150 dpi, used for PDF report pages. */
export const REPORT_PAGE: Size = { width: 1240, height: 1754 };

/**
 * The subset of the Canvas 2D API the renderer uses, so layout can be tested
 * with a fake context in Node.
 */
export interface Ctx {
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  letterSpacing: string;
  globalAlpha: number;
  measureText(text: string): { width: number };
  fillText(text: string, x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  fill(): void;
}
