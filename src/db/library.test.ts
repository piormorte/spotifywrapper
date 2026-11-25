import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BackupError, contentHash } from './backup.ts';
import { searchHistory } from './queries.ts';
import { APPLICATION_ID, SCHEMA_VERSION, migrate, schemaVersion } from './schema.ts';
import { exportDatabase, openFromBytes } from './sqlite.ts';
import { bytesFile, extendedRecord, jsonFile, loadSqlite, newLibrary } from './test-utils.ts';

const NOW = Date.UTC(2026, 10, 25);
const fixture = (name: string) =>
  bytesFile(name, new Uint8Array(readFileSync(`tests/fixtures/${name}`)));
const EXTENDED = fixture('Streaming_History_Audio_2023-2024_0.json');
const BASIC = fixture('StreamingHistory_music_0.json');
const PODCAST = fixture('StreamingHistory_podcast_0.json');

describe('schema', () => {
  it('migrates a new database and is idempotent', async () => {
    const { host } = await newLibrary();
    expect(schemaVersion(host.db)).toBe(SCHEMA_VERSION);
    expect(Number(host.db.selectValue('PRAGMA application_id'))).toBe(APPLICATION_ID);
    expect(migrate(host.db)).toBe(SCHEMA_VERSION);
  });

  it('refuses a database from a newer version', async () => {
    const { host } = await newLibrary();
    host.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    expect(() => migrate(host.db)).toThrow(/newer/);
  });
});

describe('import', () => {
  it('imports, deduplicates and reports per file', async () => {
    const { library } = await newLibrary();
    const result = await library.importFiles([EXTENDED], undefined, NOW);
    const [file] = result.files;
    expect(file?.ok).toBe(true);
    if (!file?.ok) return;
    expect(file.report.accepted).toBe(8);
    expect(file.inserted).toBe(7); // the exact duplicate is ignored
    expect(file.duplicates).toBe(1);
    expect(file.seenBefore).toBe(false);
  });

  it('is idempotent when the same file is imported again', async () => {
    const { library } = await newLibrary();
    await library.importFiles([EXTENDED], undefined, NOW);
    const before = library.summary();
    const again = await library.importFiles([EXTENDED], undefined, NOW);
    const [file] = again.files;
    expect(file?.ok && file.inserted).toBe(0);
    expect(file?.ok && file.seenBefore).toBe(true);
    expect({ ...library.summary(), imports: 0 }).toEqual({ ...before, imports: 0 });
  });

  it('summarizes music separately from spoken word and applies play definitions', async () => {
    const { library } = await newLibrary();
    const { summary } = await library.importFiles([EXTENDED], undefined, NOW);
    // Music rows: Low Tide, Night Ferry (12 s), Night Ferry (0 s), Home Recording, Cinza e Ouro.
    expect(summary.records).toBe(5);
    expect(summary.registeredPlays).toBe(4);
    expect(summary.streams).toBe(3);
    expect(summary.msPlayed).toBe(215000 + 12000 + 0 + 180000 + 200000);
    expect(summary.tracks).toBe(4);
    expect(summary.artists).toBe(3);
    expect(summary.spokenWordPlays).toBe(2);
    expect(summary.firstPlay).toBe(Date.UTC(2023, 11, 31, 23, 59));
    expect(summary.extendedUntil).toBe(Date.UTC(2024, 0, 5, 20));
  });

  it('keeps going when one file is invalid', async () => {
    const { library } = await newLibrary();
    const bad = bytesFile('notes.json', new TextEncoder().encode('{"hello":1}'));
    const latin1 = bytesFile('x.json', new Uint8Array([0x5b, 0xff, 0x5d]));
    const result = await library.importFiles([bad, latin1, EXTENDED], undefined, NOW);
    expect(result.files.map((f) => (f.ok ? 'ok' : f.error.code))).toEqual([
      'not_an_array',
      'invalid_encoding',
      'ok',
    ]);
  });

  it('reports progress per batch', async () => {
    const { library } = await newLibrary();
    const phases: string[] = [];
    await library.importFiles([EXTENDED], (p) => phases.push(p.phase), NOW);
    expect(phases).toEqual(['reading', 'writing', 'indexing']);
  });
});

