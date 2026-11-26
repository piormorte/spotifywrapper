import { ArrowRight } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { useLibrary } from '../../app/library-context.ts';
import { formatDuration, formatInteger, plural } from '../../lib/format.ts';
import type { PeriodSpec } from '../../stats/period.ts';
import type { Ranking, RankingKind } from '../../stats/rankings.ts';
import { LinkButton } from '../../ui/Button.tsx';
import { Cover } from '../../ui/Cover.tsx';
import { RankList } from '../../ui/RankList.tsx';
import { Section } from '../../ui/Section.tsx';
import { ScreenSkeleton } from '../../ui/Skeleton.tsx';
import { EmptyLibrary, LoadError, Page, PageHeader } from '../analytics/PageHeader.tsx';

/**
 * "Sua música": a visual library of the period — albums as a wall of covers,
 * artists as portraits, tracks as a two-column list. Same rankings and
 * definitions as the dedicated screens.
 */

const LIMITS: Record<RankingKind, number> = { albums: 18, artists: 12, tracks: 20 };
const KINDS: readonly RankingKind[] = ['albums', 'artists', 'tracks'];

type Data = Record<RankingKind, Ranking>;

const stagger = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

function SeeAll({ href, children }: { href: string; children: string }) {
  return (
    <LinkButton href={href} variant="ghost" className="-mr-2 px-2.5 py-1.5 text-footnote">
      {children}
      <ArrowRight aria-hidden size={14} />
    </LinkButton>
  );
}

export function LibraryPage({
  period,
  onPeriodChange,
}: {
  period: PeriodSpec;
  onPeriodChange: (spec: PeriodSpec) => void;
}) {
  const { client, status, summary } = useLibrary();
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    if (status !== 'ready') return;
    const lifecycle = { active: true };
    Promise.all(
      KINDS.map((kind) =>
        client.call('ranking', { kind, period, sort: 'streams', limit: LIMITS[kind] }),
      ),
    )
      .then(([albums, artists, tracks]) => {
        if (!lifecycle.active) return;
        if (albums && artists && tracks) {
          setData({ albums, artists, tracks });
          setState('ready');
        } else if (period.preset !== 'custom') {
          setState('empty');
        }
      })
      .catch(() => {
        if (lifecycle.active) setState('error');
      });
    return () => {
      lifecycle.active = false;
    };
  }, [client, status, period, summary]);

  const header = data?.albums ?? null;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Biblioteca"
        title="Sua música"
        data={header}
        period={period}
        onPeriodChange={onPeriodChange}
        subtitle={
          data ? (
            <p className="numeric mt-2 text-callout text-text-2">
              {plural(data.artists.total, 'artista', 'artistas')} ·{' '}
              {plural(data.albums.total, 'álbum', 'álbuns')} ·{' '}
              {plural(data.tracks.total, 'faixa', 'faixas')} com reprodução no período
            </p>
          ) : undefined
        }
      />

      {state === 'loading' && <ScreenSkeleton label="Montando sua biblioteca…" />}
      {state === 'empty' && <EmptyLibrary />}
      {state === 'error' && (
        <LoadError>Não foi possível montar a biblioteca. Recarregue a página.</LoadError>
      )}

      {state === 'ready' && data && (
        <div className="space-y-14 sm:space-y-16">
          <Section
            title="Álbuns"
            caption="Os mais ouvidos, por streams"
            surface={false}
            action={<SeeAll href="#albuns">Ranking de álbuns</SeeAll>}
          >
            {data.albums.rows.length === 0 ? (
              <p className="card p-6 text-footnote text-text-3">
                Sem informação de álbum no período.
              </p>
            ) : (
              <ol
                aria-label="Álbuns mais ouvidos"
                className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-6"
              >
                {data.albums.rows.map((album, i) => (
                  <li key={album.id} className="enter group min-w-0" style={stagger(i)}>
                    <Cover
                      name={album.name}
                      byline={album.artist}
                      variant="title"
                      className="aspect-square w-full shadow-[0_18px_36px_-20px_rgb(0_0_0/0.6)] transition-transform duration-300 ease-out group-hover:-translate-y-[calc(var(--motion-distance)*0.25)]"
                    />
                    <p className="mt-3 truncate text-callout font-medium">{album.name}</p>
                    <p className="truncate text-footnote text-text-2">{album.artist}</p>
                    <p className="numeric text-footnote text-text-3">
                      {plural(album.streams, 'stream', 'streams')}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section
            title="Artistas"
            caption="Os mais ouvidos, por streams"
            surface={false}
            action={<SeeAll href="#artistas">Ranking de artistas</SeeAll>}
          >
            <ol
              aria-label="Artistas mais ouvidos"
              className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6"
            >
              {data.artists.rows.map((artist, i) => (
                <li
                  key={artist.id}
                  className="enter flex min-w-0 flex-col items-center text-center"
                  style={stagger(i)}
                >
                  <Cover
                    name={artist.name}
                    shape="circle"
                    className="aspect-square w-full max-w-[8.5rem] shadow-[0_16px_32px_-18px_rgb(0_0_0/0.6)]"
                  />
                  <p className="mt-3 w-full truncate text-callout font-medium">{artist.name}</p>
                  <p className="numeric w-full truncate text-footnote text-text-3">
                    {formatInteger(artist.streams)} streams
                  </p>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            title="Faixas"
            caption="As mais ouvidas, por streams · tempo ouvido abaixo"
            action={<SeeAll href="#faixas">Ranking de faixas</SeeAll>}
          >
            <div className="grid gap-x-8 md:grid-cols-2">
              {[data.tracks.rows.slice(0, 10), data.tracks.rows.slice(10)].map((rows, col) =>
                rows.length > 0 ? (
                  <RankList
                    key={col}
                    label={col === 0 ? 'Faixas mais ouvidas' : 'Faixas mais ouvidas, continuação'}
                    art="square"
                    start={col * 10}
                    items={rows.map((t) => ({
                      key: String(t.id),
                      title: t.name,
                      subtitle: [t.artist, t.album].filter(Boolean).join(' · '),
                      metric: formatInteger(t.streams),
                      secondary: formatDuration(t.msPlayed),
                      cover: t.album ?? t.name,
                    }))}
                  />
                ) : null,
              )}
            </div>
          </Section>
        </div>
      )}
    </Page>
  );
}
