# Design system — Liner

> Status: **Etapa 2 — redesign premium, 26/11/2026**, pedido pelo dono do projeto. Substitui a
> direção da Etapa 1 (25/11/2026: tipografia sem contêineres). Toda tela nova segue este documento.

Referência viva: `npm run dev` → `#referencia`. Os nomes e números dessa página são **fictícios**
(`src/design/demo-data.ts`).

## Conceito

Uma plataforma pessoal de inteligência musical que transforma o histórico em uma experiência
visual. Referências: a hierarquia e o espaçamento do iOS/macOS, a apresentação de dados do Apple
Music Replay, a precisão do Linear e a personalidade de uma retrospectiva anual. Não é um clone de
nenhum serviço de streaming nem um painel administrativo.

## Princípios

1. **Os números são os protagonistas.** A hierarquia vem da tipografia e do tamanho dos cartões:
   um número herói por tela, alguns grandes, vários pequenos.
2. **Um destaque por vez.** O jade marca um único dado por bloco (a barra maior, o artista nº 1).
   Todo o resto é neutro.
3. **Superfícies discretas.** Cartões com uma linha fina, sombra quase imperceptível e um brilho
   de 1 px no topo. Sem glassmorphism em tudo: a translucidez fica só na barra superior e na barra
   de abas.
4. **Sempre com unidade e com base.** Todo número diz o que mede; toda frase interpretativa mostra
   os números em que se apoia.
5. **Nada inventado.** Sem capa, foto ou gênero nos arquivos, o app gera artes tipográficas e
   omite o que não existe (ver `docs/METRICS.md`, "Capas e imagens").

## Tokens (`src/ui/tokens.css`)

O escuro é o design principal; o claro é uma tradução fiel. O tema segue `prefers-color-scheme`
e pode ser forçado em Ajustes (`data-theme` em `<html>`).

| Token           | Escuro                 | Claro            | Uso                                            |
| --------------- | ---------------------- | ---------------- | ---------------------------------------------- |
| `--bg`          | #09090B                | #F5F5F7          | Fundo da janela                                |
| `--bg-2`        | #111114                | #ECECF0          | Barra lateral                                  |
| `--surface`     | #18181B                | #FFFFFF          | Cartões                                        |
| `--surface-2`   | #202024                | #FFFFFF          | Cartões em hover, tooltips, avisos             |
| `--fill-1`      | #202024                | #E8E8ED          | Controles, trilhas de barras                   |
| `--fill-2`      | #34343A                | #D2D2D7          | Séries neutras dos gráficos                    |
| `--border`      | rgba(255,255,255,0.08) | rgba(0,0,0,0.08) | Linha fina dos cartões e separadores           |
| `--text-1`      | #F5F5F7                | #1D1D1F          | Texto primário                                 |
| `--text-2`      | #A1A1AA                | #55555C          | Texto secundário                               |
| `--text-3`      | #8B8B94                | #66666D          | Texto terciário (≥ 4,5:1 também sobre cartões) |
| `--accent`      | #47D7A0                | #08784F          | Destaque: jade próprio, não o verde da Spotify |
| `--accent-glow` | jade a 7%              | jade a 10%       | Iluminação ambiente dos painéis herói          |

