import {
  formatDecimal,
  formatDuration,
  formatInteger,
  formatLocalDate,
  formatPercent,
  plural,
} from '../lib/format.ts';
import { MS_PER_MINUTE, msToDays, msToHours } from '../lib/units.ts';
import { parseDayKey } from '../stats/period.ts';
import type { RankingRow } from '../stats/rankings.ts';
import {
  barsBlock,
  heroBlock,
  listBlock,
  observationsBlock,
  statsBlock,
  type Block,
  type ListItem,
} from './blocks.ts';
import type { ExportDoc } from './render.ts';
import type { BlockId, ExportBundle, ExportOptions, TemplateId } from './types.ts';

/** Composes each export template from the period's figures. */

export const TEMPLATE_TITLES: Record<TemplateId, string> = {
  wrapped: 'Minha vida em escuta',
  year: 'Meu ano em escuta',
  'top-artists': 'Artistas mais ouvidos',
  'top-tracks': 'Faixas mais ouvidas',
  'top-albums': 'Álbuns mais ouvidos',
  personality: 'Meu perfil de escuta',
  monthly: 'Relatório do mês',
  custom: 'Minhas estatísticas',
};

export const BLOCK_LABELS: Record<BlockId, string> = {
  time: 'Tempo ouvido',
  counts: 'Streams e contagens',
  'top-artists': 'Top artistas',
  'top-tracks': 'Top faixas',
  'top-albums': 'Top álbuns',
  chart: 'Ao longo do tempo',
  peak: 'Dia de pico e sequência',
  habits: 'Hábitos de escuta',
  personality: 'Perfil de escuta',
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function rankItems(rows: readonly RankingRow[], withSub: boolean): ListItem[] {
  return rows.map((r) => ({
    name: r.name,
    sub: withSub ? [r.artist, r.album].filter(Boolean).join(' · ') : null,
    metric: formatInteger(r.streams),
    secondary: formatDuration(r.msPlayed),
  }));
}

function seriesLabel(key: string): string {
  if (key.length === 4) return key;
  if (key.length === 7) return MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
  return String(Number(key.slice(8, 10)));
}

function blockFor(id: BlockId | 'counts-compact', b: ExportBundle, listSize: number): Block | null {
  const o = b.overview;
  const a = b.analytics;
  switch (id) {
    case 'time':
      return heroBlock(
        'Tempo ouvido',
        formatInteger(o.msPlayed / MS_PER_MINUTE),
        'minutos',
        `${formatInteger(msToHours(o.msPlayed))} horas · ${formatDecimal(msToDays(o.msPlayed), 1)} dias de reprodução contínua`,
      );
    case 'counts-compact':
      return statsBlock(
        [
          { label: 'Streams', value: formatInteger(o.streams) },
          { label: 'Artistas', value: formatInteger(o.distinctArtists) },
          { label: 'Faixas', value: formatInteger(o.distinctTracks) },
        ],
        true,
      );
    case 'counts':
      return statsBlock(
        [
          { label: 'Streams', value: formatInteger(o.streams) },
          { label: 'Artistas', value: formatInteger(o.distinctArtists) },
          { label: 'Faixas', value: formatInteger(o.distinctTracks) },
          {
            label: 'Média diária',
            value: formatInteger(o.dailyAverageMs / MS_PER_MINUTE),
            unit: 'min',
          },
          { label: 'Dias com escuta', value: formatInteger(o.listeningDays) },
          { label: 'Álbuns', value: formatInteger(o.distinctAlbums) },
        ],
        true,
      );
    case 'top-artists':
      return b.topArtists.length > 0
        ? listBlock('Artistas mais ouvidos', rankItems(b.topArtists, false), listSize)
        : null;
    case 'top-tracks':
      return b.topTracks.length > 0
        ? listBlock('Faixas mais ouvidas', rankItems(b.topTracks, true), listSize)
        : null;
    case 'top-albums':
      return b.topAlbums.length > 0
        ? listBlock('Álbuns mais ouvidos', rankItems(b.topAlbums, true), listSize)
        : null;
    case 'chart':
      return o.series.length > 1
        ? barsBlock(
            'Ao longo do tempo',
            o.series.map((s) => s.msPlayed / MS_PER_MINUTE),
            o.series.map((s) => seriesLabel(s.key)),
            'minutos · em destaque, o maior',
          )
        : null;
    case 'peak': {
      const peakMs = a.peakDay ? parseDayKey(a.peakDay.day) : null;
      return statsBlock([
        {
          label: peakMs === null ? 'Dia de pico' : `Pico · ${formatLocalDate(peakMs)}`,
          value: formatInteger((a.peakDay?.msPlayed ?? 0) / MS_PER_MINUTE),
          unit: 'min',
        },
        {
          label: 'Maior sequência',
          value: formatInteger(a.longestStreak?.days ?? 0),
          unit: a.longestStreak?.days === 1 ? 'dia' : 'dias',
        },
        {
          label: 'Sessão mais longa',
          value: formatDuration(a.sessions.longest?.durationMs ?? 0),
        },
      ]);
    }
    case 'habits':
      return statsBlock([
        {
          label: 'Hora mais ativa',
          value: a.mostActiveHour ? `${String(a.mostActiveHour.hour)}h` : '—',
        },
        { label: 'Madrugada', value: formatPercent(a.nightShare) },
        { label: 'Top 5 artistas', value: formatPercent(a.loyalty.top5Share) },
        { label: 'Diversidade', value: formatDecimal(a.diversity.evenness, 2) },
        { label: 'Streams por faixa', value: formatDecimal(a.streamsPerTrack, 1) },
        { label: 'Artistas novos', value: formatInteger(a.discovery.newArtists) },
      ]);
    case 'personality':
      return b.observations.length > 0 ? observationsBlock(b.observations, 6) : null;
  }
}

const TEMPLATE_BLOCKS: Record<
  Exclude<TemplateId, 'custom'>,
  readonly (BlockId | 'counts-compact')[]
> = {
  wrapped: ['time', 'counts-compact', 'top-artists', 'top-tracks'],
  year: ['time', 'counts-compact', 'top-artists', 'top-tracks', 'chart'],
  'top-artists': ['top-artists'],
  'top-tracks': ['top-tracks'],
  'top-albums': ['top-albums'],
  personality: ['personality'],
  monthly: ['time', 'counts-compact', 'chart', 'top-artists', 'top-tracks'],
};

const DEFINITIONS = 'Streams: reproduções de 30 s ou mais';

function dateLine(b: ExportBundle): string {
  return `${formatLocalDate(b.overview.period.from)} – ${formatLocalDate(b.overview.period.to - 1)}`;
}

export function buildDoc(b: ExportBundle, options: ExportOptions): ExportDoc {
  const ids = options.template === 'custom' ? options.blocks : TEMPLATE_BLOCKS[options.template];
  const single = ids.length === 1;
  const blocks = ids
    .map((id) => blockFor(id, b, single ? 10 : 5))
    .filter((block): block is Block => block !== null);
  return {
    brand: options.showBrand ? 'Liner' : null,
    dateLine: options.showPeriod ? dateLine(b) : null,
    kicker: options.showPeriod ? options.periodLabel : null,
    title: options.title.trim() || TEMPLATE_TITLES[options.template],
    blocks,
    footer: options.showDefinitions ? DEFINITIONS : null,
  };
}

/** Pages of the PDF report: summary, rankings, habits and profile. */
export function buildReport(b: ExportBundle, options: ExportOptions): ExportDoc[] {
  const page = (title: string, ids: readonly BlockId[], listSize: number): ExportDoc => ({
    brand: options.showBrand ? 'Liner' : null,
    dateLine: dateLine(b),
    kicker: options.periodLabel,
    title,
    blocks: ids.map((id) => blockFor(id, b, listSize)).filter((x): x is Block => x !== null),
    footer: options.showDefinitions ? DEFINITIONS : null,
  });
  return [
    page(options.title.trim() || 'Relatório de escuta', ['time', 'counts', 'chart'], 5),
    page('Mais ouvidos', ['top-artists', 'top-tracks'], 10),
    page('Álbuns e hábitos', ['top-albums', 'peak', 'habits'], 10),
    page('Perfil de escuta', ['personality'], 10),
  ].map((doc, i, all) => ({
    ...doc,
    footer: `${doc.footer ? `${doc.footer} · ` : ''}Página ${String(i + 1)} de ${String(all.length)} · ${plural(b.overview.period.days, 'dia', 'dias')}`,
  }));
}
