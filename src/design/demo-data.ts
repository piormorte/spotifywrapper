/**
 * DEMONSTRATION DATA — design reference only (Stage 1).
 *
 * Every name and number here is fictional and generated deterministically.
 * It exists solely so the visual direction can be reviewed; it is never shown
 * as real statistics and will be removed once real data flows in (Stage 3).
 */

import { MS_PER_DAY } from '../lib/units.ts';

export type DemoPeriod = 'all' | 'year' | '12m' | '6m' | '30d';

export const DEMO_DATA_END = new Date(Date.UTC(2026, 9, 12));
const DEMO_DATA_START = new Date(Date.UTC(2019, 2, 1));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Minutes listened per day, fictional. */
const DAILY_MINUTES: readonly number[] = (() => {
  const rand = mulberry32(20261012);
  const days = Math.round((DEMO_DATA_END.getTime() - DEMO_DATA_START.getTime()) / MS_PER_DAY) + 1;
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(DEMO_DATA_START.getTime() + i * MS_PER_DAY);
    const weekday = date.getUTCDay();
    const season = 1 + 0.25 * Math.sin((2 * Math.PI * (date.getUTCMonth() + 2)) / 12);
    const growth = 0.7 + 0.5 * (i / days);
    const weekly = weekday === 0 || weekday === 6 ? 0.75 : 1.08;
    const silent = rand() < 0.04;
    out.push(silent ? 0 : Math.round(110 * season * growth * weekly * (0.45 + rand() * 1.1)));
  }
  return out;
})();

const ARTISTS = [
  'Halden Vale',
  'Mira Soto',
  'Ostrava Lights',
  'Pale Meridian',
  'Juno Reyes Quartet',
  'Corin Ash',
  'Lua Nascente',
  'The Glass Orchard',
] as const;

const TRACKS = [
  ['Low Tide Letters', 'Halden Vale', 'Northern Rooms'],
  ['Cinza e Ouro', 'Lua Nascente', 'Madrugada Aberta'],
  ['Paper Satellites', 'Ostrava Lights', 'Static Bloom'],
  ['Slow Machines', 'Pale Meridian', 'Long Exposure'],
  ['Every Window', 'Mira Soto', 'Every Window'],
  ['Night Ferry', 'Halden Vale', 'Northern Rooms'],
  ['Tangerine Hour', 'Corin Ash', 'Small Weather'],
  ['A Room Without Clocks', 'The Glass Orchard', 'Orchard Hymns'],
] as const;

const ALBUMS = [
  ['Northern Rooms', 'Halden Vale'],
  ['Static Bloom', 'Ostrava Lights'],
  ['Long Exposure', 'Pale Meridian'],
  ['Madrugada Aberta', 'Lua Nascente'],
  ['Small Weather', 'Corin Ash'],
] as const;

const PERIOD_DAYS: Record<Exclude<DemoPeriod, 'all' | 'year'>, number> = {
  '12m': 365,
  '6m': 182,
  '30d': 30,
};

function periodSlice(period: DemoPeriod): { minutes: readonly number[]; start: Date } {
  const total = DAILY_MINUTES.length;
  let days: number;
  if (period === 'all') days = total;
  else if (period === 'year') {
    const jan1 = Date.UTC(DEMO_DATA_END.getUTCFullYear(), 0, 1);
    days = Math.round((DEMO_DATA_END.getTime() - jan1) / MS_PER_DAY) + 1;
  } else days = PERIOD_DAYS[period];
  const startIndex = total - days;
  return {
    minutes: DAILY_MINUTES.slice(startIndex),
    start: new Date(DEMO_DATA_START.getTime() + startIndex * MS_PER_DAY),
  };
}

function ranked<T>(items: readonly T[], seed: number, scale: number) {
  const rand = mulberry32(seed);
  return items
    .map((item, i) => ({ item, weight: (items.length - i) * (0.75 + rand() * 0.5) }))
    .sort((a, b) => b.weight - a.weight)
    .map(({ item, weight }) => ({ item, streams: Math.round(weight * scale) }));
}

export interface DemoOverview {
  readonly minutes: number;
  readonly streams: number;
  readonly registered: number;
  readonly tracks: number;
  readonly artists: number;
  readonly albums: number;
  readonly dailyAverageMinutes: number;
  readonly peakDay: { readonly date: Date; readonly minutes: number };
  readonly series: { readonly values: number[]; readonly labels: string[]; readonly every: number };
  readonly hours: readonly number[];
  readonly topArtists: { name: string; streams: number }[];
  readonly topTracks: { name: string; artist: string; streams: number }[];
  readonly topAlbums: { name: string; artist: string; streams: number }[];
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function buildSeries(period: DemoPeriod, minutes: readonly number[], start: Date) {
  const groups = new Map<string, number>();
  minutes.forEach((m, i) => {
    const d = new Date(start.getTime() + i * MS_PER_DAY);
    const key =
      period === 'all'
        ? String(d.getUTCFullYear())
        : period === '30d'
          ? String(d.getUTCDate())
          : (MONTHS[d.getUTCMonth()] ?? '') + (period === '12m' ? `-${d.getUTCFullYear()}` : '');
    groups.set(key, (groups.get(key) ?? 0) + m);
  });
  const labels = [...groups.keys()].map((k) => k.split('-')[0] ?? k);
  return {
    values: [...groups.values()],
    labels,
    every: period === '30d' ? 5 : 1,
  };
}

const HOURS: readonly number[] = [
  22, 14, 8, 4, 2, 2, 6, 18, 34, 41, 38, 36, 40, 44, 42, 46, 52, 61, 66, 70, 74, 68, 52, 34,
];

export function demoOverview(period: DemoPeriod): DemoOverview {
  const { minutes, start } = periodSlice(period);
  const total = minutes.reduce((a, b) => a + b, 0);
  let peakIndex = 0;
  minutes.forEach((m, i) => {
    if (m > (minutes[peakIndex] ?? 0)) peakIndex = i;
  });
  const streams = Math.round(total / 3.2);
  const seed = period.length * 7919;
  const scale = streams / 60;

  return {
    minutes: total,
    streams,
    registered: Math.round(streams * 1.21),
    tracks: Math.round(Math.sqrt(streams) * 38),
    artists: Math.round(Math.sqrt(streams) * 9.5),
    albums: Math.round(Math.sqrt(streams) * 16),
    dailyAverageMinutes: total / minutes.length,
    peakDay: {
      date: new Date(start.getTime() + peakIndex * MS_PER_DAY),
      minutes: minutes[peakIndex] ?? 0,
    },
    series: buildSeries(period, minutes, start),
    hours: HOURS,
    topArtists: ranked(ARTISTS, seed + 1, scale).map(({ item, streams: s }) => ({
      name: item,
      streams: s,
    })),
    topTracks: ranked(TRACKS, seed + 2, scale / 4).map(({ item, streams: s }) => ({
      name: item[0],
      artist: item[1],
      streams: s,
    })),
    topAlbums: ranked(ALBUMS, seed + 3, scale / 2).map(({ item, streams: s }) => ({
      name: item[0],
      artist: item[1],
      streams: s,
    })),
  };
}
