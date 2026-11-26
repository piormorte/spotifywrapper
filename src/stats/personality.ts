import { formatDecimal, formatInteger, formatPercent } from '../lib/format.ts';
import { MS_PER_MINUTE } from '../lib/units.ts';
import type { Analytics } from './analytics.ts';
import { parseDayKey } from './period.ts';
import type { YearTotal } from './timeline.ts';

/**
 * "Perfil de escuta": plain-language observations derived from the metrics.
 * Each observation states the figures it rests on and uses fixed thresholds
 * (listed here and in docs/METRICS.md). They describe the data; they are not
 * judgements about the person.
 */

export interface Observation {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  /** The figures the observation is based on. */
  readonly basis: string;
}

export const THRESHOLDS = {
  /** Top-5 artists' share of streams at or above which listening is "concentrated". */
  concentrated: 0.5,
  /** Evenness bands for diversity. */
  evennessHigh: 0.8,
  evennessModerate: 0.6,
  /** Average streams per track at or above which listening is "repetitive". */
  repetitive: 5,
  /** Night share at or above which the night observation appears. */
  night: 0.15,
  /** Weekend ÷ weekday daily average beyond which one dominates. */
  weekendHigh: 1.2,
  weekendLow: 0.8,
  /** Year-over-year change in listening time considered a trend. */
  trend: 0.15,
  /** Share of artists first heard in the period for "explorer". */
  discovery: 0.3,
} as const;

const DAYPARTS = {
  night: ['de madrugada', '0h e 5h59'],
  morning: ['de manhã', '6h e 11h59'],
  afternoon: ['à tarde', '12h e 17h59'],
  evening: ['à noite', '18h e 23h59'],
} as const;

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function day(key: string): string {
  const ms = parseDayKey(key);
  return ms === null ? key : dateFormat.format(ms).replace(/ de /g, ' ');
}

export function personality(a: Analytics, years: readonly YearTotal[]): Observation[] {
  const out: Observation[] = [];
  const pct = (x: number) => formatPercent(x);

  if (a.diversity.artists === 0) return out;

  // Concentration on favourite artists.
  if (a.loyalty.top5Share >= THRESHOLDS.concentrated) {
    out.push({
      id: 'concentration',
      title: 'Fiel aos favoritos',
      text: `${pct(a.loyalty.top5Share)} dos seus streams vão para apenas 5 artistas, com ${a.loyalty.topArtist ?? ''} à frente.`,
      basis: `${a.loyalty.topArtist ?? ''}: ${pct(a.loyalty.top1Share)} dos streams · 5 artistas: ${pct(a.loyalty.top5Share)}`,
    });
  } else {
    out.push({
      id: 'concentration',
      title: 'Escuta distribuída',
      text: `Seus 5 artistas mais ouvidos somam ${pct(a.loyalty.top5Share)} dos streams; o restante se espalha por outros ${formatInteger(Math.max(0, a.diversity.artists - 5))} artistas.`,
      basis: `${formatInteger(a.diversity.artists)} artistas com streams no período`,
    });
  }

  // Diversity.
  const level =
    a.diversity.evenness >= THRESHOLDS.evennessHigh
      ? 'alta'
      : a.diversity.evenness >= THRESHOLDS.evennessModerate
        ? 'moderada'
        : 'baixa';
  out.push({
    id: 'diversity',
    title: `Diversidade ${level}`,
    text: `Sua distribuição de streams equivale a ouvir ${formatInteger(a.diversity.effectiveArtists)} artistas exatamente por igual.`,
    basis: `Índice de equilíbrio ${formatDecimal(a.diversity.evenness, 2)} (0 = um só artista, 1 = todos por igual)`,
  });

  // Repetition.
  const replay = a.mostReplayed;
  out.push({
    id: 'repetition',
    title: a.streamsPerTrack >= THRESHOLDS.repetitive ? 'Gosta de repetir' : 'Prefere variar',
    text: `Cada faixa que você ouviu foi tocada, em média, ${formatDecimal(a.streamsPerTrack, 1)} vezes.${
      replay
        ? ` A mais repetida em um só dia foi “${replay.track}”, ${formatInteger(replay.streams)} vezes em ${day(replay.day)}.`
        : ''
    }`,
    basis: 'Streams ÷ faixas diferentes com streams',
  });

  // Part of the day.
  const parts = Object.entries(a.dayparts) as [keyof typeof DAYPARTS, number][];
  const [topPart, topShare] = parts.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  out.push({
    id: 'daypart',
    title: `Escuta mais ${DAYPARTS[topPart][0]}`,
    text: `${pct(topShare)} do tempo ouvido fica entre ${DAYPARTS[topPart][1]}${
      a.mostActiveHour ? `; a hora mais ativa é ${String(a.mostActiveHour.hour)}h` : ''
    }.`,
    basis: parts.map(([k, v]) => `${DAYPARTS[k][1]}: ${pct(v)}`).join(' · '),
  });

  if (a.nightShare >= THRESHOLDS.night) {
    out.push({
      id: 'night',
      title: 'Ouvinte da madrugada',
      text: `${pct(a.nightShare)} do seu tempo de escuta acontece entre 0h e 5h59.`,
      basis: `Limite para esta observação: ${pct(THRESHOLDS.night)}`,
    });
  }

  // Weekend vs weekdays.
  if (a.weekdayAverageMs > 0) {
    const ratio = a.weekendAverageMs / a.weekdayAverageMs;
    const minutes = (ms: number) => `${formatInteger(ms / MS_PER_MINUTE)} min`;
    out.push({
      id: 'week',
      title:
        ratio >= THRESHOLDS.weekendHigh
          ? 'Mais música no fim de semana'
          : ratio <= THRESHOLDS.weekendLow
            ? 'Mais música nos dias úteis'
            : 'Ritmo constante na semana',
      text: `Em média, ${minutes(a.weekendAverageMs)} por dia no fim de semana e ${minutes(a.weekdayAverageMs)} nos dias úteis.`,
      basis: 'Médias sobre todos os dias do período, inclusive os sem escuta',
    });
  }

  // Discovery (only meaningful when the period starts after the first data day).
  const periodStartsLater = a.period.from > (parseDayKey(a.dataFirstDay) ?? 0);
  if (periodStartsLater) {
    out.push({
      id: 'discovery',
      title:
        a.discovery.newArtistShare >= THRESHOLDS.discovery
          ? 'Em busca de novidades'
          : 'Voltando ao que conhece',
      text: `${pct(a.discovery.newArtistShare)} dos artistas do período foram ouvidos pela primeira vez nele (${formatInteger(a.discovery.newArtists)} artistas novos).`,
      basis: `Primeira reprodução registrada de cada artista em todo o histórico`,
    });
  }

  // Trend across the last two complete years.
  const complete = years.filter((y) => y.complete);
  const [prev, last] = complete.slice(-2);
  if (prev && last && prev.msPlayed > 0) {
    const change = (last.msPlayed - prev.msPlayed) / prev.msPlayed;
    out.push({
      id: 'trend',
      title:
        change >= THRESHOLDS.trend
          ? `Ouvindo mais em ${String(last.year)}`
          : change <= -THRESHOLDS.trend
            ? `Ouvindo menos em ${String(last.year)}`
            : `Volume estável em ${String(last.year)}`,
      text: `Seu tempo de escuta em ${String(last.year)} foi ${change >= 0 ? '+' : '−'}${pct(Math.abs(change))} em relação a ${String(prev.year)}.`,
      basis: `Anos completos · ${String(prev.year)}: ${formatInteger(prev.msPlayed / 3_600_000)} h · ${String(last.year)}: ${formatInteger(last.msPlayed / 3_600_000)} h`,
    });
  }

  // Consistency.
  if (a.longestStreak) {
    out.push({
      id: 'streak',
      title: 'Constância',
      text: `Sua maior sequência foi de ${formatInteger(a.longestStreak.days)} dias seguidos com música, de ${day(a.longestStreak.start)} a ${day(a.longestStreak.end)}.`,
      basis: `Dias com pelo menos um stream · período de ${formatInteger(a.period.days)} dias`,
    });
  }

  return out;
}

