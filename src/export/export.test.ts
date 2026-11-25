import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { bytesFile, newLibrary } from '../db/test-utils.ts';
import { pngPagesToPdf } from './pdf.ts';
import { layoutDoc, renderDoc, unitFor } from './render.ts';
import { buildDoc, buildReport, TEMPLATE_TITLES } from './templates.ts';
import { fakeCtx } from './test-ctx.ts';
import { PALETTES } from './theme.ts';
import {
  FORMATS,
  REPORT_PAGE,
  type ExportBundle,
  type ExportOptions,
  type TemplateId,
} from './types.ts';

let bundle: ExportBundle;

beforeAll(async () => {
  const { library } = await newLibrary('UTC');
  await library.importFiles(
    ['Streaming_History_Audio_2023-2024_0.json', 'StreamingHistory_music_0.json'].map((name) =>
      bytesFile(name, new Uint8Array(readFileSync(`tests/fixtures/${name}`))),
    ),
  );
  const b = library.exportBundle({ preset: 'all' });
  if (!b) throw new Error('expected a bundle');
  bundle = b;
});

const options = (template: TemplateId, overrides: Partial<ExportOptions> = {}): ExportOptions => ({
  template,
  theme: 'dark',
  title: '',
  showPeriod: true,
  showDefinitions: true,
  showBrand: true,
  blocks: ['time', 'top-artists'],
  periodLabel: 'Todo o período',
  ...overrides,
});

const TEMPLATES = Object.keys(TEMPLATE_TITLES) as TemplateId[];

describe('export bundle', () => {
  it('collects the figures for a period', () => {
    expect(bundle.overview.streams).toBeGreaterThan(0);
    expect(bundle.topArtists[0]?.name).toBe('Halden Vale');
    expect(bundle.topTracks.length).toBeLessThanOrEqual(10);
    expect(bundle.observations.length).toBeGreaterThan(0);
  });
});

describe('templates', () => {
  it.each(TEMPLATES)('%s builds a titled document with content', (template) => {
    const doc = buildDoc(bundle, options(template));
    expect(doc.title).toBe(TEMPLATE_TITLES[template]);
    expect(doc.blocks.length).toBeGreaterThan(0);
  });

  it('applies the customisation options', () => {
    const doc = buildDoc(
      bundle,
      options('wrapped', {
        title: '  Meu título  ',
        showBrand: false,
        showPeriod: false,
        showDefinitions: false,
      }),
    );
    expect(doc).toMatchObject({
      title: 'Meu título',
      brand: null,
      dateLine: null,
      kicker: null,
      footer: null,
    });
  });

  it('builds custom pieces from the chosen blocks, in order', () => {
    const doc = buildDoc(bundle, options('custom', { blocks: ['top-tracks', 'habits'] }));
    expect(doc.blocks.map((b) => b.id)).toEqual(['list:Faixas mais ouvidas', 'stats']);
  });
});

describe('layout', () => {
  const sizes = { ...FORMATS, custom: { width: 900, height: 1600 }, report: REPORT_PAGE };

  it.each(Object.entries(sizes))('keeps every block inside the %s canvas', (_name, size) => {
    const ctx = fakeCtx(18 * unitFor(size));
    for (const template of TEMPLATES) {
      const { placements, contentTop, contentBottom } = layoutDoc(
        ctx,
        size,
        buildDoc(bundle, options(template)),
      );
      expect(placements.length).toBeGreaterThan(0);
      for (const p of placements) {
        expect(p.y).toBeGreaterThanOrEqual(contentTop);
        expect(p.y + p.height).toBeLessThanOrEqual(contentBottom + 0.001);
        expect(p.x + p.width).toBeLessThanOrEqual(size.width);
      }
    }
  });

  it('shrinks earlier lists so later blocks still fit on a story', () => {
    const size = FORMATS.story;
    const ctx = fakeCtx(18 * unitFor(size));
    const { placements } = layoutDoc(ctx, size, buildDoc(bundle, options('wrapped')));
    expect(placements.map((p) => p.id)).toEqual([
      'hero',
      'stats',
      'list:Artistas mais ouvidos',
      'list:Faixas mais ouvidas',
    ]);
  });

  it('uses two columns on wide formats and shrinks lists to fit', () => {
    const size = FORMATS.landscape;
    const ctx = fakeCtx(18 * unitFor(size));
    const { placements } = layoutDoc(ctx, size, buildDoc(bundle, options('wrapped')));
    const xs = new Set(placements.map((p) => p.x));
    expect(xs.size).toBe(2);
  });

  it('draws text only with the export palette', () => {
    const ctx = fakeCtx();
    renderDoc(ctx, FORMATS.story, buildDoc(bundle, options('wrapped')), PALETTES.dark);
    const colors = new Set(ctx.calls.map((c) => c.fill));
    for (const color of colors) expect(Object.values(PALETTES.dark)).toContain(color);
    expect(ctx.calls.some((c) => c.text === 'Liner')).toBe(true);
  });

  it('builds a four-page report', () => {
    const pages = buildReport(bundle, options('wrapped'));
    expect(pages.map((p) => p.title)).toEqual([
      'Relatório de escuta',
      'Mais ouvidos',
      'Álbuns e hábitos',
      'Perfil de escuta',
    ]);
    expect(pages[3]?.footer).toContain('Página 4 de 4');
  });
});

describe('pdf', () => {
  it('embeds one PNG per A4 page', async () => {
    // 1×1 transparent PNG.
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      ),
      (c) => c.charCodeAt(0),
    );
    const bytes = await pngPagesToPdf([png, png], 'Teste');
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getTitle()).toBe('Teste');
  });
});
