import { parseExportFile } from '../importer/parse.ts';
import { ImportFileError, type FileReport, type NormalizedPlay } from '../importer/types.ts';
import { BackupError, createBackup, openVerifiedBackup, type BackupInfo } from './backup.ts';
import type { DatabaseHost } from './host.ts';
import { Ingestor, pruneCatalog, rebuildSearchIndex, supersedeBasicPlays } from './ingest.ts';
import {
  getSetting,
  librarySummary,
  listImports,
  searchHistory,
  setSetting,
  type HistoryPage,
  type HistoryQuery,
  type ImportLogEntry,
  type LibrarySummary,
} from './queries.ts';
import { isValidTimeZone, toLocalMs } from '../lib/time.ts';
import { overview, type Overview } from '../stats/overview.ts';
import {
  albumTopTracks,
  ranking,
  type AlbumTrack,
  type Ranking,
  type RankingQuery,
} from '../stats/rankings.ts';
import type { Granularity, PeriodSpec } from '../stats/period.ts';
import {
  compare,
  dominantArtists,
  timeline,
  yearsWithData,
  type Comparison,
  type Timeline,
  type YearLeader,
} from '../stats/timeline.ts';
import { configureConnection, migrate } from './schema.ts';
import { asText, asTextOrNull, exportDatabase, selectInt, type Database } from './sqlite.ts';

/**
 * The library service: everything the UI can ask of the local database.
 * Runs inside the database worker; framework-free and fully testable in Node.
 */

export const BATCH_SIZE = 5_000;

/** A file to import. Read lazily, one at a time, to bound memory. */
export interface ImportInput {
  readonly name: string;
  readonly read: () => Promise<Uint8Array>;
}

export interface ImportProgress {
  readonly fileIndex: number;
  readonly fileCount: number;
  readonly fileName: string;
  readonly phase: 'reading' | 'writing' | 'indexing';
  /** Records written so far in this file. */
  readonly processed: number;
  /** Accepted records in this file. */
  readonly total: number;
}

export type FileOutcome =
  | {
      readonly ok: true;
      readonly fileName: string;
      readonly report: FileReport;
      readonly inserted: number;
      readonly duplicates: number;
      /** Basic-export records skipped because Extended data already covers them. */
      readonly covered: number;
      /** The identical file (same SHA-256) was imported before. */
      readonly seenBefore: boolean;
    }
  | {
      readonly ok: false;
      readonly fileName: string;
      readonly error: { readonly code: string; readonly message: string };
    };

