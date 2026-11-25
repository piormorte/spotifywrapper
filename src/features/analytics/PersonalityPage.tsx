import type { PeriodSpec } from '../../stats/period.ts';
import { THRESHOLDS } from '../../stats/personality.ts';
import { formatPercent } from '../../lib/format.ts';
import { EmptyLibrary, PageHeader } from './PageHeader.tsx';
import { usePeriodQuery } from './usePeriodQuery.ts';

export function PersonalityPage({
  period,
  onPeriodChange,
}: {
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
}) {
  const state = usePeriodQuery('personality', period);
  const data = state.status === 'ready' ? state.data : null;

  return (
    <main className="mx-auto max-w-[880px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
      <PageHeader
        title="Perfil de escuta"
        intro="Observações geradas a partir dos seus números, com a base de cada uma. Descrevem os dados; não são diagnósticos sobre você."
        data={data?.analytics ?? null}
        period={period}
        onPeriodChange={onPeriodChange}
      />
      {state.status === 'loading' && (
        <p aria-live="polite" className="mt-16 text-callout text-text-2">
          Calculando o perfil…
        </p>
      )}
      {state.status === 'empty' && <EmptyLibrary />}
      {state.status === 'error' && (
        <p role="alert" className="mt-16 text-callout text-critical">
          Não foi possível montar o perfil. Recarregue a página.
        </p>
      )}
      {data && (
        <>
          {data.observations.length === 0 ? (
            <p className="mt-16 text-callout text-text-2">Sem streams no período.</p>
          ) : (
            <ol aria-label="Observações" className="mt-16 divide-y divide-separator">
              {data.observations.map((o) => (
                <li key={o.id} className="py-8 first:pt-0">
                  <h2 className="font-display text-title-2 font-semibold">{o.title}</h2>
                  <p className="mt-2 max-w-[60ch] text-body">{o.text}</p>
                  <p className="mt-2 text-footnote text-text-3">{o.basis}</p>
                </li>
              ))}
            </ol>
          )}
          <section className="hairline mt-12 border-t pt-6 text-footnote text-text-3">
            <h2 className="eyebrow mb-3">Sobre estas observações</h2>
            <ul className="max-w-[64ch] space-y-1.5">
              <li>
                Os limites são fixos: concentração a partir de{' '}
                {formatPercent(THRESHOLDS.concentrated)} dos streams em 5 artistas, madrugada a
                partir de {formatPercent(THRESHOLDS.night)} do tempo, repetição a partir de{' '}
                {String(THRESHOLDS.repetitive)} streams por faixa, tendência a partir de{' '}
                {formatPercent(THRESHOLDS.trend)} de variação entre anos completos.
              </li>
              <li>
                Gêneros musicais não aparecem: os arquivos exportados não trazem essa informação.
              </li>
              <li>Definições completas em “Como calculamos”, na Visão geral e em Análises.</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
