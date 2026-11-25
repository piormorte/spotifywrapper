import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hash53, nameBasedTrackKey } from './normalize.ts';
import { detectKind, parseExportFile } from './parse.ts';
import { ImportFileError } from './types.ts';

const NOW = Date.UTC(2026, 10, 25);
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, 'utf8');

describe('Extended Streaming History', () => {
  const { report, plays } = parseExportFile(
    'Streaming_History_Audio_2023-2024_0.json',
    fixture('Streaming_History_Audio_2023-2024_0.json'),
    NOW,
  );

  it('reports read, accepted and rejected counts by reason', () => {
    expect(report.kind).toBe('extended_audio');
    expect(report.read).toBe(15);
    expect(report.accepted).toBe(8);
    expect(report.rejected).toEqual({
      missing_identity: 1,
      missing_timestamp: 1,
      invalid_timestamp: 2,
      invalid_ms_played: 2,
      not_an_object: 1,
    });
    expect(report.zeroLength).toBe(1);
    expect(report.minTs).toBe(Date.UTC(2023, 11, 31, 23, 59));
    expect(report.maxTs).toBe(Date.UTC(2024, 0, 5, 20));
  });

  it('lists personal fields that were discarded and unknown fields', () => {
    expect(report.discardedFields).toEqual([
      'conn_country',
      'ip_addr',
      'offline_timestamp',
      'platform',
      'username',
    ]);
    expect(report.unknownFields).toEqual(['new_future_field']);
  });

  it('never carries personal fields into normalized plays', () => {
    const serialized = JSON.stringify(plays);
    for (const forbidden of ['192.0.2.1', 'fixture-user', 'test-platform', 'ZZ']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('normalizes a track record', () => {
    expect(plays[0]).toEqual({
      tsEnd: Date.UTC(2023, 11, 31, 23, 59),
      msPlayed: 215000,
      kind: 'track',
      trackKey: 'spotify:track:0000000000000000000001',
      uri: 'spotify:track:0000000000000000000001',
      trackName: 'Low Tide Letters',
      artistName: 'Halden Vale',
      albumName: 'Northern Rooms',
      reasonStart: 'clickrow',
      reasonEnd: 'trackdone',
      shuffle: false,
      skipped: false,
      offline: false,
      incognito: false,
      source: 'extended',
    });
  });

  it('collapses whitespace in names', () => {
    expect(plays[1]?.trackName).toBe('Night Ferry');
  });

  it('gives local files a name-based key', () => {
    const local = plays.find((p) => p.trackName === 'Home Recording');
    expect(local?.uri).toBeNull();
    expect(local?.trackKey).toBe(nameBasedTrackKey('track', 'Mira Soto', 'Home Recording'));
  });

  it('classifies episodes and audiobook chapters separately from music', () => {
    const episode = plays.find((p) => p.kind === 'episode');
    expect(episode).toMatchObject({
      trackName: 'Episode 12',
      artistName: 'The Quiet Hour Show',
      albumName: null,
      uri: 'spotify:episode:0000000000000000000003',
    });
    const chapter = plays.find((p) => p.kind === 'audiobook');
    expect(chapter).toMatchObject({
      trackName: 'Chapter 1',
      artistName: 'A Fictional Book',
      uri: 'spotify:chapter:0000000000000000000005',
      shuffle: null,
    });
  });

  it('keeps exact duplicates (deduplication happens in the database)', () => {
    expect(plays.filter((p) => p.trackName === 'Cinza e Ouro')).toHaveLength(2);
  });

  it('rejects timestamps in the future', () => {
    const json = JSON.stringify([
      {
        ts: '2030-01-01T00:00:00Z',
        ms_played: 1,
        master_metadata_track_name: 'A',
        master_metadata_album_artist_name: 'B',
      },
    ]);
    expect(parseExportFile('Streaming_History_Audio_x.json', json, NOW).report.rejected).toEqual({
      invalid_timestamp: 1,
    });
  });
});

describe('basic account-data export', () => {
  it('parses music records as UTC with name-based keys', () => {
    const { report, plays } = parseExportFile(
      'StreamingHistory_music_0.json',
      fixture('StreamingHistory_music_0.json'),
      NOW,
    );
    expect(report.kind).toBe('basic_music');
    expect(report.accepted).toBe(4);
    expect(report.rejected).toEqual({ invalid_timestamp: 1 });
    expect(plays[0]).toMatchObject({
      tsEnd: Date.UTC(2023, 11, 31, 23, 59),
      source: 'basic',
      uri: null,
      reasonEnd: null,
    });
    // Same song spelled with different case resolves to the same key.
    expect(plays[0]?.trackKey).toBe(plays[2]?.trackKey);
  });

  it('parses podcast records as episodes', () => {
    const { report, plays } = parseExportFile(
      'StreamingHistory_podcast_0.json',
      fixture('StreamingHistory_podcast_0.json'),
      NOW,
    );
    expect(report.kind).toBe('basic_podcast');
    expect(plays[0]).toMatchObject({ kind: 'episode', artistName: 'The Quiet Hour Show' });
  });
});

describe('file-level validation', () => {
  it.each([
    ['{', 'invalid_json'],
    ['{"a":1}', 'not_an_array'],
    ['[]', 'empty'],
    ['[{"foo":1}]', 'unrecognised_format'],
  ])('rejects %s with %s', (json, code) => {
    expect(() => parseExportFile('x.json', json, NOW)).toThrow(ImportFileError);
    try {
      parseExportFile('x.json', json, NOW);
    } catch (e) {
      expect((e as ImportFileError).code).toBe(code);
    }
  });

  it('detects video history by file name', () => {
    expect(detectKind('Streaming_History_Video_2024.json', [{ ts: 'x', ms_played: 1 }])).toBe(
      'extended_video',
    );
  });
});

describe('hash53', () => {
  it('is deterministic and spreads similar inputs', () => {
    expect(hash53('abc')).toBe(hash53('abc'));
    expect(hash53('abc')).not.toBe(hash53('abd'));
    expect(hash53('abc')).toMatch(/^[0-9a-f]{14}$/);
  });
});
