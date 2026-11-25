import type { BackupInfo } from './backup.ts';
import type { ImportProgress, ImportResult, RestoreMode, RestoreResult } from './library.ts';
import type { HistoryPage, HistoryQuery, ImportLogEntry, LibrarySummary } from './queries.ts';
import type { Overview } from '../stats/overview.ts';
import type { PeriodSpec } from '../stats/period.ts';
import type { AlbumTrack, Ranking, RankingQuery } from '../stats/rankings.ts';

/** Messages between the UI thread and the database worker. */

export interface StorageStatus {
  /** Data survives reloads (OPFS). */
  readonly persistent: boolean;
  /** Why storage is not persistent, when it isn't. */
  readonly reason?: 'unsupported' | 'unavailable';
}

/** Operation name → [argument, result]. */
export interface LibraryOps {
  init: [undefined, StorageStatus];
  summary: [undefined, LibrarySummary];
  history: [HistoryQuery, HistoryPage];
  overview: [PeriodSpec, Overview | null];
  ranking: [RankingQuery, Ranking | null];
  albumTracks: [{ albumId: number; period: PeriodSpec }, AlbumTrack[]];
  getTimeZone: [undefined, string];
  setTimeZone: [string, LibrarySummary];
  imports: [undefined, ImportLogEntry[]];
  importFiles: [File[], ImportResult];
  backup: [undefined, { bytes: Uint8Array; info: BackupInfo }];
  inspectBackup: [Uint8Array, BackupInfo];
  restore: [{ bytes: Uint8Array; mode: RestoreMode }, RestoreResult];
  eraseAll: [undefined, LibrarySummary];
  getSetting: [string, string | null];
  setSetting: [{ key: string; value: string }, null];
}

export type OpName = keyof LibraryOps;

export interface RequestMessage<K extends OpName = OpName> {
  readonly id: number;
  readonly op: K;
  readonly arg: LibraryOps[K][0];
}

export interface SerializedError {
  readonly name: string;
  readonly code: string;
  readonly message: string;
}

export type ResponseMessage =
  | { readonly id: number; readonly kind: 'result'; readonly result: unknown }
  | { readonly id: number; readonly kind: 'error'; readonly error: SerializedError }
  | { readonly id: number; readonly kind: 'progress'; readonly progress: ImportProgress };
