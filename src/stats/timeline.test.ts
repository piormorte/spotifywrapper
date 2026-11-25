import { beforeAll, describe, expect, it } from 'vitest';
import type { Library } from '../db/library.ts';
import { extendedRecord, jsonFile, newLibrary } from '../db/test-utils.ts';

/**
 * Hand-computed fixture (UTC).
 *
 *  local end            weekday  track / artist   ms
 *  2023-03-06 10:00     Mon      A / X            200k
 *  2023-03-08 21:00     Wed      A / X            100k
 *  2023-07-01 21:30     Sat      C / Y            240k
 *  2024-01-01 08:00     Mon      C / Y            240k
 *  2024-01-01 09:00     Mon      C / Y            240k
 *  2024-01-02 21:00     Tue      A / X             20k  (registered, not a stream)
 *  2024-02-05 10:00     Mon      B / Z            180k
 */
const uri = (n: number) => `spotify:track:${String(n).padStart(22, '0')}`;
const R = extendedRecord;
const RECORDS = [
  R('2023-03-06T10:00:00Z', 200_000, 'A', 'X', 'P', uri(1)),
  R('2023-03-08T21:00:00Z', 100_000, 'A', 'X', 'P', uri(1)),
  R('2023-07-01T21:30:00Z', 240_000, 'C', 'Y', 'Q', uri(3)),
  R('2024-01-01T08:00:00Z', 240_000, 'C', 'Y', 'Q', uri(3)),
  R('2024-01-01T09:00:00Z', 240_000, 'C', 'Y', 'Q', uri(3)),
  R('2024-01-02T21:00:00Z', 20_000, 'A', 'X', 'P', uri(1)),
  R('2024-02-05T10:00:00Z', 180_000, 'B', 'Z', 'S', uri(2)),
];

let library: Library;
beforeAll(async () => {
  ({ library } = await newLibrary('UTC'));
  await library.importFiles([jsonFile('Streaming_History_Audio_t.json', RECORDS)]);
});

describe('activity', () => {
  it('buckets by month with zero-filled gaps', () => {
    const t = library.timeline({ preset: 'all' }, 'month');
    expect(t?.granularity).toBe('month');
    expect(t?.activity).toHaveLength(12);
    const byKey = new Map(t?.activity.map((p) => [p.key, p]));
    expect(byKey.get('2023-03')).toEqual({
      key: '2023-03',
      msPlayed: 300_000,
      streams: 2,
      registeredPlays: 2,
    });
    expect(byKey.get('2023-05')?.msPlayed).toBe(0);
    expect(byKey.get('2024-01')).toEqual({
      key: '2024-01',
      msPlayed: 500_000,
      streams: 2,
      registeredPlays: 3,
    });
    const total = t?.activity.reduce((a, p) => a + p.msPlayed, 0);
    expect(total).toBe(library.overview({ preset: 'all' })?.msPlayed);
  });

  it('buckets by ISO week (Monday start)', () => {
    const t = library.timeline(
      { preset: 'custom', start: '2024-01-01', end: '2024-01-14' },
      'week',
    );
    expect(t?.activity.map((p) => [p.key, p.msPlayed])).toEqual([
      ['2024-01-01', 500_000],
      ['2024-01-08', 0],
    ]);
  });

  it('uses the period granularity when none is given', () => {
    expect(library.timeline({ preset: '30d' }, null)?.granularity).toBe('day');
  });

  it('maps listening time to weekday × hour', () => {
    const h = library.timeline({ preset: 'all' }, null)?.heatmap ?? [];
    expect(h[0]?.[10]).toBe(380_000); // Monday 10h
    expect(h[0]?.[8]).toBe(240_000);
    expect(h[2]?.[21]).toBe(100_000); // Wednesday
    expect(h[5]?.[21]).toBe(240_000); // Saturday
    expect(h[1]?.[21]).toBe(20_000); // Tuesday
    expect(h.flat().reduce((a, b) => a + b, 0)).toBe(1_220_000);
  });

  it('falls back from daily to weekly bars beyond two years', async () => {
    const { library: long } = await newLibrary('UTC');
    await long.importFiles([
      jsonFile('Streaming_History_Audio_l.json', [
        R('2020-01-01T10:00:00Z', 60_000, 'A', 'X', 'P', uri(1)),
        R('2024-01-01T10:00:00Z', 60_000, 'A', 'X', 'P', uri(1)),
      ]),
    ]);
    expect(long.timeline({ preset: 'all' }, 'day')?.granularity).toBe('week');
  });
});

describe('dominant artist per year', () => {
  it('picks the artist with most streams each year with its share', () => {
    expect(
      library.dominantArtists().map((y) => [y.year, y.artist, y.streams, y.msPlayed, y.share]),
    ).toEqual([
      [2023, 'X', 2, 300_000, 2 / 3],
      [2024, 'Y', 2, 480_000, 2 / 3],
    ]);
  });

  it('lists the years with data', () => {
    expect(library.yearsWithData()).toEqual([2023, 2024]);
  });
});

describe('comparison', () => {
  it('compares two years and their artist overlap', () => {
    const c = library.compare(
      { preset: 'custom', start: '2023-01-01', end: '2023-12-31' },
      { preset: 'custom', start: '2024-01-01', end: '2024-12-31' },
    );
    expect(c?.a.msPlayed).toBe(540_000);
    expect(c?.b.msPlayed).toBe(680_000);
    expect(c?.a.streams).toBe(3);
    expect(c?.b.registeredPlays).toBe(4);
    expect(c?.artists).toEqual({ shared: 2, onlyA: 0, onlyB: 1 });
  });
});
