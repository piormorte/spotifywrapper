import { cleanText, cleanUri, nameBasedTrackKey } from './normalize.ts';
import {
  ImportFileError,
  type FileKind,
  type FileReport,
  type ItemKind,
  type NormalizedPlay,
  type ParsedFile,
  type RejectionReason,
} from './types.ts';

/**
 * Parses one exported JSON file into normalized plays plus a report.
 * Pure: no I/O, no clock unless `now` is omitted.
 */

/** Extended Streaming History fields this version understands. */
const EXTENDED_FIELDS = new Set([
  'ts',
  'ms_played',
  'master_metadata_track_name',
  'master_metadata_album_artist_name',
  'master_metadata_album_album_name',
  'spotify_track_uri',
  'episode_name',
  'episode_show_name',
  'spotify_episode_uri',
  'audiobook_title',
  'audiobook_uri',
  'audiobook_chapter_uri',
  'audiobook_chapter_title',
  'reason_start',
  'reason_end',
  'shuffle',
  'skipped',
  'offline',
  'incognito_mode',
]);

/** Personal or device data present in exports that is never stored. */
const PERSONAL_FIELDS = new Set([
  'username',
  'platform',
  'conn_country',
  'ip_addr',
  'ip_addr_decrypted',
  'user_agent_decrypted',
  'offline_timestamp',
]);

const BASIC_FIELDS = new Set([
  'endTime',
  'msPlayed',
  'artistName',
  'trackName',
  'podcastName',
  'episodeName',
]);

/** Spotify launched in 2008; anything earlier is not a real playback. */
const EARLIEST_VALID_TS = Date.UTC(2008, 0, 1);
const ONE_DAY = 86_400_000;

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function text(value: unknown): string | null {
  return cleanText(value);
}

class ReportBuilder {
  read = 0;
  accepted = 0;
  zeroLength = 0;
  minTs: number | null = null;
  maxTs: number | null = null;
  readonly rejected: Partial<Record<RejectionReason, number>> = {};
  readonly discarded = new Set<string>();
  readonly unknown = new Set<string>();

  reject(reason: RejectionReason) {
    this.rejected[reason] = (this.rejected[reason] ?? 0) + 1;
  }

  accept(play: NormalizedPlay) {
    this.accepted++;
    if (play.msPlayed === 0) this.zeroLength++;
    this.minTs = this.minTs === null ? play.tsEnd : Math.min(this.minTs, play.tsEnd);
    this.maxTs = this.maxTs === null ? play.tsEnd : Math.max(this.maxTs, play.tsEnd);
  }

  inspectKeys(row: Row, known: ReadonlySet<string>) {
    for (const key of Object.keys(row)) {
      if (PERSONAL_FIELDS.has(key)) this.discarded.add(key);
      else if (!known.has(key)) this.unknown.add(key);
    }
  }

  build(fileName: string, kind: FileKind): FileReport {
    return {
      fileName,
      kind,
      read: this.read,
      accepted: this.accepted,
      rejected: { ...this.rejected },
      zeroLength: this.zeroLength,
      discardedFields: [...this.discarded].sort(),
      unknownFields: [...this.unknown].sort(),
      minTs: this.minTs,
      maxTs: this.maxTs,
    };
  }
}

function validTimestamp(ts: number, now: number): boolean {
  return Number.isFinite(ts) && ts >= EARLIEST_VALID_TS && ts <= now + ONE_DAY;
}