describe('basic export and identity resolution', () => {
  it('ignores basic records inside the Extended period and links the rest to the same tracks', async () => {
    const { library, host } = await newLibrary();
    const result = await library.importFiles([EXTENDED, BASIC, PODCAST], undefined, NOW);
    // Two basic records (2023-12-31, 2024-01-02) fall inside the Extended period.
    const basic = result.files[1];
    expect(basic?.ok && basic.covered).toBe(2);
    expect(result.superseded).toBe(0);
    expect(result.summary.bySource.basic).toBe(3);

    const ids = host.db.selectValues(
      `SELECT DISTINCT p.track_id FROM plays p JOIN tracks t ON t.id = p.track_id
       WHERE t.name = 'Low Tide Letters'`,
    );
    expect(ids).toHaveLength(1);
  });

  it('skips basic records already covered by Extended data on re-import', async () => {
    const { library } = await newLibrary();
    await library.importFiles([EXTENDED, BASIC], undefined, NOW);
    const again = await library.importFiles([BASIC], undefined, NOW);
    const [file] = again.files;
    expect(file?.ok && file.inserted).toBe(0);
    expect(file?.ok && file.covered).toBe(2);
    expect(again.superseded).toBe(0);
  });

  it('removes basic plays once Extended data covering them is imported later', async () => {
    const { library } = await newLibrary();
    await library.importFiles([BASIC], undefined, NOW);
    const result = await library.importFiles([EXTENDED], undefined, NOW);
    // 2024-01-02 Small Weather is superseded; the 2023-12-31 play was upgraded in place.
    expect(result.superseded).toBe(1);
    expect(result.summary.bySource.basic).toBe(2);
  });

  it('adopts a URI when Extended data arrives after the basic export', async () => {
    const a = await newLibrary();
    await a.library.importFiles([BASIC], undefined, NOW);
    await a.library.importFiles([EXTENDED], undefined, NOW);

    const b = await newLibrary();
    await b.library.importFiles([EXTENDED, BASIC], undefined, NOW);

    expect(a.library.summary()).toEqual({ ...b.library.summary(), imports: 2 });
    expect(await contentHash(a.host.db)).toBe(await contentHash(b.host.db));
  });
});

