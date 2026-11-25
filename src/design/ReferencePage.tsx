import { useState, type ReactNode } from 'react';
import { THEME_SEGMENTS, type ThemePreference } from '../app/theme.ts';
import { Wordmark } from '../app/Wordmark.tsx';
import { formatInteger } from '../lib/format.ts';
import { BarChart } from '../ui/BarChart.tsx';
import { Figure } from '../ui/Figure.tsx';
import { RankList } from '../ui/RankList.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { StorySpecimen } from './StorySpecimen.tsx';

/** Stage 1 visual reference: the design language presented for approval. */

const COLORS = [
  ['bg', 'Fundo', '#FFFFFF', '#000000'],
  ['surface', 'Superfície', '#F5F5F7', '#0D0D0E'],
  ['fill-1', 'Preenchimento 1 · controles', '#E8E8ED', '#1C1C1E'],
  ['fill-2', 'Preenchimento 2 · séries', '#D2D2D7', '#2C2C2E'],
  ['text-1', 'Texto primário', '#1D1D1F', '#F5F5F7'],
  ['text-2', 'Texto secundário', '#6E6E73', '#A1A1A6'],
  ['text-3', 'Texto terciário', '#737378', '#7C7C82'],
  ['accent', 'Destaque · um por tela', '#08784F', '#47D7A0'],
] as const;

const TYPE = [
  ['Hero', 'text-hero font-[250] numeric font-display', '48.213', 'Número principal da tela'],
  ['Display', 'text-display font-semibold font-display', 'Visão geral', 'Título de página'],
  ['Title 1', 'text-title-1 font-light numeric font-display', '1.284', 'Estatísticas'],
  ['Title 2', 'text-title-2 font-semibold', 'Ao longo do tempo', 'Títulos de seção'],
  ['Title 3', 'text-title-3 font-semibold', 'Mais ouvidos', 'Subseções'],
  ['Body', 'text-body', 'Texto corrido e explicações de métricas.', 'Leitura'],
  ['Callout', 'text-callout', 'Itens de lista e navegação', 'Interface'],
  ['Footnote', 'text-footnote text-text-2', 'Reproduções de 30 s ou mais', 'Notas e unidades'],
  ['Caption', 'eyebrow', 'Rótulo de estatística', 'Rótulos em versalete'],
] as const;

const SPACE = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128];

const PRINCIPLES = [
  [
    'Números como protagonistas',
    'Cada tela tem um número principal. Tipografia, não caixas, cria a hierarquia.',
  ],
  [
    'Um destaque por vez',
    'A cor de destaque marca um único dado por tela, como o maior valor de uma série. Gráficos secundários ficam em cinza.',
  ],
  [
    'Sem contêineres',
    'Nada de cards. Seções se separam por espaço e, quando necessário, por uma linha fina.',
  ],
  [
    'Sempre a unidade',
    'Todo número diz o que mede: streams, reproduções registradas ou tempo ouvido.',
  ],
] as const;