/** One clause of the identity sentence, with the rule that chose it. */
export interface IdentityTrait {
  readonly id: 'daypart' | 'loyalty' | 'texture';
  readonly phrase: string;
  readonly basis: string;
}

const DAYPART_PHRASE = {
  night: 'madrugadas acordadas',
  morning: 'manhãs com trilha sonora',
  afternoon: 'tardes embaladas',
  evening: 'noites de música',
} as const;

/**
 * The three clauses of the overview's "sounded like" sentence
 * (docs/METRICS.md, "Frase de identidade"). Each clause is chosen by the same
 * fixed thresholds as the observations, so the sentence never claims more
 * than the figures show. Empty when there are no streams.
 */
export function identityTraits(a: Analytics): IdentityTrait[] {
  if (a.diversity.artists === 0) return [];
  const pct = (x: number) => formatPercent(x);
  const parts = Object.entries(a.dayparts) as [keyof typeof DAYPART_PHRASE, number][];
  const [topPart, topShare] = parts.reduce((best, cur) => (cur[1] > best[1] ? cur : best));

  const traits: IdentityTrait[] = [
    {
      id: 'daypart',
      phrase: DAYPART_PHRASE[topPart],
      basis: `${pct(topShare)} do tempo ouvido ${DAYPARTS[topPart][0]}`,
    },
    a.loyalty.top5Share >= THRESHOLDS.concentrated
      ? {
          id: 'loyalty',
          phrase: 'fidelidade a poucos artistas',
          basis: `5 artistas somam ${pct(a.loyalty.top5Share)} dos streams`,
        }
      : {
          id: 'loyalty',
          phrase: 'um repertório espalhado',
          basis: `5 artistas somam só ${pct(a.loyalty.top5Share)} dos streams`,
        },
  ];

  const periodStartsLater = a.period.from > (parseDayKey(a.dataFirstDay) ?? 0);
  if (a.streamsPerTrack >= THRESHOLDS.repetitive) {
    traits.push({
      id: 'texture',
      phrase: 'faixas no repeat',
      basis: `${formatDecimal(a.streamsPerTrack, 1)} streams por faixa, em média`,
    });
  } else if (periodStartsLater && a.discovery.newArtistShare >= THRESHOLDS.discovery) {
    traits.push({
      id: 'texture',
      phrase: 'muita descoberta',
      basis: `${pct(a.discovery.newArtistShare)} dos artistas ouvidos pela primeira vez`,
    });
  } else {
    traits.push({
      id: 'texture',
      phrase: 'pouca repetição',
      basis: `${formatDecimal(a.streamsPerTrack, 1)} streams por faixa, em média`,
    });
  }
  return traits;
}

/** "a, b e c" */
export function joinPhrases(phrases: readonly string[]): string {
  if (phrases.length <= 1) return phrases.join('');
  return `${phrases.slice(0, -1).join(', ')} e ${phrases.at(-1) ?? ''}`;
}
