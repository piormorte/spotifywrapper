import { useEffect, useMemo, useRef, useState } from 'react';
import { FILE_KINDS, saveFile } from '../../app/download.ts';
import { useLibrary } from '../../app/library-context.ts';
import { renderDoc, type ExportDoc } from '../../export/render.ts';
import { BLOCK_LABELS, buildDoc, buildReport, TEMPLATE_TITLES } from '../../export/templates.ts';
import { EXPORT_FONT, PALETTES } from '../../export/theme.ts';
import {
  CUSTOM_SIZE_LIMITS,
  FORMATS,
  REPORT_PAGE,
  type BlockId,
  type ExportBundle,
  type ExportOptions,
  type Size,
  type TemplateId,
  type ThemeId,
} from '../../export/types.ts';
import type { PeriodSpec } from '../../stats/period.ts';
import { Button } from '../../ui/Button.tsx';
import { OptionList } from '../../ui/OptionList.tsx';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';
import { PeriodPicker } from '../overview/PeriodPicker.tsx';
import { monthLabel, monthSpec, monthsBetween, periodLabel, yearSpec } from './period-label.ts';

type FormatId = keyof typeof FORMATS | 'custom' | 'pdf';

const FORMAT_SEGMENTS = [
  { value: 'story', label: 'Stories' },
  { value: 'square', label: 'Quadrado' },
  { value: 'landscape', label: 'X / Twitter' },
  { value: 'custom', label: 'Outro tamanho' },
  { value: 'pdf', label: 'PDF' },
] as const satisfies readonly { value: FormatId; label: string }[];

const THEME_SEGMENTS = [
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' },
] as const satisfies readonly { value: ThemeId; label: string }[];

const TEMPLATES = Object.keys(TEMPLATE_TITLES) as TemplateId[];
const ALL_BLOCKS = Object.keys(BLOCK_LABELS) as BlockId[];

const clampSize = (n: number) =>
  Math.min(
    CUSTOM_SIZE_LIMITS.max,
    Math.max(CUSTOM_SIZE_LIMITS.min, Math.round(n) || CUSTOM_SIZE_LIMITS.min),
  );

async function fontsReady(): Promise<void> {
  await Promise.all(
    [200, 300, 400, 500, 600].map((w) => document.fonts.load(`${String(w)} 40px ${EXPORT_FONT}`)),
  );
}

function draw(canvas: HTMLCanvasElement, size: Size, doc: ExportDoc, theme: ThemeId): void {
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (ctx) renderDoc(ctx, size, doc, PALETTES[theme]);
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG encoding failed'));
        return;
      }
      void blob.arrayBuffer().then((buffer) => {
        resolve(new Uint8Array(buffer));
      });
    }, 'image/png');
  });
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 py-1 text-callout">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="size-4 accent-[var(--text-1)]"
      />
      {label}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-2.5">{label}</p>
      {children}
    </div>
  );
}

