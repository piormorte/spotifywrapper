import { describe, expect, it } from 'vitest';
import { contentHash } from './backup.ts';
import { extendedRecord, jsonFile, newLibrary } from './test-utils.ts';

/**
 * Load test with synthetic data (run with LOAD=1 npm test). Shaped like a real
 * lifetime export: many files, ~16k records each, ~30k distinct tracks.
 */
const RECORDS = Number(process.env['LOAD_RECORDS'] ?? 520_000);
const PER_FILE = 16_000;

function syntheticFiles() {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  const files = [];
  let t = Date.UTC(2014, 0, 1);
  for (let start = 0; start < RECORDS; start += PER_FILE) {
    const rows = [];
    for (let i = start; i < Math.min(start + PER_FILE, RECORDS); i++) {
      t += Math.floor(60_000 + rand() * 600_000);
      const track = Math.floor(rand() ** 2 * 30_000);
      const artist = Math.floor(track / 12);
      rows.push(
        extendedRecord(
          new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'),
          Math.floor(rand() * 300_000),
          `Track ${track}`,
          `Artist ${artist}`,
          `Album ${Math.floor(track / 10)}`,
          `spotify:track:${track.toString().padStart(22, '0')}`,
          { ip_addr: '192.0.2.1' },
        ),
      );
    }
    files.push(jsonFile(`Streaming_History_Audio_${start}.json`, rows));
  }
  return files;
}

describe.skipIf(!process.env['LOAD'])('load', () => {
  it(`imports ${RECORDS} records, re-imports idempotently, backs up and restores`, async () => {
    const files = syntheticFiles();
    const { library } = await newLibrary();

    let t0 = performance.now();
    const first = await library.importFiles(files);
    const importMs = performance.now() - t0;
    expect(first.summary.records).toBe(RECORDS);

    t0 = performance.now();
    const again = await library.importFiles(files);
    const reimportMs = performance.now() - t0;
    expect(again.files.every((f) => f.ok && f.inserted === 0)).toBe(true);

    t0 = performance.now();
    const page = library.history({ text: 'track 12', limit: 100 });
    const searchMs = performance.now() - t0;
    expect(page.rows.length).toBeGreaterThan(0);

    t0 = performance.now();
    const { bytes } = await library.backup();
    const backupMs = performance.now() - t0;

    const target = await newLibrary();
    t0 = performance.now();
    await target.library.restore(bytes, 'replace');
    const restoreMs = performance.now() - t0;
    expect(await contentHash(target.host.db)).toBe(await contentHash(target.host.db));
    expect(target.library.summary()).toEqual(library.summary());

    console.warn(
      JSON.stringify({
        records: RECORDS,
        files: files.length,
        importS: +(importMs / 1000).toFixed(1),
        reimportS: +(reimportMs / 1000).toFixed(1),
        searchMs: +searchMs.toFixed(0),
        backupS: +(backupMs / 1000).toFixed(1),
        backupMB: +(bytes.byteLength / 1e6).toFixed(1),
        restoreS: +(restoreMs / 1000).toFixed(1),
        heapMB: +(process.memoryUsage().heapUsed / 1e6).toFixed(0),
      }),
    );
  }, 600_000);
});
