import { beforeAll, describe, expect, it } from 'vitest';
import type { Library } from '../db/library.ts';
import { extendedRecord, jsonFile, newLibrary } from '../db/test-utils.ts';
import { DAYS_PER_MONTH } from './analytics.ts';

/**
 * Hand-computed fixture (UTC). 2024-01-01 is a Monday.
 *
 *  #  end (local)        ms     track / artist
 *  1  01-01 03:00        120k   C / Y   night
 *  2  01-01 10:00        200k   A / X   ┐
 *  3  01-01 10:05        200k   A / X   ├ one session: 09:56:40 → 10:10:00
 *  4  01-01 10:10        200k   B / X   ┘
 *  5  01-02 22:00         60k   A / X
 *  6  01-03 12:00         40k   D / Z
 *  7  01-05 18:00         20k   A / X   registered only (< 30 s)
 *  8  01-06 15:00        180k   C / Y   Saturday
 */
const uri = (n: number) => `spotify:track:${String(n).padStart(22, '0')}`;
const R = extendedRecord;
const RECORDS = [
  R('2024-01-01T03:00:00Z', 120_000, 'C', 'Y', 'Q', uri(3)),
  R('2024-01-01T10:00:00Z', 200_000, 'A', 'X', 'P', uri(1)),
  R('2024-01-01T10:05:00Z', 200_000, 'A', 'X', 'P', uri(1)),
  R('2024-01-01T10:10:00Z', 200_000, 'B', 'X', 'P', uri(2)),
  R('2024-01-02T22:00:00Z', 60_000, 'A', 'X', 'P', uri(1)),
  R('2024-01-03T12:00:00Z', 40_000, 'D', 'Z', 'S', uri(4)),
  R('2024-01-05T18:00:00Z', 20_000, 'A', 'X', 'P', uri(1)),
  R('2024-01-06T15:00:00Z', 180_000, 'C', 'Y', 'Q', uri(3)),
];
const TOTAL = 1_020_000;

let library: Library;
beforeAll(async () => {
  ({ library } = await newLibrary('UTC'));
  await library.importFiles([jsonFile('Streaming_History_Audio_a.json', RECORDS)]);
});

const all = () => {
  const a = library.analytics({ preset: 'all' });
  if (!a) throw new Error('expected analytics');
  return a;
};

describe('streaks and peaks', () => {
  it('finds the longest and the current streak of days with streams', () => {
    expect(all().longestStreak).toEqual({ days: 3, start: '2024-01-01', end: '2024-01-03' });
    // Jan 5 has only a 20 s play, so the streak ending on Jan 6 is one day long.
    expect(all().currentStreak).toEqual({ days: 1, start: '2024-01-06', end: '2024-01-06' });
  });

  it('finds the most replayed track on a single day and the peak day', () => {
    expect(all().mostReplayed).toEqual({ track: 'A', artist: 'X', day: '2024-01-01', streams: 2 });
    expect(all().peakDay).toEqual({ day: '2024-01-01', msPlayed: 720_000 });
  });
});

describe('sessions', () => {
  it('splits sessions on gaps over 15 minutes', () => {
    const s = all().sessions;
    expect(s.count).toBe(6);
    expect(s.longest).toEqual({
      startLocal: Date.UTC(2024, 0, 1, 9, 56, 40),
      endLocal: Date.UTC(2024, 0, 1, 10, 10),
      durationMs: 800_000,
      plays: 3,
    });
    expect(s.averageMs).toBeCloseTo(((120 + 800 + 60 + 40 + 20 + 180) * 1000) / 6, 6);
  });
});

describe('time of day', () => {
  it('splits listening time into parts of the day', () => {
    const a = all();
    expect(a.nightShare).toBeCloseTo(120 / 1020, 10);
    expect(a.dayparts.morning).toBeCloseTo(600 / 1020, 10);
    expect(a.dayparts.afternoon).toBeCloseTo(220 / 1020, 10);
    expect(a.dayparts.evening).toBeCloseTo(80 / 1020, 10);
    expect(a.mostActiveHour).toEqual({ hour: 10, share: 600 / 1020 });
  });

  it('averages weekdays and weekend days over calendar days', () => {
    expect(all().weekdayAverageMs).toBe((TOTAL - 180_000) / 5);
    expect(all().weekendAverageMs).toBe(180_000);
  });

  it('computes the monthly average from the daily rate', () => {
    expect(all().monthlyAverageMs).toBeCloseTo(TOTAL / (6 / DAYS_PER_MONTH), 6);
  });
});

describe('loyalty, diversity, repetition', () => {
  it('measures concentration on top artists', () => {
    expect(all().loyalty).toEqual({ topArtist: 'X', top1Share: 4 / 7, top5Share: 1 });
  });

  it('measures diversity with Shannon entropy', () => {
    const p = [4 / 7, 2 / 7, 1 / 7];
    const h = -p.reduce((s, x) => s + x * Math.log(x), 0);
    const d = all().diversity;
    expect(d.artists).toBe(3);
    expect(d.evenness).toBeCloseTo(h / Math.log(3), 12);
    expect(d.effectiveArtists).toBeCloseTo(Math.exp(h), 12);
  });

  it('counts streams per streamed track', () => {
    expect(all().streamsPerTrack).toBe(7 / 4);
  });
});

describe('discovery', () => {
  it('treats everything as new over the whole history', () => {
    expect(all().discovery).toMatchObject({
      newArtists: 3,
      newArtistShare: 1,
      newTracks: 4,
      newTrackShare: 1,
    });
  });

  it('counts only first-ever plays inside a later period', () => {
    const a = library.analytics({ preset: 'custom', start: '2024-01-03', end: '2024-01-06' });
    expect(a?.discovery.newArtists).toBe(1);
    expect(a?.discovery.newArtistShare).toBeCloseTo(1 / 3, 12);
    expect(a?.discovery.newTracks).toBe(1);
    expect(a?.discovery.newTrackShare).toBeCloseTo(1 / 3, 12);
    expect(a?.discovery.topNewArtists.map((x) => [x.name, x.streams])).toEqual([['Z', 1]]);
  });
});

describe('faded artists', () => {
  it('lists artists with 20+ streams before the last year and none since', async () => {
    const { library: lib } = await newLibrary('UTC');
    const plays = (artist: string, n: number, year: number, track: number) =>
      Array.from({ length: n }, (_, i) =>
        R(
          `${String(year)}-02-${String((i % 27) + 1).padStart(2, '0')}T${String(i % 20).padStart(2, '0')}:00:00Z`,
          100_000,
          `${artist} song`,
          artist,
          null,
          uri(track),
        ),
      );
    await lib.importFiles([
      jsonFile('Streaming_History_Audio_f.json', [
        ...plays('Old Favorite', 25, 2022, 10),
        ...plays('Few Plays', 5, 2022, 11),
        ...plays('Still Here', 25, 2022, 12),
        ...plays('Still Here', 1, 2025, 12),
        R('2025-06-01T10:00:00Z', 100_000, 'New', 'Newcomer', null, uri(13)),
      ]),
    ]);
    expect(lib.fadedArtists().map((a) => [a.name, a.streams])).toEqual([['Old Favorite', 25]]);
  });

  it('is empty when the history is shorter than the window', () => {
    expect(library.fadedArtists()).toEqual([]);
  });
});