describe('search', () => {
  it('finds plays by track, artist or album prefix, ignoring case and accents', async () => {
    const { library, host } = await newLibrary();
    await library.importFiles(
      [
        EXTENDED,
        jsonFile('Streaming_History_Audio_extra.json', [
          extendedRecord(
            '2024-03-01T10:00:00Z',
            100000,
            'Coração de Vidro',
            'Ilse Varga',
            null,
            null,
          ),
        ]),
      ],
      undefined,
      NOW,
    );
    const q = (text: string) => searchHistory(host.db, { text, kind: 'track' });
    expect(q('coracao').rows.map((r) => r.track)).toEqual(['Coração de Vidro']);
    expect(q('HALDEN').total).toBe(2); // the 0 s play is not listed
    expect(q('nort fer').total).toBe(1);
    expect(q('"unbalanced (').total).toBe(0);
    expect(q('').total).toBe(5);
  });

  it('pages newest first with a stable cursor', async () => {
    const { library } = await newLibrary();
    await library.importFiles([EXTENDED], undefined, NOW);
    const first = library.history({ kind: 'track', limit: 2 });
    const last = first.rows.at(-1);
    if (!last) throw new Error('expected rows');
    const second = library.history({
      kind: 'track',
      limit: 2,
      after: { tsEnd: last.tsEnd, id: last.id },
    });
    const all = library.history({ kind: 'track', limit: 10 });
    expect([...first.rows, ...second.rows].map((r) => r.id)).toEqual(
      all.rows.slice(0, 4).map((r) => r.id),
    );
    const times = all.rows.map((r) => r.tsEnd);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('filters by time range', async () => {
    const { library } = await newLibrary();
    await library.importFiles([EXTENDED], undefined, NOW);
    const page = library.history({
      kind: 'track',
      from: Date.UTC(2024, 0, 1),
      to: Date.UTC(2024, 0, 3),
    });
    expect(page.total).toBe(2);
  });
});

describe('backup and restore', () => {
  it('round-trips: restoring into an empty library reproduces the same content', async () => {
    const source = await newLibrary();
    await source.library.importFiles([EXTENDED, BASIC, PODCAST], undefined, NOW);
    const { bytes, info } = await source.library.backup(NOW);
    expect(info.counts.plays).toBe(source.library.summary().records + 3);

    const target = await newLibrary();
    expect((await target.library.inspectBackup(bytes)).contentHash).toBe(info.contentHash);
    const result = await target.library.restore(bytes, 'replace', NOW);
    expect(result.summary).toEqual(source.library.summary());
    expect(await contentHash(target.host.db)).toBe(await contentHash(source.host.db));
    expect(target.library.history({ text: 'halden' }).total).toBe(
      source.library.history({ text: 'halden' }).total,
    );
  });

  it('merges a backup without duplicating plays', async () => {
    const source = await newLibrary();
    await source.library.importFiles([EXTENDED], undefined, NOW);
    const { bytes } = await source.library.backup(NOW);

    const target = await newLibrary();
    await target.library.importFiles([EXTENDED, PODCAST], undefined, NOW);
    const result = await target.library.restore(bytes, 'merge', NOW);
    expect(result.inserted).toBe(0);
    expect(result.duplicates).toBe(source.library.summary().records + 2);
  });

  it('keeps a safety copy of the previous database before replacing', async () => {
    const source = await newLibrary();
    const { bytes } = await source.library.backup(NOW);
    const target = await newLibrary();
    await target.library.importFiles([EXTENDED], undefined, NOW);
    await target.library.restore(bytes, 'replace', NOW);
    expect(target.host.safetyCopy).not.toBeNull();
    expect(target.library.summary().records).toBe(0);
  });

  it('rejects files that are not valid Liner backups without touching data', async () => {
    const sqlite3 = await loadSqlite();
    const { library } = await newLibrary();
    await library.importFiles([EXTENDED], undefined, NOW);
    const before = library.summary();
    const code = async (bytes: Uint8Array) => {
      try {
        await library.restore(bytes, 'replace', NOW);
        return 'restored';
      } catch (e) {
        return e instanceof BackupError ? e.code : 'other';
      }
    };

    expect(await code(new TextEncoder().encode('hello'))).toBe('not_sqlite');

    const other = new sqlite3.oo1.DB(':memory:');
    other.exec('CREATE TABLE x (a); INSERT INTO x VALUES (1);');
    expect(await code(exportDatabase(sqlite3, other))).toBe('wrong_app');
    other.close();

    const plainLiner = (await newLibrary()).host;
    expect(await code(exportDatabase(sqlite3, plainLiner.db))).toBe('not_a_backup');

    const { bytes } = await library.backup(NOW);
    const tampered = openFromBytes(sqlite3, bytes);
    tampered.exec(
      'UPDATE plays SET ms_played = ms_played + 1 WHERE id = (SELECT MIN(id) FROM plays)',
    );
    expect(await code(exportDatabase(sqlite3, tampered))).toBe('checksum_mismatch');
    tampered.close();

    const newer = openFromBytes(sqlite3, bytes);
    newer.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    expect(await code(exportDatabase(sqlite3, newer))).toBe('newer_schema');
    newer.close();

    expect(library.summary()).toEqual(before);
  });
});

describe('erase', () => {
  it('removes all data and keeps a safety copy', async () => {
    const { library, host } = await newLibrary();
    await library.importFiles([EXTENDED], undefined, NOW);
    const summary = await library.eraseAll();
    expect(summary.records).toBe(0);
    expect(summary.imports).toBe(0);
    expect(library.history({ text: 'halden' }).total).toBe(0);
    expect(host.safetyCopy).not.toBeNull();
  });
});
