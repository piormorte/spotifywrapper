import { useEffect, useRef, useState } from 'react';
import { saveFile } from '../../app/download.ts';
import { useLibrary } from '../../app/library-context.ts';
import type { BackupInfo } from '../../db/backup.ts';
import { LibraryError } from '../../db/client.ts';
import type { RestoreMode, RestoreResult } from '../../db/library.ts';
import { formatDate, formatDateTime, formatInteger, plural } from '../../lib/format.ts';
import { Button } from '../../ui/Button.tsx';
import { Section } from '../../ui/Section.tsx';
import { SegmentedControl } from '../../ui/SegmentedControl.tsx';

const MODES = [
  { value: 'merge', label: 'Mesclar' },
  { value: 'replace', label: 'Substituir' },
] as const satisfies readonly { value: RestoreMode; label: string }[];

const MODE_HELP: Record<RestoreMode, string> = {
  merge: 'Adiciona as reproduções do backup às atuais. O que já existe não é duplicado.',
  replace:
    'Troca todos os dados atuais pelos do backup. Uma cópia do estado atual fica guardada neste dispositivo.',
};

function backupFileName(now: number): string {
  return `liner-backup-${new Date(now).toISOString().slice(0, 10)}.sqlite`;
}

export function BackupSection() {
  const { client, status, setSummary, summary } = useLibrary();
  const restoreInput = useRef<HTMLInputElement>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [backupState, setBackupState] = useState<'idle' | 'working' | 'saved' | 'error'>('idle');
  const [saved, setSaved] = useState<BackupInfo | null>(null);

  const [candidate, setCandidate] = useState<{
    bytes: Uint8Array;
    name: string;
    info: BackupInfo;
  } | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [confirming, setConfirming] = useState(false);
  const [restoreState, setRestoreState] = useState<'idle' | 'checking' | 'working'>('idle');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restored, setRestored] = useState<RestoreResult | null>(null);

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    void client.call('getSetting', 'lastBackupAt').then((value) => {
      if (lifecycle.active) setLastBackup(value ? Number(value) : null);
    });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status]);

  const makeBackup = async () => {
    setBackupState('working');
    try {
      const { bytes, info } = await client.call('backup', undefined);
      const done = await saveFile(bytes, backupFileName(info.createdAt), 'application/vnd.sqlite3');
      setSaved(info);
      setLastBackup(info.createdAt);
      setBackupState(done ? 'saved' : 'idle');
    } catch {
      setBackupState('error');
    }
  };

  const pickBackup = async (file: File | undefined) => {
    setCandidate(null);
    setRestored(null);
    setRestoreError(null);
    setConfirming(false);
    if (!file) return;
    setRestoreState('checking');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = await client.call('inspectBackup', bytes.slice());
      setCandidate({ bytes, name: file.name, info });
    } catch (error) {
      setRestoreError(
        error instanceof LibraryError ? error.message : 'Não foi possível ler o arquivo.',
      );
    } finally {
      setRestoreState('idle');
    }
  };

  const restore = async () => {
    if (!candidate) return;
    if (mode === 'replace' && !confirming) {
      setConfirming(true);
      return;
    }
    setRestoreState('working');
    setRestoreError(null);
    try {
      const result = await client.call('restore', { bytes: candidate.bytes.slice(), mode });
      setRestored(result);
      setSummary(result.summary);
      setCandidate(null);
    } catch (error) {
      setRestoreError(
        error instanceof LibraryError ? error.message : 'A restauração falhou. Nada foi alterado.',
      );
    } finally {
      setRestoreState('idle');
      setConfirming(false);
    }
  };

  const hasData = (summary?.records ?? 0) > 0 || (summary?.spokenWordPlays ?? 0) > 0;

  return (
    <>
      <Section
        title="Backup"
        caption={lastBackup ? `Último: ${formatDateTime(lastBackup)}` : 'Nenhum backup feito'}
      >
        <p className="max-w-[60ch] text-callout text-text-2">
          Um único arquivo com todo o histórico, as importações e os ajustes, verificado com
          SHA-256. Guarde-o fora deste dispositivo.
        </p>
        <Button
          variant="primary"
          className="mt-6"
          disabled={status !== 'ready' || backupState === 'working' || !hasData}
          onClick={() => void makeBackup()}
        >
          {backupState === 'working' ? 'Preparando…' : 'Fazer backup'}
        </Button>
        <div aria-live="polite" className="mt-4 text-footnote text-text-2">
          {backupState === 'saved' && saved && (
            <p>
              Backup salvo: {plural(saved.counts.plays, 'registro', 'registros')}. Verificação{' '}
              <span className="font-mono">{saved.contentHash.slice(0, 12)}</span>.
            </p>
          )}
          {backupState === 'error' && (
            <p className="text-critical">Não foi possível criar o backup. Tente de novo.</p>
          )}
        </div>
      </Section>

      <Section title="Restaurar">
        <p className="max-w-[60ch] text-callout text-text-2">
          Escolha um arquivo de backup do Liner. Ele é verificado por inteiro antes de qualquer
          alteração.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button
            disabled={status !== 'ready' || restoreState !== 'idle'}
            onClick={() => restoreInput.current?.click()}
          >
            Escolher backup…
          </Button>
          {candidate && (
            <span className="min-w-0 truncate text-footnote text-text-2">{candidate.name}</span>
          )}
          <input
            ref={restoreInput}
            id="restore-file"
            type="file"
            accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3,application/octet-stream"
            hidden
            onChange={(e) => {
              void pickBackup(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        {restoreState === 'checking' && (
          <p className="mt-4 text-footnote text-text-2">Verificando o backup…</p>
        )}
        {restoreError && (
          <p role="alert" className="mt-4 text-callout text-critical">
            {restoreError}
          </p>
        )}

        {candidate && (
          <div className="mt-8">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-callout sm:grid-cols-3">
              <div>
                <dt className="text-footnote text-text-2">Criado em</dt>
                <dd>{formatDateTime(candidate.info.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-footnote text-text-2">Registros</dt>
                <dd className="numeric">{formatInteger(candidate.info.counts.plays)}</dd>
              </div>
              {candidate.info.firstPlay !== null && candidate.info.lastPlay !== null && (
                <div>
                  <dt className="text-footnote text-text-2">Período</dt>
                  <dd>
                    {formatDate(candidate.info.firstPlay)} – {formatDate(candidate.info.lastPlay)}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-4 text-footnote text-text-3">
              Verificado: estrutura, contagens e conteúdo conferem. Versão{' '}
              {candidate.info.appVersion}.
            </p>

            <div className="mt-8">
              <SegmentedControl
                label="Modo de restauração"
                segments={MODES}
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setConfirming(false);
                }}
              />
              <p className="mt-3 max-w-[60ch] text-footnote text-text-2">{MODE_HELP[mode]}</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {confirming ? (
                <>
                  <Button
                    variant="destructive"
                    disabled={restoreState === 'working'}
                    onClick={() => void restore()}
                  >
                    {restoreState === 'working' ? 'Restaurando…' : 'Substituir todos os dados'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setConfirming(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  disabled={restoreState === 'working'}
                  onClick={() => void restore()}
                >
                  {restoreState === 'working' ? 'Restaurando…' : 'Restaurar'}
                </Button>
              )}
            </div>
          </div>
        )}

        {restored && (
          <p aria-live="polite" className="mt-6 text-callout">
            {restored.mode === 'replace'
              ? `Dados substituídos pelo backup: ${plural(restored.inserted, 'registro', 'registros')}.`
              : `Backup mesclado: ${plural(restored.inserted, 'registro novo', 'registros novos')}, ${formatInteger(restored.duplicates)} já existiam.`}
          </p>
        )}
      </Section>
    </>
  );
}
