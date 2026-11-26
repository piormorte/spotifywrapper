import { describe, expect, it } from 'vitest';
import type { Analytics } from './analytics.ts';
import { identityTraits, joinPhrases, personality } from './personality.ts';
import type { YearTotal } from './timeline.ts';

const D = 86_400_000;

function base(overrides: Partial<Analytics> = {}): Analytics {
  return {
    period: {
      from: Date.UTC(2024, 0, 1),
      to: Date.UTC(2024, 0, 1) + 10 * D,
      days: 10,
      granularity: 'day',
    },
    dataFirstDay: '2024-01-01',
    dataLastDay: '2024-01-10',
    longestStreak: { days: 4, start: '2024-01-02', end: '2024-01-05' },
    currentStreak: null,
    mostReplayed: { track: 'Low Tide', artist: 'X', day: '2024-01-03', streams: 7 },
    sessions: { count: 3, averageMs: 1, longest: null },
    nightShare: 0.05,
    dayparts: { night: 0.05, morning: 0.15, afternoon: 0.3, evening: 0.5 },
    mostActiveHour: { hour: 21, share: 0.2 },
    weekdayAverageMs: 60 * 60_000,
    weekendAverageMs: 60 * 60_000,
    loyalty: { topArtist: 'X', top1Share: 0.3, top5Share: 0.6 },
    diversity: { artists: 40, evenness: 0.7, effectiveArtists: 13.2 },
    discovery: {
      newArtists: 40,
      newArtistShare: 1,
      newTracks: 100,
      newTrackShare: 1,
      topNewArtists: [],
    },
    streamsPerTrack: 6.25,
    monthlyAverageMs: 1,
    peakDay: null,
    ...overrides,
  };
}

const byId = (a: Analytics, years: YearTotal[] = []) =>
  new Map(personality(a, years).map((o) => [o.id, o]));

describe('personality observations', () => {
  it('states concentration with the figures behind it', () => {
    const o = byId(base()).get('concentration');
    expect(o?.title).toBe('Fiel aos favoritos');
    expect(o?.text).toBe('60% dos seus streams vão para apenas 5 artistas, com X à frente.');
    expect(
      byId(base({ loyalty: { topArtist: 'X', top1Share: 0.1, top5Share: 0.3 } })).get(
        'concentration',
      )?.title,
    ).toBe('Escuta distribuída');
  });

  it('bands diversity by evenness', () => {
    const title = (evenness: number) =>
      byId(base({ diversity: { artists: 40, evenness, effectiveArtists: 10 } })).get('diversity')
        ?.title;
    expect(title(0.85)).toBe('Diversidade alta');
    expect(title(0.7)).toBe('Diversidade moderada');
    expect(title(0.4)).toBe('Diversidade baixa');
  });

  it('describes repetition and names the most replayed track', () => {
    const o = byId(base()).get('repetition');
    expect(o?.title).toBe('Gosta de repetir');
    expect(o?.text).toContain('“Low Tide”, 7 vezes em 3 janeiro 2024');
    expect(byId(base({ streamsPerTrack: 2 })).get('repetition')?.title).toBe('Prefere variar');
  });

  it('picks the dominant part of the day and adds night only above 15%', () => {
    expect(byId(base()).get('daypart')?.title).toBe('Escuta mais à noite');
    expect(byId(base()).has('night')).toBe(false);
    expect(byId(base({ nightShare: 0.2 })).get('night')?.text).toBe(
      '20% do seu tempo de escuta acontece entre 0h e 5h59.',
    );
  });

  it('compares weekends and weekdays', () => {
    expect(byId(base()).get('week')?.title).toBe('Ritmo constante na semana');
    expect(byId(base({ weekendAverageMs: 90 * 60_000 })).get('week')?.title).toBe(
      'Mais música no fim de semana',
    );
    expect(byId(base({ weekendAverageMs: 30 * 60_000 })).get('week')?.title).toBe(
      'Mais música nos dias úteis',
    );
  });

  it('only talks about discovery when the period starts after the first data day', () => {
    expect(byId(base()).has('discovery')).toBe(false);
    const later = base({
      period: {
        from: Date.UTC(2024, 0, 5),
        to: Date.UTC(2024, 0, 11),
        days: 6,
        granularity: 'day',
      },
      discovery: {
        newArtists: 4,
        newArtistShare: 0.4,
        newTracks: 9,
        newTrackShare: 0.3,
        topNewArtists: [],
      },
    });
    expect(byId(later).get('discovery')?.title).toBe('Em busca de novidades');
  });

  it('uses only complete years for trends', () => {
    const years: YearTotal[] = [
      { year: 2022, msPlayed: 100, artists: 1, complete: true },
      { year: 2023, msPlayed: 130, artists: 1, complete: true },
      { year: 2024, msPlayed: 10, artists: 1, complete: false },
    ];
    const o = byId(base(), years).get('trend');
    expect(o?.title).toBe('Ouvindo mais em 2023');
    expect(o?.text).toBe('Seu tempo de escuta em 2023 foi +30% em relação a 2022.');
    expect(byId(base(), years.slice(1)).has('trend')).toBe(false);
  });

  it('says nothing without data', () => {
    expect(
      personality(base({ diversity: { artists: 0, evenness: 0, effectiveArtists: 0 } }), []),
    ).toEqual([]);
  });
});

describe('identity traits', () => {
  it('picks one clause per rule, each with its basis', () => {
    const traits = identityTraits(base());
    expect(traits.map((t) => t.phrase)).toEqual([
      'noites de música',
      'fidelidade a poucos artistas',
      'faixas no repeat',
    ]);
    expect(traits[0]?.basis).toBe('50% do tempo ouvido à noite');
    expect(joinPhrases(traits.map((t) => t.phrase))).toBe(
      'noites de música, fidelidade a poucos artistas e faixas no repeat',
    );
  });

  it('falls back to spread repertoire and low repetition', () => {
    const traits = identityTraits(
      base({
        dayparts: { night: 0.4, morning: 0.2, afternoon: 0.2, evening: 0.2 },
        loyalty: { topArtist: 'X', top1Share: 0.1, top5Share: 0.3 },
        streamsPerTrack: 2,
      }),
    );
    expect(traits.map((t) => t.phrase)).toEqual([
      'madrugadas acordadas',
      'um repertório espalhado',
      'pouca repetição',
    ]);
  });

  it('mentions discovery only when the period starts after the first data day', () => {
    const later = base({
      streamsPerTrack: 2,
      dataFirstDay: '2023-01-01',
      discovery: { ...base().discovery, newArtistShare: 0.4 },
    });
    expect(identityTraits(later)[2]?.phrase).toBe('muita descoberta');
    expect(identityTraits({ ...later, dataFirstDay: '2024-01-01' })[2]?.phrase).toBe(
      'pouca repetição',
    );
  });

  it('is empty without streams', () => {
    expect(
      identityTraits(base({ diversity: { artists: 0, evenness: 0, effectiveArtists: 0 } })),
    ).toEqual([]);
    expect(joinPhrases(['a'])).toBe('a');
  });
});