export interface ImportResult {
  readonly files: readonly FileOutcome[];
  /** Basic-export plays removed because Extended data now covers them. */
  readonly superseded: number;
  readonly summary: LibrarySummary;
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreResult {
  readonly mode: RestoreMode;
  readonly info: BackupInfo;
  readonly inserted: number;
  readonly duplicates: number;
  readonly summary: LibrarySummary;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export class Library {
  private readonly host: DatabaseHost;
  private readonly appVersion: string;

  private readonly defaultTimeZone: string;
  private tz: string;

  /**
   * @param defaultTimeZone Used until the user picks one (normally the device zone).
   */
  constructor(host: DatabaseHost, appVersion: string, defaultTimeZone = 'UTC') {
    this.host = host;
    this.appVersion = appVersion;
    this.defaultTimeZone = isValidTimeZone(defaultTimeZone) ? defaultTimeZone : 'UTC';
    this.tz = this.defaultTimeZone;
    this.openConnection();
  }

  /** Per-connection setup: pragmas, migrations, time zone and local times. */
  private openConnection(): void {
    configureConnection(this.db);
    migrate(this.db);
    const stored = getSetting(this.db, 'timeZone');
    this.tz = stored && isValidTimeZone(stored) ? stored : this.defaultTimeZone;
    this.db.createFunction('liner_local_ms', (_ctx, ts) => toLocalMs(Number(ts), this.tz), {
      deterministic: false,
    });
    this.fillLocalTimes(false);
  }

  /** Computes local_end for rows missing it, or for every row after a zone change. */
  private fillLocalTimes(all: boolean): void {
    this.db.exec(
      `UPDATE plays SET local_end = liner_local_ms(ts_end)${all ? '' : ' WHERE local_end IS NULL'}`,
    );
  }

  private toLocal = (utcMs: number): number => toLocalMs(utcMs, this.tz);

  timeZone(): string {
    return this.tz;
  }

  /** Changes the time zone used for local-time statistics and recomputes local times. */
  setTimeZone(timeZone: string): void {
    if (!isValidTimeZone(timeZone)) throw new RangeError(`Unknown time zone: ${timeZone}`);
    setSetting(this.db, 'timeZone', timeZone);
    this.tz = timeZone;
    this.db.transaction(() => {
      this.fillLocalTimes(true);
    });
  }

  private get db(): Database {
    return this.host.db;
  }

  get persistent(): boolean {
    return this.host.persistent;
  }

  summary(): LibrarySummary {
    return librarySummary(this.db);
  }

  /** Overview statistics for a period, or null when there is no music data. */
  overview(spec: PeriodSpec): Overview | null {
    return overview(this.db, spec);
  }

  timeline(spec: PeriodSpec, granularity: Granularity | null): Timeline | null {
    return timeline(this.db, spec, granularity);
  }

  dominantArtists(): YearLeader[] {
    return dominantArtists(this.db);
  }

  yearsWithData(): number[] {
    return yearsWithData(this.db);
  }

  compare(a: PeriodSpec, b: PeriodSpec): Comparison | null {
    return compare(this.db, a, b);
  }

  ranking(query: RankingQuery): Ranking | null {
    return ranking(this.db, query);
  }

  albumTracks(albumId: number, spec: PeriodSpec): AlbumTrack[] {
    return albumTopTracks(this.db, albumId, spec);
  }

  history(query: HistoryQuery): HistoryPage {
    return searchHistory(this.db, query);
  }

  imports(): ImportLogEntry[] {
    return listImports(this.db);
  }

  setting(key: string): string | null {
    return getSetting(this.db, key);
  }

  updateSetting(key: string, value: string): void {
    setSetting(this.db, key, value);
  }

  private writePlays(
    ingestor: Ingestor,
    plays: readonly NormalizedPlay[],
    importId: number | null,
    onBatch: (processed: number) => void,
  ): { inserted: number; duplicates: number } {
    let inserted = 0;
    let duplicates = 0;
    for (let start = 0; start < plays.length; start += BATCH_SIZE) {
      const result = ingestor.insertBatch(plays.slice(start, start + BATCH_SIZE), importId);
      inserted += result.inserted;
      duplicates += result.duplicates;
      onBatch(Math.min(start + BATCH_SIZE, plays.length));
    }
    return { inserted, duplicates };
  }

  private extendedUntil(): number | null {
    const value = this.db.selectValue(`SELECT MAX(ts_end) FROM plays WHERE source = 'extended'`);
    return value === null || value === undefined ? null : Number(value);
  }

  private finalize(): number {
    const superseded = supersedeBasicPlays(this.db);
    pruneCatalog(this.db);
    rebuildSearchIndex(this.db);
    return superseded;
  }

  async importFiles(
    inputs: readonly ImportInput[],
    onProgress: (progress: ImportProgress) => void = () => undefined,
    now = Date.now(),
  ): Promise<ImportResult> {
    const files: FileOutcome[] = [];
    const ingestor = new Ingestor(this.db, this.toLocal);

    for (const [fileIndex, input] of inputs.entries()) {
      const base = { fileIndex, fileCount: inputs.length, fileName: input.name };
      onProgress({ ...base, phase: 'reading', processed: 0, total: 0 });
      try {
        const bytes = await input.read();
        const fileHash = await sha256Hex(bytes);
        const seenBefore =
          selectInt(this.db, 'SELECT COUNT(*) FROM imports WHERE file_sha256 = ?', [fileHash]) > 0;
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const parsed = parseExportFile(input.name, text, now);
        const { report } = parsed;
        // Basic-export records inside the Extended period are never written:
        // Extended data is authoritative there (see supersedeBasicPlays).
        const extendedUntil = this.extendedUntil();
        const plays =
          extendedUntil === null
            ? parsed.plays
            : parsed.plays.filter((p) => p.source !== 'basic' || p.tsEnd > extendedUntil);
        const covered = parsed.plays.length - plays.length;

        this.db.exec({
          sql: 'INSERT INTO imports (file_name, file_sha256, kind, created_at) VALUES (?, ?, ?, ?)',
          bind: [input.name, fileHash, report.kind, now],
        });
        const importId = selectInt(this.db, 'SELECT last_insert_rowid()');

        const { inserted, duplicates } = this.writePlays(ingestor, plays, importId, (processed) => {
          onProgress({ ...base, phase: 'writing', processed, total: plays.length });
        });

        this.db.exec({
          sql: 'UPDATE imports SET inserted = ?, duplicates = ?, report_json = ? WHERE id = ?',
          bind: [inserted, duplicates, JSON.stringify(report), importId],
        });
        files.push({
          ok: true,
          fileName: input.name,
          report,
          inserted,
          duplicates,
          covered,
          seenBefore,
        });
      } catch (error) {
        files.push({
          ok: false,
          fileName: input.name,
          error:
            error instanceof ImportFileError
              ? { code: error.code, message: error.message }
              : error instanceof TypeError
                ? { code: 'invalid_encoding', message: 'O arquivo não está em UTF-8.' }
                : { code: 'unexpected', message: 'Erro inesperado ao processar o arquivo.' },
        });
      }
    }

    onProgress({
      fileIndex: inputs.length - 1,
      fileCount: inputs.length,
      fileName: '',
      phase: 'indexing',
      processed: 0,
      total: 0,
    });
    const superseded = this.finalize();
    return { files, superseded, summary: this.summary() };
  }

  async backup(now = Date.now()): Promise<{ bytes: Uint8Array; info: BackupInfo }> {
    const result = await createBackup(this.host.sqlite3, this.db, this.appVersion, now);
    setSetting(this.db, 'lastBackupAt', String(now));
    return result;
  }

  /** Verifies a backup without changing anything. */
  async inspectBackup(bytes: Uint8Array): Promise<BackupInfo> {
    const { db, info } = await openVerifiedBackup(this.host.sqlite3, bytes);
    db.close();
    return info;
  }

  async restore(bytes: Uint8Array, mode: RestoreMode, now = Date.now()): Promise<RestoreResult> {
    const { db: incoming, info } = await openVerifiedBackup(this.host.sqlite3, bytes);
    try {
      await this.host.saveSafetyCopy(exportDatabase(this.host.sqlite3, this.db));

      if (mode === 'replace') {
        const replacement = exportDatabase(this.host.sqlite3, incoming);
        await this.host.replace(replacement);
        this.openConnection();
        this.db.transaction(() => {
          this.fillLocalTimes(true);
        });
        this.finalize();
        return { mode, info, inserted: info.counts.plays, duplicates: 0, summary: this.summary() };
      }

      const plays = readPlays(incoming);
      this.db.exec({
        sql: 'INSERT INTO imports (file_name, file_sha256, kind, created_at) VALUES (?, ?, ?, ?)',
        bind: [
          `Backup de ${new Date(info.createdAt).toISOString()}`,
          info.contentHash,
          'backup_merge',
          now,
        ],
      });
      const importId = selectInt(this.db, 'SELECT last_insert_rowid()');
      const { inserted, duplicates } = this.writePlays(
        new Ingestor(this.db, this.toLocal),
        plays,
        importId,
        () => undefined,
      );
      this.db.exec({
        sql: 'UPDATE imports SET inserted = ?, duplicates = ? WHERE id = ?',
        bind: [inserted, duplicates, importId],
      });
      this.finalize();
      return { mode, info, inserted, duplicates, summary: this.summary() };
    } finally {
      incoming.close();
    }
  }

  /** Deletes every play, catalog row, import record and setting. */
  async eraseAll(): Promise<LibrarySummary> {
    await this.host.saveSafetyCopy(exportDatabase(this.host.sqlite3, this.db));
    this.db.transaction((tx) => {
      tx.exec(`DELETE FROM plays; DELETE FROM tracks; DELETE FROM albums; DELETE FROM artists;
               DELETE FROM imports; DELETE FROM settings;
               INSERT INTO search_fts (search_fts) VALUES ('delete-all');`);
    });
    this.tz = this.defaultTimeZone;
    return this.summary();
  }
}

/** Reads every play of a (verified) database back into normalized form. */
function readPlays(db: Database): NormalizedPlay[] {
  const flag = (v: unknown) => (v === null ? null : Number(v) === 1);
  return db
    .selectArrays(
      `SELECT p.ts_end, p.ms_played, t.kind, t.track_key, t.uri, t.name, a.name, al.name,
              p.reason_start, p.reason_end, p.shuffle, p.skipped, p.offline, p.incognito, p.source
       FROM plays p
       JOIN tracks t ON t.id = p.track_id
       JOIN artists a ON a.id = t.artist_id
       LEFT JOIN albums al ON al.id = t.album_id`,
    )
    .map((r) => ({
      tsEnd: Number(r[0]),
      msPlayed: Number(r[1]),
      kind: r[2] as NormalizedPlay['kind'],
      trackKey: asText(r[3]),
      uri: asTextOrNull(r[4]),
      trackName: asText(r[5]),
      artistName: asText(r[6]),
      albumName: asTextOrNull(r[7]),
      reasonStart: asTextOrNull(r[8]),
      reasonEnd: asTextOrNull(r[9]),
      shuffle: flag(r[10]),
      skipped: flag(r[11]),
      offline: flag(r[12]),
      incognito: flag(r[13]),
      source: r[14] as NormalizedPlay['source'],
    }));
}

export { BackupError };
