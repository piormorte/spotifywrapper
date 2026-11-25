import type { FileKind, RejectionReason } from '../../importer/types.ts';

export const FILE_KIND_LABEL: Record<FileKind | 'backup_merge', string> = {
  extended_audio: 'Histórico estendido · áudio',
  extended_video: 'Histórico estendido · vídeo',
  basic_music: 'Dados da conta · música',
  basic_podcast: 'Dados da conta · podcasts',
  backup_merge: 'Backup mesclado',
};

export const REJECTION_LABEL: Record<RejectionReason, string> = {
  not_an_object: 'Registro em formato inválido',
  missing_timestamp: 'Sem data e hora',
  invalid_timestamp: 'Data e hora inválidas ou fora do período possível',
  invalid_ms_played: 'Duração de reprodução inválida',
  missing_identity: 'Sem faixa, episódio ou capítulo identificável',
};

export function fileKindLabel(kind: string): string {
  return kind in FILE_KIND_LABEL ? FILE_KIND_LABEL[kind as FileKind] : kind;
}
