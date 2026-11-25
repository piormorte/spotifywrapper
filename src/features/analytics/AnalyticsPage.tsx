import { useEffect, useState } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import {
  formatClock,
  formatDecimal,
  formatDuration,
  formatInteger,
  formatLocalDate,
  formatLocalDateLong,
  formatLocalTime,
  formatPercent,
  plural,
} from '../../lib/format.ts';
import { MS_PER_MINUTE } from '../../lib/units.ts';
import {
  FADED_MIN_STREAMS,
  FADED_WINDOW_DAYS,
  type Analytics,
  type FadedArtist,
} from '../../stats/analytics.ts';
import { parseDayKey, type PeriodSpec } from '../../stats/period.ts';
import { Figure } from '../../ui/Figure.tsx';
import { Section } from '../../ui/Section.tsx';
import { EmptyLibrary, PageHeader } from './PageHeader.tsx';
import { usePeriodQuery } from './usePeriodQuery.ts';

function dayLabel(key: string, long = false): string {
  const ms = parseDayKey(key);
  if (ms === null) return key;
  return long ? formatLocalDateLong(ms) : formatLocalDate(ms);
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 md:grid-cols-3">{children}</dl>
  );
}

function Content({ a, faded }: { a: Analytics; faded: FadedArtist[] }) {
  const longest = a.sessions.longest;
  return (
    <div className="mt-16 space-y-20">
      <Section title="Constância">
        <Grid>
          <Figure
            label="Maior sequência"
            value={formatInteger(a.longestStreak?.days ?? 0)}
            unit={a.longestStreak?.days === 1 ? 'dia' : 'dias'}
            note={
              a.longestStreak
                ? `${dayLabel(a.longestStreak.start)} – ${dayLabel(a.longestStreak.end)}. Dias seguidos com pelo menos um stream.`
                : 'Dias seguidos com pelo menos um stream.'
            }
          />
          <Figure
            label="Sequência no fim do período"
            value={formatInteger(a.currentStreak?.days ?? 0)}
            unit={a.currentStreak?.days === 1 ? 'dia' : 'dias'}
            note="Dias seguidos com stream terminando no último dia do período."
          />
          <Figure
            label="Dia de pico"
            value={formatInteger((a.peakDay?.msPlayed ?? 0) / MS_PER_MINUTE)}
            unit="min"
            note={
              a.peakDay
                ? `${dayLabel(a.peakDay.day, true)}. Maior tempo ouvido em um dia.`
                : 'Maior tempo ouvido em um dia.'
            }
          />
        </Grid>
      </Section>

      <Section title="Sessões" caption="Nova sessão após mais de 15 min sem música">
        <Grid>
          <Figure
            label="Sessão mais longa"
            value={longest ? formatClock(longest.durationMs) : '0:00'}
            note={
              longest
                ? `${formatLocalDateLong(longest.startLocal)}, das ${formatLocalTime(longest.startLocal)} às ${formatLocalTime(longest.endLocal)} · ${plural(longest.plays, 'reprodução', 'reproduções')}.`
                : 'Sem sessões no período.'
            }
          />
          <Figure
            label="Sessões"
            value={formatInteger(a.sessions.count)}
            note="Blocos de escuta contínua no período."
          />
          <Figure
            label="Duração média"
            value={formatDuration(a.sessions.averageMs)}
            note="Do início da primeira reprodução ao fim da última, em média."
          />
        </Grid>
      </Section>

      <Section title="Repetição">
        <Grid>
          <Figure
            label="Mais repetida em um dia"
            value={a.mostReplayed ? formatInteger(a.mostReplayed.streams) : '0'}
            unit="streams"
            note={
              a.mostReplayed
                ? `“${a.mostReplayed.track}”, de ${a.mostReplayed.artist}, em ${dayLabel(a.mostReplayed.day)}.`
                : 'Mais streams de uma faixa em um único dia.'
            }
          />
          <Figure
            label="Streams por faixa"
            value={formatDecimal(a.streamsPerTrack, 1)}
            note="Streams ÷ faixas diferentes com streams no período."
          />
        </Grid>
      </Section>

      <Section title="Horários">
        <Grid>
          <Figure
            label="Hora mais ativa"
            value={a.mostActiveHour ? `${String(a.mostActiveHour.hour)}h` : '—'}
            note={
              a.mostActiveHour
                ? `${formatPercent(a.mostActiveHour.share)} do tempo ouvido nessa hora.`
                : 'Hora local com mais tempo ouvido.'
            }
          />
          <Figure
            label="Madrugada"
            value={formatPercent(a.nightShare)}
            note="Parcela do tempo ouvido entre 0h e 5h59."
          />
          <Figure
            label="Média mensal"
            value={formatDuration(a.monthlyAverageMs)}
            note="Tempo ouvido ÷ meses do período (dias ÷ 30,44)."
          />
        </Grid>
      </Section>

      <Section title="Artistas">
        <Grid>
          <Figure
            label="Lealdade"
            value={formatPercent(a.loyalty.top5Share)}
            note={`Dos streams vão para os 5 artistas mais ouvidos; ${a.loyalty.topArtist ?? '—'} sozinho tem ${formatPercent(a.loyalty.top1Share)}.`}
          />
          <Figure
            label="Diversidade"
            value={formatDecimal(a.diversity.evenness, 2)}
            note="Equilíbrio dos streams entre artistas: 0 = um só artista, 1 = todos por igual (entropia de Shannon normalizada)."
          />
          <Figure
            label="Artistas efetivos"
            value={formatInteger(a.diversity.effectiveArtists)}
            note={`Quantos artistas, ouvidos por igual, dariam a mesma diversidade. ${formatInteger(a.diversity.artists)} artistas com streams.`}
          />
        </Grid>
      </Section>

      <Section title="Descoberta" caption="Primeira reprodução em todo o histórico">
        <Grid>
          <Figure
            label="Artistas novos"
            value={formatInteger(a.discovery.newArtists)}
            note={`${formatPercent(a.discovery.newArtistShare)} dos artistas ouvidos no período apareceram pela primeira vez nele.`}
          />
          <Figure
            label="Faixas novas"
            value={formatInteger(a.discovery.newTracks)}
            note={`${formatPercent(a.discovery.newTrackShare)} das faixas ouvidas no período.`}
          />
        </Grid>
        {a.discovery.topNewArtists.length > 0 && (
          <div className="mt-10 max-w-[560px]">
            <h3 className="eyebrow mb-2">Descobertas mais ouvidas</h3>
            <ol aria-label="Artistas descobertos no período" className="divide-y divide-separator">
              {a.discovery.topNewArtists.map((artist, i) => (
                <li key={artist.id} className="flex items-baseline gap-4 py-2.5">
                  <span className="numeric w-4 text-right text-footnote text-text-3">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-callout">{artist.name}</span>
                  <span className="numeric text-footnote text-text-2">
                    {formatInteger(artist.streams)} streams · desde{' '}
                    {formatLocalDate(artist.firstPlay)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Section>

      <Section
        title="Deixaram de aparecer"
        caption={`${String(FADED_MIN_STREAMS)}+ streams antes e nenhum nos últimos ${String(FADED_WINDOW_DAYS)} dias de dados`}
      >
        {faded.length === 0 ? (
          <p className="text-footnote text-text-3">
            Nenhum artista nessa condição, ou o histórico tem menos de um ano e um dia.
          </p>
        ) : (
          <ol
            aria-label="Artistas que deixaram de aparecer"
            className="max-w-[560px] divide-y divide-separator"
          >
            {faded.map((artist, i) => (
              <li key={artist.id} className="flex items-baseline gap-4 py-2.5">
                <span className="numeric w-4 text-right text-footnote text-text-3">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-callout">{artist.name}</span>
                <span className="numeric text-footnote text-text-2">
                  {formatInteger(artist.streams)} streams · última vez em{' '}
                  {formatLocalDate(artist.lastPlay)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-footnote text-text-3">
          Esta lista considera todo o histórico, não o período.
        </p>
      </Section>
    </div>
  );
}

export function AnalyticsPage({
  period,
  onPeriodChange,
}: {
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
}) {
  const { client, status, summary } = useLibrary();
  const state = usePeriodQuery('analytics', period);
  const [faded, setFaded] = useState<FadedArtist[]>([]);

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    void client.call('fadedArtists', undefined).then((result) => {
      if (lifecycle.active) setFaded(result);
    });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, summary]);

  return (
    <main className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 sm:px-8 lg:px-14 lg:pt-14">
      <PageHeader
        title="Análises"
        data={state.status === 'ready' ? state.data : null}
        period={period}
        onPeriodChange={onPeriodChange}
      />
      {state.status === 'loading' && (
        <p aria-live="polite" className="mt-16 text-callout text-text-2">
          Calculando as análises…
        </p>
      )}
      {state.status === 'empty' && <EmptyLibrary />}
      {state.status === 'error' && (
        <p role="alert" className="mt-16 text-callout text-critical">
          Não foi possível calcular as análises. Recarregue a página.
        </p>
      )}
      {state.status === 'ready' && <Content a={state.data} faded={faded} />}
    </main>
  );
}