- O terciário proposto no briefing (#71717A) ficava abaixo de 4,5:1 sobre `--surface-2`; por isso
  #8B8B94, que mantém a mesma temperatura.
- A Retrospectiva usa sempre o palco escuro (`.stage-dark`), em qualquer tema.

## Tipografia

- **Interface:** SF Pro (Apple) → Segoe UI Variable (Windows) → Inter (incluída) → system-ui.
- **Exportações:** sempre Inter.
- **Escala:** `mega` (Retrospectiva), `hero`, `display`, `title-1..3`, `body`, `callout`,
  `footnote`, `caption`. Sem tamanhos avulsos.
- **Números:** pesos leves (200–300) e algarismos tabulares (`numeric`). Nomes em destaque usam o
  peso semibold do display.

## Espaço, raios e sombras

- Espaço em múltiplos de 4 px. Calhas de página: 16 px (celular), 24 px (tablet), 40 px (desktop).
- Raios por hierarquia: controles 10 px (`rounded-control`), linhas e blocos 12 px
  (`rounded-tile`), cartões 16 px (`rounded-card`), painéis herói 20 px (`rounded-panel`),
  pílulas. Artes de capa: 18% do lado; artistas: círculo.
- Sombras: `shadow-card` (linha fina + 1 px) e `shadow-raised` (hover, tooltips, avisos).

## Movimento

- `--ease-out` em entradas (320–520 ms), `--ease-emphasized` em deslocamentos (marcador do
  controle segmentado, barras), `--ease-standard` em cor e opacidade (200 ms).
- **Entradas:** `.route-enter` na troca de tela; `.enter` com `--i` para escalonar cartões e
  listas (55 ms por item); `.fade` para conteúdo que chega depois.
- **Hover:** cartões interativos sobem 2 px e ganham `shadow-raised`; gráficos mostram tooltip.
- **Carregamento:** esqueletos com brilho suave (`.skeleton`, `ScreenSkeleton`).
- **Movimento reduzido** (`prefers-reduced-motion`, por exemplo "Efeitos de animação" desligado
  no Windows ou "Reduzir movimento" no macOS/iOS):
  - fades **continuam**, curtos (200 ms) e simultâneos, porque comunicam mudança de estado;
  - todo deslocamento some: `--motion-distance` e `--motion-scale` viram 0 e 1;
  - transições de posição ou tamanho marcadas com `.motion-move` ficam instantâneas;
  - flutuação das capas (`.motion-drift`) e contagens animadas são desligadas (o número final
    aparece direto).

## Navegação

| Contexto          | Forma                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Desktop (≥ 1024)  | Barra lateral translúcida com ícones Lucide, grupos "Insights" e "Biblioteca", recolhível |
| Tablet (768–1023) | Trilho só com ícones (nome como rótulo acessível e dica)                                  |
| Celular (< 768)   | Barra de abas estilo iOS: Início, Música, Retrospectiva, Histórico, Mais                  |

A barra superior mostra a saudação (que vira o título da tela ao rolar), o período ativo, Ajustes
e o avatar. O nome exibido é opcional e fica no banco local (Ajustes → Perfil).

## Componentes

| Componente          | Arquivo                       | Notas                                                                       |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| Cartão              | `card`, `card-interactive`    | Utilitários em `src/app/global.css`                                         |
| Estatística         | `src/ui/StatTile.tsx`         | Tamanhos herói, grande e pequeno; ícone, nota e comparação opcional         |
| Figura              | `src/ui/Figure.tsx`           | Número sem cartão, para grades densas (Análises, Linha do tempo)            |
| Arte de capa        | `src/ui/Cover.tsx`            | Iniciais, título ou vazia; quadrada ou circular; decorativa (`aria-hidden`) |
| Seção               | `src/ui/Section.tsx`          | Título, legenda, ação ("Ver todos") e cartão                                |
| Ranking             | `src/ui/RankList.tsx`         | Biblioteca: posição, arte, título, subtítulo, métrica                       |
| Barras horizontais  | `src/ui/ShareBars.tsx`        | Composição percentual (partes do dia)                                       |
| Gráfico de barras   | `src/ui/BarChart.tsx`         | Uma série, sem grade, tooltip; geometria de `src/charts/bars.ts`            |
| Controle segmentado | `src/ui/SegmentedControl.tsx` | Radiogroup, setas, marcador animado                                         |
| Botões              | `src/ui/Button.tsx`           | Primário monocromático, secundário, fantasma, destrutivo; `LinkButton`      |
| Esqueleto           | `src/ui/Skeleton.tsx`         | Blocos de carregamento                                                      |
| Shell               | `src/app/Shell.tsx`           | Barra lateral, trilho, barra superior e barra de abas                       |

## Telas

- **Visão geral:** painel herói "Sua música, sua história." com mosaico de capas e a frase de
  identidade; grade de estatísticas com pesos diferentes; artistas em grade assimétrica (o nº 1
  ocupa 2 × 2); faixas como biblioteca; ritmo do dia; capas dos álbuns; evolução no tempo.
- **Sua música:** biblioteca visual do período (parede de álbuns, retratos de artistas, faixas em
  duas colunas).
- **Retrospectiva:** sete slides em tela cheia (abertura, tempo, artista nº 1, trilha sonora,
  gosto musical, personalidade, resumo). Setas, Espaço, Home/End e Esc no teclado; toque nas
  laterais ou deslize no celular; barra de progresso clicável; o resumo leva ao Export Studio.
- **Gêneros:** não existe tela de gêneros: os arquivos não trazem essa informação. O gosto é
  medido pela variedade de artistas.

## Exportações

O Export Studio (`#exportar`) desenha peças em Canvas (`src/export/`), sem React e sem capturas
de tela. A unidade de design é 1 u = 1 px no lado menor de 1080. Formatos: Stories 1080 × 1920,
Quadrado 1080 × 1080, X 1200 × 675, tamanho livre (600–4000 px) e PDF A4 de 4 páginas. Sempre
Inter; um destaque (o período, em jade).

## Acessibilidade

- Todas as telas, incluindo Sua música e Retrospectiva, passam no axe-core (WCAG 2.2 AA) nos
  dois temas, em desktop e celular (`tests/e2e/a11y.spec.ts`).
- "Pular para o conteúdo" no primeiro Tab; ao trocar de tela, o foco vai para o h1.
- Artes de capa são decorativas; o nome sempre aparece em texto.
- Na Retrospectiva, só o slide atual fica acessível (os outros são `inert`), a posição é
  anunciada (`aria-live`) e números animados têm o valor final para leitores de tela.