const NAMES = [
  [
    'Liner',
    'De liner notes, o texto editorial dos encartes. Curto, sóbrio, combina com a direção tipográfica.',
  ],
  ['Cadence', 'Ritmo e regularidade de escuta. Mais genérico, já usado por outros produtos.'],
  [
    'Encarte',
    'A mesma ideia de Liner, em português. Forte localmente, menos claro fora do Brasil.',
  ],
] as const;

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="hairline grid gap-8 border-t pt-8 lg:grid-cols-[200px_1fr] lg:gap-12">
      <header>
        <p className="numeric text-footnote text-text-3">{index}</p>
        <h2 className="mt-1 text-title-2 font-semibold">{title}</h2>
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function ReferencePage({
  theme,
  onThemeChange,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const [demoSegment, setDemoSegment] = useState<'a' | 'b' | 'c'>('a');
  const hours = [2, 1, 1, 0, 0, 1, 3, 6, 9, 8, 7, 7, 8, 9, 9, 10, 11, 12, 13, 14, 15, 12, 9, 5];

  return (
    <main className="mx-auto max-w-[1180px] px-4 pt-10 pb-24 sm:px-8 lg:px-14 lg:pt-16">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Wordmark className="text-title-2" />
          <p className="mt-1 text-callout text-text-2">
            Referência visual · Etapa 1 · para aprovação
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedControl
            label="Tema"
            segments={THEME_SEGMENTS}
            value={theme}
            onChange={onThemeChange}
          />
          <a href="#exemplo" className="text-callout font-medium text-accent hover:underline">
            Ver tela de exemplo
          </a>
        </div>
      </header>

      <h1 className="mt-16 max-w-[34ch] font-display text-display font-semibold">
        Uma vida de escuta, contada com precisão.
      </h1>
      <p className="mt-6 max-w-[60ch] text-body text-text-2">
        Esta página reúne a linguagem visual proposta: cor, tipografia, espaço, movimento,
        componentes e a direção das exportações. Nomes e números são fictícios e servem apenas para
        avaliação.
      </p>

      <div className="mt-24 space-y-24">
        <Section index="01" title="Princípios">
          <dl className="grid gap-10 sm:grid-cols-2">
            {PRINCIPLES.map(([title, body]) => (
              <div key={title}>
                <dt className="text-callout font-semibold">{title}</dt>
                <dd className="mt-1.5 text-callout text-text-2">{body}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section index="02" title="Cor">
          <p className="mb-8 max-w-[60ch] text-callout text-text-2">
            Preto profundo, branco e quatro cinzas. O destaque é um jade próprio, deliberadamente
            distinto do verde da Spotify, e aparece uma vez por tela. Texto atende WCAG AA nos dois
            temas.
          </p>
          <ul className="divide-y divide-separator">
            {COLORS.map(([token, role, light, dark]) => (
              <li key={token} className="flex items-center gap-5 py-3">
                <span
                  aria-hidden
                  className="hairline size-9 shrink-0 rounded-full border"
                  style={{ background: `var(--${token})` }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-callout font-medium">{role}</span>
                  <span className="block font-mono text-footnote text-text-3">--{token}</span>
                </span>
                <span className="numeric hidden text-right font-mono text-footnote text-text-2 sm:block">
                  {light} · {dark}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section index="03" title="Tipografia">
          <p className="mb-8 max-w-[60ch] text-callout text-text-2">
            SF Pro em dispositivos Apple, Segoe UI Variable no Windows e Inter nas demais
            plataformas e em todas as exportações. Números grandes em pesos leves e algarismos
            tabulares; títulos em semibold com espaçamento negativo.
          </p>
          <ul className="divide-y divide-separator">
            {TYPE.map(([name, cls, sample, use]) => (
              <li key={name} className="grid gap-2 py-5 sm:grid-cols-[120px_1fr] sm:items-baseline">
                <span className="text-footnote text-text-3">
                  {name}
                  <span className="block">{use}</span>
                </span>
                <span className={`min-w-0 truncate ${cls}`}>{sample}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section index="04" title="Espaço">
          <p className="mb-8 max-w-[60ch] text-callout text-text-2">
            Escala de 4 pt. Espaços grandes (64–128) separam seções; pequenos (4–16) agrupam rótulo,
            número e nota.
          </p>
          <ul className="space-y-3">
            {SPACE.map((s) => (
              <li key={s} className="flex items-center gap-4">
                <span className="numeric w-10 text-right text-footnote text-text-3">{s}</span>
                <span className="h-2 rounded-full bg-fill-2" style={{ width: s * 2 }} />
              </li>
            ))}
          </ul>
        </Section>

        <Section index="05" title="Componentes">
          <div className="space-y-16">
            <div>
              <h3 className="eyebrow mb-4">Controle segmentado · com movimento</h3>
              <SegmentedControl
                label="Exemplo"
                segments={[
                  { value: 'a', label: 'Streams' },
                  { value: 'b', label: 'Reproduções' },
                  { value: 'c', label: 'Tempo' },
                ]}
                value={demoSegment}
                onChange={setDemoSegment}
              />
            </div>
            <div>
              <h3 className="eyebrow mb-6">Estatísticas</h3>
              <dl className="grid grid-cols-2 gap-8 md:grid-cols-3">
                <Figure
                  label="Streams"
                  value={formatInteger(15067)}
                  note="Reproduções de 30 s ou mais"
                />
                <Figure label="Tempo ouvido" value={formatInteger(803)} unit="h" note="33,5 dias" />
                <Figure label="Sequência" value="47" unit="dias" note="Maior sequência diária" />
              </dl>
            </div>
            <div className="grid gap-12 md:grid-cols-2">
              <div>
                <h3 className="eyebrow mb-2">Ranking</h3>
                <RankList
                  label="Exemplo de ranking"
                  items={[
                    {
                      key: '1',
                      title: 'Low Tide Letters',
                      subtitle: 'Halden Vale',
                      metric: '412',
                      secondary: '27 h',
                    },
                    {
                      key: '2',
                      title: 'Cinza e Ouro',
                      subtitle: 'Lua Nascente',
                      metric: '389',
                      secondary: '24 h',
                    },
                    {
                      key: '3',
                      title: 'Paper Satellites',
                      subtitle: 'Ostrava Lights',
                      metric: '301',
                      secondary: '19 h',
                    },
                  ]}
                />
              </div>
              <div>
                <h3 className="eyebrow mb-4">Gráfico · uma série, sem grade</h3>
                <BarChart
                  title="Exemplo de distribuição por hora"
                  values={hours}
                  labels={hours.map((_, h) => `${h}h`)}
                  labelEvery={6}
                  height={150}
                  formatValue={(v) => String(v)}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section index="06" title="Exportação">
          <p className="mb-8 max-w-[60ch] text-callout text-text-2">
            Peças editoriais desenhadas diretamente em Canvas, não capturas de tela. Stories em 1080
            × 1920, com a mesma tipografia e o mesmo destaque. Sem capas na v1.
          </p>
          <div className="grid max-w-[640px] grid-cols-2 gap-6">
            <StorySpecimen variant="dark" />
            <StorySpecimen variant="light" />
          </div>
        </Section>

        <Section index="07" title="Nome">
          <p className="mb-8 max-w-[60ch] text-callout text-text-2">
            O produto precisa de nome próprio, sem “Spotify”. Proposta principal em uso nesta
            página: <strong className="font-semibold text-text-1">Liner</strong>.
          </p>
          <dl className="divide-y divide-separator">
            {NAMES.map(([name, why]) => (
              <div key={name} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
                <dt className="font-display text-title-3 font-semibold tracking-[-0.03em]">
                  {name}
                </dt>
                <dd className="text-callout text-text-2">{why}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </main>
  );
}
