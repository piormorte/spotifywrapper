# Design system — proposta da Etapa 1

> Status: **aguardando aprovação visual.** Nenhuma tela funcional será construída antes dela.

Referência viva: `npm run dev` → `http://127.0.0.1:5173/#/` (referência) e `#/exemplo` (tela de exemplo).
Todos os nomes e números exibidos nessas páginas são **fictícios** (`src/design/demo-data.ts`).

## Princípios

1. **Os números são os protagonistas.** Cada tela tem um número principal, e a hierarquia vem da tipografia, não de caixas.
2. **Um destaque por vez.** A cor de destaque marca um único dado por tela. Os gráficos secundários ficam em cinza.
3. **Sem contêineres.** Nada de cards, sombras ou gradientes. As seções se separam por espaço e, quando necessário, por uma linha fina (`--separator`).
4. **Sempre com unidade.** Todo número diz o que mede: streams, reproduções registradas ou tempo ouvido.

## Tokens (`src/ui/tokens.css`)

| Token       | Claro   | Escuro  | Uso                                                  |
| ----------- | ------- | ------- | ---------------------------------------------------- |
| `--bg`      | #FFFFFF | #000000 | Fundo                                                |
| `--surface` | #F5F5F7 | #0D0D0E | Superfícies raras                                    |
| `--fill-1`  | #E8E8ED | #1C1C1E | Controles                                            |
| `--fill-2`  | #D2D2D7 | #2C2C2E | Séries de gráfico                                    |
| `--text-1`  | #1D1D1F | #F5F5F7 | Texto primário                                       |
| `--text-2`  | #6E6E73 | #A1A1A6 | Texto secundário (≥ 5:1)                             |
| `--text-3`  | #737378 | #7C7C82 | Texto terciário (≥ 4,5:1)                            |
| `--accent`  | #08784F | #47D7A0 | Destaque: jade próprio, distinto do verde da Spotify |

O tema segue `prefers-color-scheme` e pode ser forçado com `data-theme="light|dark"` em `<html>`.

## Tipografia

- **Interface:** SF Pro (Apple) → Segoe UI Variable (Windows) → Inter (incluída no app) → system-ui.
- **Exportações:** sempre Inter, para o resultado ser idêntico em qualquer plataforma.
- **Escala:** `hero`, `display`, `title-1..3`, `body`, `callout`, `footnote`, `caption`. Não se usam tamanhos avulsos.
- **Números:** pesos leves (200–300) e algarismos tabulares (utilitário `numeric`).

## Espaço, raios e movimento

- Escala de espaço de 4 pt: 4, 8, 12, 16, 24, 32, 48, 64, 96 e 128.
- Raios apenas em controles: `--radius-control` (8 px) e `--radius-pill`.
- Movimento:
  - `--ease-standard` em transições de 200 ms.
  - `--ease-emphasized` em deslocamentos (300–500 ms), como o marcador do controle segmentado e as barras dos gráficos.
  - Todo movimento respeita `prefers-reduced-motion`.

## Componentes

| Componente          | Arquivo                       | Notas                                                                                           |
| ------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Controle segmentado | `src/ui/SegmentedControl.tsx` | Semântica de radiogroup, navegação pelas setas, marcador animado, rótulos curtos no celular     |
| Estatística         | `src/ui/Figure.tsx`           | Rótulo, número, unidade e nota, sem contêiner                                                   |
| Ranking             | `src/ui/RankList.tsx`         | Linhas separadas por linha fina, posição em cinza terciário                                     |
| Gráfico de barras   | `src/ui/BarChart.tsx`         | Uma série, sem grade; a geometria vem de `src/charts/bars.ts`, compartilhada com as exportações |
| Shell               | `src/app/Shell.tsx`           | Barra lateral só com texto no desktop e barra inferior só com texto no celular                  |

## Exportações

São peças editoriais desenhadas diretamente em Canvas, com Inter, sem capas (`src/design/StorySpecimen.tsx`). O motor de exportação definitivo é construído na Etapa 7.

## Pontos em aberto para aprovação

1. **Nome:** Liner (proposta), Cadence ou Encarte.
2. **Idioma da interface:** português com nomes de seções em português ("Visão geral", "Linha do tempo"). O nome "Export Studio" foi mantido como está.
3. **Cor de destaque:** jade #47D7A0 / #08784F.
