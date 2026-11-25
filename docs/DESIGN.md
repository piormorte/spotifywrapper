# Design system — Liner

> Status: **aprovado em 25/11/2026** (Etapa 1). Toda tela nova segue este documento.

Referência viva: `npm run dev` → `http://127.0.0.1:5173/` (referência) e `#exemplo` (tela de exemplo).
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

O Export Studio (`#exportar`) desenha peças editoriais diretamente em Canvas (`src/export/`), sem React e sem capturas de tela:

- **Unidade de design:** 1 u = 1 px no lado menor de 1080, de modo que todos os formatos escalam a partir do mesmo desenho.
- **Formatos:** Stories 1080 × 1920, Quadrado 1080 × 1080, X 1200 × 675, tamanho livre (600–4000 px) e relatório PDF de 4 páginas A4.
- **Layout:**
  - Os blocos (número principal, grade de estatísticas, ranking, barras, observações) fluem entre o cabeçalho e o rodapé.
  - Formatos largos usam duas colunas.
  - Quando falta espaço, listas anteriores encolhem antes de um bloco posterior ser descartado.
- **Cor e tipografia:** sempre Inter. Um único destaque: o período, em jade, acima do título. A barra máxima dos gráficos usa a cor do texto, não o destaque.
- **Sem capas:** a v1 não usa a Web API.

## Decisões aprovadas (25/11/2026)

1. **Nome:** Liner.
2. **Idioma da interface:** português, com seções em português ("Visão geral", "Linha do tempo"). "Export Studio" e "Streams" ficam como estão.
3. **Cor de destaque:** jade #47D7A0 (escuro) / #08784F (claro).
4. **Direção visual:** a referência (`#referencia`) e a tela de exemplo (`#exemplo`) são a base aprovada.
