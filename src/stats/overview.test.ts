import { beforeAll, describe, expect, it } from 'vitest';
import type { Library } from '../db/library.ts';
import { extendedRecord, jsonFile, newLibrary } from '../db/test-utils.ts';

/**
 * Hand-computed fixture. Time zone America/Sao_Paulo (UTC−3, no DST in 2024).
 *
 *  #  UTC end            local end          ms       track / artist / album
 *  1  2024-01-01 02:30   2023-12-31 23:30   200 000  A / X / P
 *  2  2024-01-01 12:00   2024-01-01 09:00   100 000  A / X / P
 *  3  2024-01-01 13:00   2024-01-01 10:00    20 000  B / X / P   (registered, not a stream)
 *  4  2024-01-02 15:00   2024-01-02 12:00         0  B / X / P   (never counted)
 *  5  2024-01-03 18:00   2024-01-03 15:00   240 000  C / Y / Q
 *  6  2024-01-03 19:00   2024-01-03 16:00   240 000  C / Y / Q
 *  7  2024-01-03 20:00   episode            600 000  (spoken word, excluded)
 */
const uri = (n: number) => `spotify:track:${String(n).padStart(22, '0')}`;
const RECORDS = [
  extendedRecord('2024-01-01T02:30:00Z', 200_000, 'A', 'X', 'P', uri(1)),
  extendedRecord('2024-01-01T12:00:00Z', 100_000, 'A', 'X', 'P', uri(1)),
  extendedRecord('2024-01-01T13:00:00Z', 20_000, 'B', 'X', 'P', uri(2)),
  extendedRecord('2024-01-02T15:00:00Z', 0, 'B', 'X', 'P', uri(2)),
  extendedRecord('2024-01-03T18:00:00Z', 240_000, 'C', 'Y', 'Q', uri(3)),
  extendedRecord('2024-01-03T19:00:00Z', 240_000, 'C', 'Y', 'Q', uri(3)),
  {
    ts: '2024-01-03T20:00:00Z',
    ms_played: 600_000,
    episode_name: 'E1',
    episode_show_name: 'Show',
    spotify_episode_uri: 'spotify:episode:0000000000000000000009',
  },
];

let library: Library;

beforeAll(async () => {
  ({ library } = await newLibrary('America/Sao_Paulo'));
  await library.importFiles([jsonFile('Streaming_History_Audio_x.json', RECORDS)]);
});

describe('overview (all time)', () => {
  it('totals use the play definitions and exclude spoken word', () => {
    const o = library.overview({ preset: 'all' });
    expect(o).toMatchObject({
      msPlayed: 800_000,
      registeredPlays: 5,
      streams: 4,
      distinctTracks: 3,
      distinctArtists: 2,
      distinctAlbums: 2,
      listeningDays: 3,
      dataFirstDay: '2023-12-31',
      dataLastDay: '2024-01-03',
    });
  });

  it('spans local calendar days and averages over all of them', () => {
    const o = library.overview({ preset: 'all' });
    expect(o?.period).toMatchObject({ days: 4, granularity: 'day' });
    expect(o?.dailyAverageMs).toBe(200_000);
    expect(o?.series).toEqual([
      { key: '2023-12-31', msPlayed: 200_000 },
      { key: '2024-01-01', msPlayed: 120_000 },
      { key: '2024-01-02', msPlayed: 0 },
      { key: '2024-01-03', msPlayed: 480_000 },
    ]);
  });

  it('ranks by streams, then listening time', () => {
    const o = library.overview({ preset: 'all' });
    expect(o?.topArtists.map((e) => [e.name, e.streams, e.msPlayed])).toEqual([
      ['Y', 2, 480_000],
      ['X', 2, 320_000],
    ]);
    expect(o?.topTracks.map((e) => [e.name, e.artist, e.streams])).toEqual([
      ['C', 'Y', 2],
      ['A', 'X', 2],
      ['B', 'X', 0],
    ]);
    expect(o?.topAlbums.map((e) => e.name)).toEqual(['Q', 'P']);
  });

  it('finds the peak day and the hourly profile in local time', () => {
    const o = library.overview({ preset: 'all' });
    expect(o?.peakDay).toEqual({ day: '2024-01-03', msPlayed: 480_000 });
    const hours = o?.hours ?? [];
    expect(hours[23]).toBe(200_000);
    expect(hours[9]).toBe(100_000);
    expect(hours[10]).toBe(20_000);
    expect(hours[15]).toBe(240_000);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(800_000);
  });
});

describe('periods and time zones', () => {
  it('filters a custom single day', () => {
    const o = library.overview({ preset: 'custom', start: '2024-01-01', end: '2024-01-01' });
    expect(o).toMatchObject({ msPlayed: 120_000, registeredPlays: 2, streams: 1 });
    expect(o?.period.days).toBe(1);
  });

  it('returns null for an invalid custom range', () => {
    expect(
      library.overview({ preset: 'custom', start: '2024-02-01', end: '2024-01-01' }),
    ).toBeNull();
  });

  it('recomputes local days when the time zone changes', async () => {
    const { library: utc } = await newLibrary('America/Sao_Paulo');
    await utc.importFiles([jsonFile('Streaming_History_Audio_x.json', RECORDS)]);
    utc.setTimeZone('UTC');
    const o = utc.overview({ preset: 'all' });
    expect(o?.period.days).toBe(3);
    expect(o?.series[0]).toEqual({ key: '2024-01-01', msPlayed: 320_000 });
    expect(o?.hours[2]).toBe(200_000);
    expect(utc.timeZone()).toBe('UTC');
    expect(() => {
      utc.setTimeZone('Mars/Base');
    }).toThrow(RangeError);
  });

  it('is identical after a backup round trip', async () => {
    const { bytes } = await library.backup();
    const { library: restored } = await newLibrary('Asia/Tokyo');
    await restored.restore(bytes, 'replace');
    // The time zone travels with the backup's settings only if one was chosen;
    // otherwise the restoring device's default applies.
    restored.setTimeZone('America/Sao_Paulo');
    expect(restored.overview({ preset: 'all' })).toEqual(library.overview({ preset: 'all' }));
  });

  it('returns null without music data', async () => {
    const { library: empty } = await newLibrary();
    expect(empty.overview({ preset: 'all' })).toBeNull();
  });
});
