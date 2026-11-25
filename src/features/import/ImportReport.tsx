import type { FileOutcome, ImportResult } from '../../db/library.ts';
import type { RejectionReason } from '../../importer/types.ts';
import { formatDate, formatInteger, plural } from '../../lib/format.ts';
import { REJECTION_LABEL, fileKindLabel } from './labels.ts';

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-footnote text-text-2">{label}</dt>
      <dd className="numeric text-title-3 font-light">{formatInteger(value)}</dd>
    </div>
  );
}

function FileResult({ outcome }: { outcome: FileOutcome }) {
  if (!outcome.ok) {
    return (
      <li className="py-5">
        <p className="truncate text-callout font-medium">{outcome.fileName}</p>
        <p className="mt-1 text-footnote text-critical">{outcome.error.message}</p>
      </li>
    );
  }
  const { report } = outcome;
  const rejected = Object.entries(report.rejected) as [RejectionReason, number][];
  const rejectedTotal = rejected.reduce((sum, [, n]) => sum + n, 0);

  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="min-w-0 truncate text-callout font-medium">{outcome.fileName}</p>
        <p className="text-footnote text-text-2">{fileKindLabel(report.kind)}</p>
      </div>
      {report.minTs !== null && report.maxTs !== null && (
        <p className="mt-0.5 text-footnote text-text-3">
          {formatDate(report.minTs)} – {formatDate(report.maxTs)}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Count label="Registros lidos" value={report.read} />
        <Count label="Novos" value={outcome.inserted} />
        <Count label="Já existiam" value={outcome.duplicates} />
        <Count label="Rejeitados" value={rejectedTotal} />
      </dl>

      <div className="mt-4 space-y-1.5 text-footnote text-text-2">
        {outcome.seenBefore && <p>Este arquivo já tinha sido importado. Nada foi duplicado.</p>}
        {outcome.covered > 0 && (
          <p>
            {formatInteger(outcome.covered)} registros ignorados: o histórico estendido já cobre
            esse período.
          </p>
        )}
        {report.zeroLength > 0 && (
          <p>
            {formatInteger(report.zeroLength)} registros com 0 s foram guardados, mas não contam
            como reprodução.
          </p>
        )}
        {rejected.length > 0 && (
          <ul className="space-y-0.5">
            {rejected.map(([reason, n]) => (
              <li key={reason}>
                <span className="numeric">{formatInteger(n)}</span> · {REJECTION_LABEL[reason]}
              </li>
            ))}
          </ul>
        )}
        {report.discardedFields.length > 0 && (
          <p>
            Dados pessoais descartados antes de salvar:{' '}
            <span className="font-mono text-text-3">{report.discardedFields.join(', ')}</span>
          </p>
        )}
        {report.unknownFields.length > 0 && (
          <p>
            Campos não reconhecidos, ignorados:{' '}
            <span className="font-mono text-text-3">{report.unknownFields.join(', ')}</span>
          </p>
        )}
      </div>
    </li>
  );
}

export function ImportReport({ result }: { result: ImportResult }) {
  const inserted = result.files.reduce((sum, f) => sum + (f.ok ? f.inserted : 0), 0);
  const failed = result.files.filter((f) => !f.ok).length;
  return (
    <div aria-live="polite">
      <p className="text-callout">
        {inserted > 0
          ? `${plural(inserted, 'nova reprodução importada', 'novas reproduções importadas')}.`
          : 'Nenhuma reprodução nova.'}
        {failed > 0 &&
          ` ${failed === 1 ? '1 arquivo não pôde' : `${failed} arquivos não puderam`} ser lido${failed === 1 ? '' : 's'}.`}
      </p>
      {result.superseded > 0 && (
        <p className="mt-1 text-footnote text-text-2">
          {plural(
            result.superseded,
            'reprodução dos dados da conta foi substituída',
            'reproduções dos dados da conta foram substituídas',
          )}{' '}
          pelo histórico estendido, que cobre o mesmo período.
        </p>
      )}
      <ul className="mt-2 divide-y divide-separator">
        {result.files.map((outcome, i) => (
          <FileResult key={`${outcome.fileName}-${i}`} outcome={outcome} />
        ))}
      </ul>
    </div>
  );
}
