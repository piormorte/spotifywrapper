import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { ImportProgress, ImportResult } from '../../db/library.ts';
import type { ImportLogEntry } from '../../db/queries.ts';
import { useLibrary } from '../../app/library-context.ts';
import {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatHours,
  formatInteger,
  plural,
} from '../../lib/format.ts';
import { msToHours } from '../../lib/units.ts';
import { Button } from '../../ui/Button.tsx';
import { Figure } from '../../ui/Figure.tsx';
import { ProgressBar } from '../../ui/ProgressBar.tsx';
import { Section } from '../../ui/Section.tsx';
import { ImportReport } from './ImportReport.tsx';
import { fileKindLabel } from './labels.ts';

const PHASE_LABEL: Record<ImportProgress['phase'], string> = {
  reading: 'Lendo',
  writing: 'Gravando',
  indexing: 'Organizando a biblioteca',
};

function splitFiles(list: FileList | File[]): { json: File[]; skipped: string[] } {
  const json: File[] = [];
  const skipped: string[] = [];
  for (const file of Array.from(list)) {
    if (file.name.toLowerCase().endsWith('.json')) json.push(file);
    else skipped.push(file.name);
  }
  return { json, skipped };
}

async function requestPersistence(): Promise<void> {
  try {
    if ('storage' in navigator && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Best effort: the browser may decline silently.
  }
}

export function ImportPage() {
  const { client, status, storage, summary, setSummary } = useLibrary();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<ImportLogEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = progress !== null;

  const loadLog = useCallback(async () => {
    setLog(await client.call('imports', undefined));
  }, [client]);

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    void client.call('imports', undefined).then((entries) => {
      if (lifecycle.active) setLog(entries);
    });
    return () => {
      lifecycle.active = false;
    };
  }, [status, client]);

  const runImport = useCallback(
    async (files: FileList | File[]) => {
      const { json, skipped: other } = splitFiles(files);
      setSkipped(other);
      setResult(null);
      setError(null);
      if (json.length === 0) return;
      setProgress({
        fileIndex: 0,
        fileCount: json.length,
        fileName: json[0]?.name ?? '',
        phase: 'reading',
        processed: 0,
        total: 0,
      });
      try {
        const outcome = await client.call('importFiles', json, { onProgress: setProgress });
        setResult(outcome);
        setSummary(outcome.summary);
        if (outcome.files.some((f) => f.ok && f.inserted > 0)) void requestPersistence();
        await loadLog();
      } catch {
        setError('A importação foi interrompida. Nenhum dado parcial foi perdido; tente de novo.');
      } finally {
        setProgress(null);
      }
    },
    [client, setSummary, loadLog],
  );

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void runImport(event.target.files);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!busy && event.dataTransfer.files.length > 0) void runImport(event.dataTransfer.files);
  };

  const hasData = (summary?.records ?? 0) > 0;
  const fraction =
    progress && progress.phase === 'writing' && progress.total > 0
      ? (progress.fileIndex + progress.processed / progress.total) / progress.fileCount
      : progress?.phase === 'indexing'
        ? null
        : progress
          ? progress.fileIndex / progress.fileCount
          : 0;

  return (
    <main
      className="mx-auto max-w-[920px] px-4 pt-6 pb-20 sm:px-6 lg:px-10 lg:pt-8"
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header>
        <h1 className="font-display text-display font-semibold">Importar dados</h1>
        <p className="mt-3 max-w-[60ch] text-body text-text-2">
          Os arquivos são lidos e guardados somente neste dispositivo. Nada é enviado para a
          internet.
        </p>
      </header>

      {storage && !storage.persistent && (
        <p role="alert" className="mt-8 max-w-[60ch] text-callout text-critical">
          {storage.reason === 'unavailable'
            ? 'O armazenamento local está em uso por outra aba do Liner. Feche as outras abas e recarregue; até lá, nada do que for importado aqui será salvo.'
            : 'Este navegador não oferece armazenamento local persistente. Os dados importados serão perdidos ao fechar a página.'}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="mt-8 text-callout text-critical">
          Não foi possível iniciar o banco de dados local. Recarregue a página.
        </p>
      )}

      {hasData && summary && (
        <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3">
          <Figure
            label="Reproduções registradas"
            value={formatInteger(summary.registeredPlays)}
            note={`${formatInteger(summary.streams)} streams de 30 s ou mais`}
          />
          <Figure
            label="Tempo ouvido"
            value={formatHours(msToHours(summary.msPlayed))}
            unit="h"
            note={`${formatInteger(summary.tracks)} faixas · ${formatInteger(summary.artists)} artistas`}
          />
          {summary.firstPlay !== null && summary.lastPlay !== null && (
            <Figure
              label="Dados até"
              value={formatDateShort(summary.lastPlay)}
              note={`Desde ${formatDate(summary.firstPlay)}`}
            />
          )}
        </dl>
      )}

      <div className="mt-16 space-y-16">
        <Section title="Adicionar arquivos" caption="Histórico estendido ou dados da conta (.json)">
          <div
            className={`rounded-control px-6 py-12 text-center transition-colors ${
              dragging ? 'bg-accent-soft' : 'bg-surface'
            }`}
          >
            <p className="text-body font-medium">
              {dragging ? 'Solte para importar' : 'Arraste os arquivos JSON para cá'}
            </p>
            <p className="mt-1 text-footnote text-text-2">
              Você pode selecionar vários de uma vez. Importar de novo não duplica nada.
            </p>
            <Button
              variant="primary"
              className="mt-6"
              disabled={busy || status !== 'ready'}
              onClick={() => inputRef.current?.click()}
            >
              Escolher arquivos
            </Button>
            <input
              ref={inputRef}
              id="import-files"
              type="file"
              accept=".json,application/json"
              multiple
              hidden
              onChange={onPick}
            />
          </div>

          {progress && (
            <div className="mt-8" aria-live="polite">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 text-footnote">
                <span className="min-w-0 truncate text-text-1">
                  {PHASE_LABEL[progress.phase]}
                  {progress.fileName && ` · ${progress.fileName}`}
                </span>
                <span className="numeric text-text-2">
                  {progress.phase === 'writing' &&
                    `${formatInteger(progress.processed)} de ${formatInteger(progress.total)} · `}
                  arquivo {progress.fileIndex + 1} de {progress.fileCount}
                </span>
              </div>
              <ProgressBar label="Progresso da importação" value={fraction} />
            </div>
          )}

          {skipped.length > 0 && (
            <p className="mt-6 text-footnote text-text-2">
              Ignorados (não são .json): {skipped.join(', ')}.
              {skipped.some((n) => n.toLowerCase().endsWith('.zip')) &&
                ' Extraia o .zip e selecione os arquivos JSON de dentro dele.'}
            </p>
          )}
          {error && <p className="mt-6 text-callout text-critical">{error}</p>}
          {result && (
            <div className="mt-10">
              <ImportReport result={result} />
            </div>
          )}
        </Section>

        <Section title="Como obter seus arquivos">
          <ol className="max-w-[62ch] list-decimal space-y-2 pl-5 text-callout text-text-2 marker:text-text-3">
            <li>Na sua conta Spotify, abra Privacidade da conta.</li>
            <li>
              Peça o <span className="text-text-1">Histórico de streaming estendido</span>. Ele
              cobre toda a vida da conta e pode levar até 30 dias para chegar por e-mail.
            </li>
            <li>
              Baixe o .zip, extraia e importe os arquivos{' '}
              <span className="font-mono text-footnote">Streaming_History_Audio_*.json</span>.
            </li>
            <li>
              Enquanto espera, você pode importar os{' '}
              <span className="text-text-1">dados da conta</span> (último ano, chegam mais rápido).
              Eles são substituídos automaticamente quando o histórico estendido cobrir o mesmo
              período.
            </li>
          </ol>
        </Section>

        {log.length > 0 && (
          <Section title="Importações anteriores">
            <ul className="divide-y divide-separator">
              {log.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-callout">{entry.fileName}</span>
                  <span className="text-footnote text-text-2">{fileKindLabel(entry.kind)}</span>
                  <span className="numeric w-full text-footnote text-text-3 sm:w-auto">
                    {formatDateTime(entry.createdAt)} · {plural(entry.inserted, 'nova', 'novas')}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </main>
  );
}
