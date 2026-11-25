/** Output of the importer: one normalized playback record, free of personal data. */

export type PlaySource = 'extended' | 'basic';
export type ItemKind = 'track' | 'episode' | 'audiobook';

export interface NormalizedPlay {
  /** End of playback, epoch milliseconds (UTC). */
  readonly tsEnd: number;
  readonly msPlayed: number;
  readonly kind: ItemKind;
  /** Stable identity: the Spotify URI when present, otherwise a name-based key. */
  readonly trackKey: string;
  readonly uri: string | null;
  /** Track, episode or chapter title. */
  readonly trackName: string;
  /** Artist, show or audiobook title. */
  readonly artistName: string;
  readonly albumName: string | null;
  readonly reasonStart: string | null;
  readonly reasonEnd: string | null;
  readonly shuffle: boolean | null;
  readonly skipped: boolean | null;
  readonly offline: boolean | null;
  readonly incognito: boolean | null;
  readonly source: PlaySource;
}

export type RejectionReason =
  | 'not_an_object'
  | 'missing_timestamp'
  | 'invalid_timestamp'
  | 'invalid_ms_played'
  | 'missing_identity';

export type FileKind = 'extended_audio' | 'extended_video' | 'basic_music' | 'basic_podcast';

export interface FileReport {
  readonly fileName: string;
  readonly kind: FileKind;
  /** Records present in the file. */
  readonly read: number;
  /** Records accepted after validation (before deduplication). */
  readonly accepted: number;
  readonly rejected: Partial<Record<RejectionReason, number>>;
  /** Accepted records with ms_played = 0 (stored, never counted). */
  readonly zeroLength: number;
  /** Personal fields found in the file and discarded before storage. */
  readonly discardedFields: readonly string[];
  /** Fields this version does not recognise (signals a format change). */
  readonly unknownFields: readonly string[];
  readonly minTs: number | null;
  readonly maxTs: number | null;
}

export interface ParsedFile {
  readonly report: FileReport;
  readonly plays: readonly NormalizedPlay[];
}

export class ImportFileError extends Error {
  readonly code: 'invalid_json' | 'not_an_array' | 'unrecognised_format' | 'empty';

  constructor(
    code: 'invalid_json' | 'not_an_array' | 'unrecognised_format' | 'empty',
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = 'ImportFileError';
  }
}