function validMsPlayed(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 30 * ONE_DAY;
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const BASIC_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

interface Identity {
  kind: ItemKind;
  uri: string | null;
  trackName: string;
  artistName: string;
  albumName: string | null;
}

function extendedIdentity(row: Row): Identity | null {
  const trackName = text(row['master_metadata_track_name']);
  const artistName = text(row['master_metadata_album_artist_name']);
  if (trackName && artistName) {
    return {
      kind: 'track',
      uri: cleanUri(row['spotify_track_uri']),
      trackName,
      artistName,
      albumName: text(row['master_metadata_album_album_name']),
    };
  }
  const episodeName = text(row['episode_name']);
  const showName = text(row['episode_show_name']);
  if (episodeName && showName) {
    return {
      kind: 'episode',
      uri: cleanUri(row['spotify_episode_uri']),
      trackName: episodeName,
      artistName: showName,
      albumName: null,
    };
  }
  const chapter = text(row['audiobook_chapter_title']);
  const book = text(row['audiobook_title']);
  if (chapter && book) {
    return {
      kind: 'audiobook',
      uri: cleanUri(row['audiobook_chapter_uri']),
      trackName: chapter,
      artistName: book,
      albumName: null,
    };
  }
  return null;
}

function trackKeyFor(id: Identity): string {
  return id.uri ?? nameBasedTrackKey(id.kind, id.artistName, id.trackName);
}

function parseExtended(rows: unknown[], report: ReportBuilder, now: number): NormalizedPlay[] {
  const plays: NormalizedPlay[] = [];
  for (const row of rows) {
    report.read++;
    if (!isRow(row)) {
      report.reject('not_an_object');
      continue;
    }
    report.inspectKeys(row, EXTENDED_FIELDS);

    const rawTs = row['ts'];
    if (typeof rawTs !== 'string' || rawTs === '') {
      report.reject('missing_timestamp');
      continue;
    }
    const tsEnd = ISO_UTC.test(rawTs) ? Date.parse(rawTs) : Number.NaN;
    if (!validTimestamp(tsEnd, now)) {
      report.reject('invalid_timestamp');
      continue;
    }
    const msPlayed = row['ms_played'];
    if (!validMsPlayed(msPlayed)) {
      report.reject('invalid_ms_played');
      continue;
    }
    const id = extendedIdentity(row);
    if (!id) {
      report.reject('missing_identity');
      continue;
    }
    const play: NormalizedPlay = {
      tsEnd,
      msPlayed,
      kind: id.kind,
      trackKey: trackKeyFor(id),
      uri: id.uri,
      trackName: id.trackName,
      artistName: id.artistName,
      albumName: id.albumName,
      reasonStart: text(row['reason_start']),
      reasonEnd: text(row['reason_end']),
      shuffle: bool(row['shuffle']),
      skipped: bool(row['skipped']),
      offline: bool(row['offline']),
      incognito: bool(row['incognito_mode']),
      source: 'extended',
    };
    report.accept(play);
    plays.push(play);
  }
  return plays;
}

function parseBasic(
  rows: unknown[],
  report: ReportBuilder,
  now: number,
  podcast: boolean,
): NormalizedPlay[] {
  const plays: NormalizedPlay[] = [];
  for (const row of rows) {
    report.read++;
    if (!isRow(row)) {
      report.reject('not_an_object');
      continue;
    }
    report.inspectKeys(row, BASIC_FIELDS);

    const rawTime = row['endTime'];
    if (typeof rawTime !== 'string' || rawTime === '') {
      report.reject('missing_timestamp');
      continue;
    }
    // The basic export's endTime is UTC, minute precision ("2024-01-05 13:45").
    const m = BASIC_TIME.exec(rawTime);
    const tsEnd = m
      ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
      : Number.NaN;
    if (!validTimestamp(tsEnd, now)) {
      report.reject('invalid_timestamp');
      continue;
    }
    const msPlayed = row['msPlayed'];
    if (!validMsPlayed(msPlayed)) {
      report.reject('invalid_ms_played');
      continue;
    }
    const trackName = text(podcast ? row['episodeName'] : row['trackName']);
    const artistName = text(podcast ? row['podcastName'] : row['artistName']);
    if (!trackName || !artistName) {
      report.reject('missing_identity');
      continue;
    }
    const kind: ItemKind = podcast ? 'episode' : 'track';
    const play: NormalizedPlay = {
      tsEnd,
      msPlayed,
      kind,
      trackKey: nameBasedTrackKey(kind, artistName, trackName),
      uri: null,
      trackName,
      artistName,
      albumName: null,
      reasonStart: null,
      reasonEnd: null,
      shuffle: null,
      skipped: null,
      offline: null,
      incognito: null,
      source: 'basic',
    };
    report.accept(play);
    plays.push(play);
  }
  return plays;
}

/** Identifies the export format from the file name and the first record. */
export function detectKind(fileName: string, rows: readonly unknown[]): FileKind {
  const first = rows.find(isRow);
  if (!first) throw new ImportFileError('empty', 'O arquivo não contém registros.');
  const lower = fileName.toLowerCase();
  if ('ts' in first && 'ms_played' in first) {
    return lower.includes('video') ? 'extended_video' : 'extended_audio';
  }
  if ('endTime' in first && 'msPlayed' in first) {
    return 'podcastName' in first || lower.includes('podcast') ? 'basic_podcast' : 'basic_music';
  }
  throw new ImportFileError(
    'unrecognised_format',
    'O arquivo não parece ser uma exportação de histórico de streaming.',
  );
}

export function parseExportFile(fileName: string, json: string, now = Date.now()): ParsedFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ImportFileError('invalid_json', 'O arquivo não é um JSON válido.');
  }
  if (!Array.isArray(data)) {
    throw new ImportFileError('not_an_array', 'O arquivo não contém uma lista de reproduções.');
  }
  const kind = detectKind(fileName, data);
  const report = new ReportBuilder();
  const plays =
    kind === 'basic_music' || kind === 'basic_podcast'
      ? parseBasic(data, report, now, kind === 'basic_podcast')
      : parseExtended(data, report, now);
  return { report: report.build(fileName, kind), plays };
}
