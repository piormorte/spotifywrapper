import { beforeAll, describe, expect, it } from 'vitest';
import type { Library } from '../db/library.ts';
import { extendedRecord, jsonFile, newLibrary } from '../db/test-utils.ts';

/**
 * Hand-computed fixture (UTC).
 *
 *  track / artist / album   plays (ms)                          streams  registered  time
 *  A / X / P                200k, 100k (2024-01-01), 31k (02-01)    3         3      331k
 *  B / X / P                20k, 20k, 20k, 20k (2024-01-02)          0         4       80k
 *  C / Y / Q                240k, 240k (2024-01-03)                  2         2      480k
 *  D / Y / —  (no album)    60k (2023-06-01)                         1         1       60k
 */
const uri = (n: number) => `spotify:track:${String(n).padStart(22, '0')}`;
const R = extendedRecord;
const RECORDS = [
  R('2023-06-01T10:00:00Z', 60_000, 'D', 'Y', null, uri(4)),
  R('2024-01-01T10:00:00Z', 200_000, 'A', 'X', 'P', uri(1)),
  R('2024-01-01T11:00:00Z', 100_000, 'A', 'X', 'P', uri(1)),
  R('2024-01-02T10:00:00Z', 20_000, 'B', 'X', 'P', uri(2)),
  R('2024-01-02T10:01:00Z', 20_000, 'B', 'X', 'P', uri(2)),
  R('2024-01-02T10:02:00Z', 20_000, 'B', 'X', 'P', uri(2)),
  R('2024-01-02T10:03:00Z', 20_000, 'B', 'X', 'P', uri(2)),
  R('2024-01-03T10:00:00Z', 240_000, 'C', 'Y', 'Q', uri(3)),
  R('2024-01-03T11:00:00Z', 240_000, 'C', 'Y', 'Q', uri(3)),
  R('2024-02-01T10:00:00Z', 31_000, 'A', 'X', 'P', uri(1)),
];

let library: Library;
beforeAll(async () => {
  ({ library } = await newLibrary('UTC'));
  await library.importFiles([jsonFile('Streaming_History_Audio_r.json', RECORDS)]);
});

const all = { preset: 'all' } as const;

describe('track rankings', () => {
  it('sorts by streams, then time', () => {
    const r = library.ranking({ kind: 'tracks', period: all, sort: 'streams', limit: null });
    expect(r?.total).toBe(4);
    expect(r?.rows.map((x) => [x.rank, x.name, x.streams])).toEqual([
      [1, 'A', 3],
      [2, 'C', 2],
      [3, 'D', 1],
      [4, 'B', 0],
    ]);
    expect(r?.rows[0]).toMatchObject({
      artist: 'X',
      album: 'P',
      registeredPlays: 3,
      msPlayed: 331_000,
    });
  });

  it('sorts by registered plays or by listening time', () => {
    const plays = library.ranking({ kind: 'tracks', period: all, sort: 'plays', limit: null });
    expect(plays?.rows.map((x) => x.name)).toEqual(['B', 'A', 'C', 'D']);
    const time = library.ranking({ kind: 'tracks', period: all, sort: 'time', limit: 2 });
    expect(time?.rows.map((x) => x.name)).toEqual(['C', 'A']);
    expect(time?.total).toBe(4);
  });

  it('reports lifetime first and last plays regardless of the period', () => {
    const r = library.ranking({
      kind: 'tracks',
      period: { preset: 'custom', start: '2024-01-01', end: '2024-01-01' },
      sort: 'streams',
      limit: null,
    });
    expect(r?.rows.map((x) => x.name)).toEqual(['A']);
    expect(r?.rows[0]).toMatchObject({
      streams: 2,
      firstPlay: Date.UTC(2024, 0, 1, 10),
      lastPlay: Date.UTC(2024, 1, 1, 10),
    });
  });
});

describe('artist and album rankings', () => {
  it('aggregates artists with distinct track counts; equal streams fall back to time', () => {
    const r = library.ranking({ kind: 'artists', period: all, sort: 'streams', limit: null });
    expect(
      r?.rows.map((x) => [x.name, x.streams, x.registeredPlays, x.msPlayed, x.distinctTracks]),
    ).toEqual([
      ['Y', 3, 3, 540_000, 2],
      ['X', 3, 7, 411_000, 2],
    ]);
  });

  it('ranks albums and skips tracks without one', () => {
    const r = library.ranking({ kind: 'albums', period: all, sort: 'time', limit: null });
    expect(r?.rows.map((x) => [x.name, x.artist, x.msPlayed, x.distinctTracks])).toEqual([
      ['Q', 'Y', 480_000, 1],
      ['P', 'X', 411_000, 2],
    ]);
  });

  it("lists an album's most played tracks", () => {
    const albums = library.ranking({ kind: 'albums', period: all, sort: 'time', limit: null });
    const p = albums?.rows.find((x) => x.name === 'P');
    expect(p && library.albumTracks(p.id, all).map((t) => [t.name, t.streams])).toEqual([
      ['A', 3],
      ['B', 0],
    ]);
  });

  it('agrees with the overview totals', () => {
    const overview = library.overview(all);
    const tracks = library.ranking({ kind: 'tracks', period: all, sort: 'streams', limit: null });
    const sum = (k: 'streams' | 'msPlayed') => tracks?.rows.reduce((a, r) => a + r[k], 0);
    expect(sum('streams')).toBe(overview?.streams);
    expect(sum('msPlayed')).toBe(overview?.msPlayed);
    expect(tracks?.total).toBe(overview?.distinctTracks);
  });
});