export function ExportStudioPage({
  period,
  onPeriodChange,
}: {
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
}) {
  const { client, status, summary } = useLibrary();
  const [template, setTemplate] = useState<TemplateId>('wrapped');
  const [format, setFormat] = useState<FormatId>('story');
  const [custom, setCustom] = useState<Size>({ width: 1080, height: 1350 });
  const [theme, setTheme] = useState<ThemeId>('dark');
  const [title, setTitle] = useState('');
  const [showPeriod, setShowPeriod] = useState(true);
  const [showDefinitions, setShowDefinitions] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [blocks, setBlocks] = useState<BlockId[]>(['time', 'counts', 'top-artists']);
  const [bounds, setBounds] = useState<{ first: string; last: string; years: number[] } | null>(
    null,
  );
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'saving' | 'error'>('loading');
  const previews = useRef<(HTMLCanvasElement | null)[]>([]);

  // Data range (for year and month pickers).
  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    void Promise.all([
      client.call('overview', { preset: 'all' }),
      client.call('yearsWithData', undefined),
    ]).then(([all, years]) => {
      if (!lifecycle.active) return;
      if (!all) {
        setState('empty');
        return;
      }
      setBounds({ first: all.dataFirstDay, last: all.dataLastDay, years });
      setYear((y) => y ?? years.at(-1) ?? null);
      setMonth((m) => m ?? all.dataLastDay.slice(0, 7));
    });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, summary]);

  // The period each template exports.
  const spec: PeriodSpec = useMemo(() => {
    if (template === 'wrapped') return { preset: 'all' };
    // Years and months are clipped to the data so a partial year reads as such.
    const clip = (s: PeriodSpec): PeriodSpec =>
      s.preset === 'custom' && bounds
        ? {
            preset: 'custom',
            start: s.start < bounds.first ? bounds.first : s.start,
            end: s.end > bounds.last ? bounds.last : s.end,
          }
        : s;
    if (template === 'year' && year !== null) return clip(yearSpec(year));
    if (template === 'monthly' && month) return clip(monthSpec(month));
    return period;
  }, [template, year, month, period, bounds]);

  const label =
    template === 'year' && year !== null
      ? String(year)
      : template === 'monthly' && month
        ? monthLabel(month)
        : periodLabel(spec, bounds?.last ?? '');

  useEffect(() => {
    if (status !== 'ready' || !bounds) return;
    const lifecycle = { active: true };
    void client.call('exportBundle', spec).then((result) => {
      if (!lifecycle.active) return;
      if (result) {
        setBundle(result);
        setState('ready');
      }
    });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, bounds, spec, summary]);

  const options: ExportOptions = {
    template,
    theme,
    title,
    showPeriod,
    showDefinitions,
    showBrand,
    blocks,
    periodLabel: label,
  };
  const size: Size =
    format === 'custom' ? custom : format === 'pdf' ? REPORT_PAGE : FORMATS[format];
  const docs = bundle
    ? format === 'pdf'
      ? buildReport(bundle, options)
      : [buildDoc(bundle, options)]
    : [];

  // Redraw previews whenever anything changes (full resolution, scaled by CSS).
  useEffect(() => {
    if (docs.length === 0) return;
    let cancelled = false;
    void fontsReady().then(() => {
      if (cancelled) return;
      docs.forEach((doc, i) => {
        const canvas = previews.current[i];
        if (canvas) draw(canvas, size, doc, theme);
      });
    });
    return () => {
      cancelled = true;
    };
  });

  const download = async () => {
    setState('saving');
    try {
      const date = new Date().toISOString().slice(0, 10);
      const pages = await Promise.all(
        docs.map((_, i) => {
          const canvas = previews.current[i];
          if (!canvas) throw new Error('missing canvas');
          return canvasPng(canvas);
        }),
      );
      const first = pages[0];
      if (format === 'pdf') {
        // pdf-lib is loaded only when a PDF is actually generated.
        const { pngPagesToPdf } = await import('../../export/pdf.ts');
        const pdf = await pngPagesToPdf(pages, options.title || 'Relatório de escuta');
        await saveFile(pdf, `liner-relatorio-${date}.pdf`, FILE_KINDS.pdf);
      } else if (first) {
        await saveFile(
          first,
          `liner-${template}-${String(size.width)}x${String(size.height)}-${date}.png`,
          FILE_KINDS.png,
        );
      }
      setState('ready');
    } catch {
      setState('error');
    }
  };

  const usesAppPeriod = !['wrapped', 'year', 'monthly'].includes(template);

  return (
    <main className="mx-auto max-w-[1180px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
      <h1 className="font-display text-display font-semibold">Export Studio</h1>
      <p className="mt-2 max-w-[60ch] text-callout text-text-2">
        Peças desenhadas a partir das suas estatísticas, prontas para compartilhar. Geradas neste
        dispositivo.
      </p>

      {state === 'empty' && (
        <p className="mt-16 text-callout text-text-2">
          Ainda não há histórico.{' '}
          <a href="#importar" className="text-text-1 underline">
            Importar dados
          </a>
        </p>
      )}

      {state !== 'empty' && (
        <div className="mt-12 grid gap-12 lg:grid-cols-[320px_minmax(0,1fr)]">
          <form
            aria-label="Opções de exportação"
            className="space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <Field label="Modelo">
              <OptionList
                label="Modelo"
                options={TEMPLATES.map((t) => ({ value: t, label: TEMPLATE_TITLES[t] }))}
                value={template}
                onChange={setTemplate}
                className="grid grid-cols-2 gap-1 lg:grid-cols-1"
              />
            </Field>

            <Field label="Período">
              {template === 'wrapped' && (
                <p className="text-callout text-text-2">Todo o histórico.</p>
              )}
              {template === 'year' && bounds && (
                <select
                  id="export-year"
                  aria-label="Ano"
                  value={year ?? ''}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                  }}
                  className="numeric rounded-control bg-fill-1 px-3 py-1.5 text-callout text-text-1"
                >
                  {bounds.years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
              {template === 'monthly' && bounds && (
                <select
                  id="export-month"
                  aria-label="Mês"
                  value={month ?? ''}
                  onChange={(e) => {
                    setMonth(e.target.value);
                  }}
                  className="rounded-control bg-fill-1 px-3 py-1.5 text-callout text-text-1"
                >
                  {monthsBetween(bounds.first, bounds.last)
                    .reverse()
                    .map((m) => (
                      <option key={m} value={m}>
                        {monthLabel(m)}
                      </option>
                    ))}
                </select>
              )}
              {usesAppPeriod && bounds && (
                <PeriodPicker
                  value={period}
                  onChange={onPeriodChange}
                  dataYear={Number(bounds.last.slice(0, 4))}
                  bounds={{ first: bounds.first, last: bounds.last }}
                />
              )}
            </Field>

            {template === 'custom' && (
              <Field label="Estatísticas">
                {ALL_BLOCKS.map((b) => (
                  <Checkbox
                    key={b}
                    id={`block-${b}`}
                    label={BLOCK_LABELS[b]}
                    checked={blocks.includes(b)}
                    onChange={(on) => {
                      setBlocks((cur) =>
                        ALL_BLOCKS.filter((x) => (x === b ? on : cur.includes(x))),
                      );
                    }}
                  />
                ))}
              </Field>
            )}

            <Field label="Formato">
              <OptionList
                label="Formato"
                options={FORMAT_SEGMENTS}
                value={format}
                onChange={setFormat}
                className="grid grid-cols-3 gap-1"
              />
              {format === 'custom' && (
                <div className="mt-3 flex items-center gap-2 text-footnote text-text-2">
                  <label htmlFor="export-width" className="sr-only">
                    Largura
                  </label>
                  <input
                    id="export-width"
                    type="number"
                    min={CUSTOM_SIZE_LIMITS.min}
                    max={CUSTOM_SIZE_LIMITS.max}
                    value={custom.width}
                    onChange={(e) => {
                      setCustom((c) => ({ ...c, width: clampSize(Number(e.target.value)) }));
                    }}
                    className="numeric w-24 rounded-control bg-fill-1 px-3 py-1.5 text-callout text-text-1"
                  />
                  ×
                  <label htmlFor="export-height" className="sr-only">
                    Altura
                  </label>
                  <input
                    id="export-height"
                    type="number"
                    min={CUSTOM_SIZE_LIMITS.min}
                    max={CUSTOM_SIZE_LIMITS.max}
                    value={custom.height}
                    onChange={(e) => {
                      setCustom((c) => ({ ...c, height: clampSize(Number(e.target.value)) }));
                    }}
                    className="numeric w-24 rounded-control bg-fill-1 px-3 py-1.5 text-callout text-text-1"
                  />
                  px
                </div>
              )}
              <p className="mt-2 text-footnote text-text-3">
                {format === 'pdf'
                  ? 'Relatório completo em 4 páginas A4.'
                  : `${String(size.width)} × ${String(size.height)} px, PNG.`}
              </p>
            </Field>

            <Field label="Tema">
              <SegmentedControl
                label="Tema da peça"
                segments={THEME_SEGMENTS}
                value={theme}
                onChange={setTheme}
              />
            </Field>

            <Field label="Personalizar">
              <label htmlFor="export-title" className="sr-only">
                Título
              </label>
              <input
                id="export-title"
                type="text"
                maxLength={60}
                placeholder={TEMPLATE_TITLES[template]}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
                className="mb-3 w-full rounded-control bg-fill-1 px-3 py-2 text-callout text-text-1 placeholder:text-text-3"
              />
              <Checkbox
                id="opt-period"
                label="Mostrar período"
                checked={showPeriod}
                onChange={setShowPeriod}
              />
              <Checkbox
                id="opt-definitions"
                label="Mostrar definição de stream"
                checked={showDefinitions}
                onChange={setShowDefinitions}
              />
              <Checkbox
                id="opt-brand"
                label="Mostrar marca Liner"
                checked={showBrand}
                onChange={setShowBrand}
              />
              <p className="mt-3 text-footnote text-text-3">
                Capas de álbum não estão disponíveis: o Liner não usa a API da Spotify.
              </p>
            </Field>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                disabled={!bundle || state === 'saving'}
                onClick={() => void download()}
              >
                {state === 'saving' ? 'Gerando…' : format === 'pdf' ? 'Baixar PDF' : 'Baixar PNG'}
              </Button>
              {state === 'error' && (
                <span className="text-footnote text-critical">
                  Não foi possível gerar o arquivo.
                </span>
              )}
            </div>
          </form>

          <section aria-label="Pré-visualização" className="min-w-0">
            {docs.length === 0 ? (
              <p className="text-callout text-text-2">Preparando a pré-visualização…</p>
            ) : (
              <div className={format === 'pdf' ? 'grid grid-cols-2 gap-4' : 'flex justify-center'}>
                {docs.map((doc, i) => (
                  <canvas
                    key={`${String(i)}-${String(size.width)}x${String(size.height)}`}
                    ref={(el) => {
                      previews.current[i] = el;
                    }}
                    role="img"
                    aria-label={`Pré-visualização: ${doc.title}${format === 'pdf' ? `, página ${String(i + 1)}` : ''}`}
                    className="hairline block h-auto max-h-[78vh] w-auto max-w-full rounded-[6px] border"
                    style={{ aspectRatio: `${String(size.width)} / ${String(size.height)}` }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
