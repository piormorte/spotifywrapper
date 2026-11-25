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
| `--text-2`  | #636368 | #A1A1A6 | Texto secundário (≥ 4,5:1 também sobre controles)    |
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

## Acessibilidade (Etapa 9)

- **Auditoria automática:** todas as telas passam no axe-core com as regras WCAG 2.2 AA, nos temas claro e escuro, em desktop e celular (`tests/e2e/a11y.spec.ts`).
- **Contraste:** `--text-2` claro passou a #636368 e `--critical` claro a #B80012, para manter 4,5:1 também sobre o fundo dos controles.
- **Teclado:**
  - Um botão "Pular para o conteúdo" aparece no primeiro Tab.
  - Ao trocar de tela, o foco vai para o título (h1) e o título da aba muda.
  - Controles segmentados e listas de opções usam setas, Home e End, com uma única parada de Tab.
- **Leitores de tela:**
  - Os controles abreviados no celular têm o rótulo completo como nome acessível.
  - Os gráficos têm título e um valor por barra.
  - Progresso e resultados são anunciados (`aria-live`).
- **Movimento:** tudo é desligado com `prefers-reduced-motion` (ver "Movimento e materiais").

## Movimento e materiais (inspirados no iOS, 25/11/2026)

Pedido do responsável: animações e acabamento no estilo iOS, mantendo os princípios acima (sem cards, sem gradientes, um destaque por tela).

- **Entrada das telas:** fade de 220 ms; os blocos principais sobem 14 px em cascata (40 ms entre eles, até 160 ms). Rankings entram linha a linha.
- **Números:** cada estatística conta de 0 (ou do valor anterior) até o valor final em 900 ms, com desaceleração exponencial. Datas, horários e anos aparecem direto. O último quadro é sempre o texto formatado original (`src/lib/countup.ts`).
- **Gráficos:** as barras crescem a partir da base na primeira vez e animam ao mudar.
- **Toque:** botões, itens de navegação e controles cedem para 96% ao toque e voltam com uma mola (`--ease-spring`).
- **Seleção:** o fundo do item ativo da barra lateral e o marcador do controle segmentado deslizam com mola.
- **Materiais:** a barra superior e a barra de abas do celular são translúcidas (fundo a 80% com desfoque de 20 px e saturação); onde não há desfoque, ficam sólidas.
- **Título grande:** no celular, o título da tela aparece centralizado na barra superior quando o h1 sai da vista, e a linha fina da barra só aparece nesse momento.
- **Link externo:** a tela de importação tem o botão "Pedir meus dados à Spotify", que abre a página de privacidade da conta em nova aba (`noopener noreferrer`). É só navegação: nenhum dado do app vai junto.
