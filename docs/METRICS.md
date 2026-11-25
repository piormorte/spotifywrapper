# Métricas — definições

Todas as estatísticas são calculadas somente a partir dos arquivos exportados pelo usuário,
dentro do dispositivo. As definições abaixo são as do código (`src/lib/units.ts`,
`src/stats/`), cobertas por testes com valores calculados à mão
(`src/stats/overview.test.ts`).

## Unidades básicas

| Termo                     | Definição                                                 |
| ------------------------- | --------------------------------------------------------- |
| **Reprodução registrada** | Registro de música com `ms_played > 0`.                   |
| **Stream**                | Registro de música com `ms_played ≥ 30 000` (30 s).       |
| **Tempo ouvido**          | Soma de `ms_played`.                                      |
| **Música**                | Itens do tipo faixa. Podcasts e audiolivros nunca entram. |
| **Momento da reprodução** | O fim da reprodução (`ts` da exportação), não o início.   |

Registros com `ms_played = 0` ficam guardados, mas não entram em nenhuma contagem.

## Tempo local e fuso horário

- Os arquivos registram o fim de cada reprodução em UTC.
- Cada reprodução recebe um horário local (`plays.local_end`) no fuso escolhido em Ajustes
  (padrão: o do dispositivo), calculado com as regras de horário de verão da época.
- "Dia" e "hora do dia" são sempre locais. Trocar o fuso recalcula todos os horários locais.
- Viagens não são detectadas: as estatísticas por hora refletem o fuso escolhido.

## Períodos

- **Todo o período:** do primeiro ao último dia com reprodução de música.
- **Ano:** de 1º de janeiro até o último dia com dados, no ano desse último dia.
- **12 meses / 6 meses:** os 12 (ou 6) meses de calendário que terminam no último dia com dados.
- **30 dias:** os 30 dias que terminam no último dia com dados.
- **Datas:** intervalo escolhido, com início e fim incluídos.

Os períodos predefinidos **terminam no último dia com dados, não hoje**, porque a exportação
sempre chega com atraso. Eles também nunca começam antes do primeiro dia com dados; por isso a
média diária não é diluída por dias anteriores à conta.

## Visão geral

| Métrica                              | Definição                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Tempo ouvido                         | Soma de `ms_played` no período, mostrada em minutos; horas = min ÷ 60; dias de reprodução contínua = h ÷ 24. |
| Streams                              | Quantidade de streams no período.                                                                            |
| Reproduções registradas              | Quantidade de reproduções registradas no período.                                                            |
| Faixas / Artistas / Álbuns           | Itens diferentes com pelo menos uma reprodução registrada no período.                                        |
| Média diária                         | Tempo ouvido ÷ dias de calendário do período (inclui dias sem escuta).                                       |
| Dias com escuta                      | Dias do período com tempo ouvido maior que zero.                                                             |
| Mais ouvidos (artista, faixa, álbum) | Ordenados por streams; empate → maior tempo ouvido → nome em ordem alfabética.                               |
| Dia de pico                          | Dia com maior tempo ouvido; em empate, o mais antigo.                                                        |
| Ao longo do tempo                    | Tempo ouvido por ano (períodos acima de 2 anos), por mês (acima de 62 dias) ou por dia; destaca o maior.     |
| Hora do dia                          | Parcela do tempo ouvido em cada hora local (0–23).                                                           |

## Rankings (Faixas, Artistas, Álbuns)

| Coluna / opção                | Definição                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Streams / Reproduções / Tempo | Como na Visão geral, somados no período escolhido.                                  |
| Ordenar por Streams           | Streams; empate → tempo ouvido → nome.                                              |
| Ordenar por Reproduções       | Reproduções registradas; empate → tempo ouvido → nome.                              |
| Ordenar por Tempo             | Tempo ouvido; empate → streams → nome.                                              |
| Faixas (artistas, álbuns)     | Faixas diferentes com reprodução registrada no período.                             |
| Primeira / Última             | Primeira e última reprodução registrada **em todo o histórico**, não só no período. |
| Itens listados                | Todos os itens com pelo menos uma reprodução registrada no período.                 |
| Faixas mais ouvidas do álbum  | As 5 faixas do álbum com mais streams no período (empate → tempo ouvido → nome).    |

Faixas sem álbum na exportação aparecem em Faixas e Artistas, mas não em Álbuns. A soma dos
streams e do tempo de todas as faixas é igual aos totais da Visão geral (coberto por teste).

## Linha do tempo

| Elemento            | Definição                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atividade           | Tempo ouvido (ou streams) por ano, mês, semana ou dia; todos os intervalos do período aparecem, inclusive os vazios.                                                                                                |
| Semana              | Semana ISO: começa na segunda-feira; a chave é a data da segunda.                                                                                                                                                   |
| Dia                 | Disponível para períodos de até 2 anos; acima disso, a série é mostrada por semana.                                                                                                                                 |
| Quando você ouve    | Tempo ouvido por dia da semana × hora local. A intensidade usa escala de raiz quadrada para que horas pouco ativas continuem visíveis.                                                                              |
| Mais ativo          | Célula (dia da semana, hora) com maior tempo ouvido no período.                                                                                                                                                     |
| Artista de cada ano | Artista com mais streams em cada ano civil com dados (empate → tempo ouvido → nome), com sua parcela dos streams do ano. Usa todo o histórico, não o período.                                                       |
| Comparar anos       | As métricas da Visão geral calculadas para cada ano. Variação = (B − A) ÷ A; não é mostrada quando A é zero.                                                                                                        |
| Mesmo intervalo     | Quando os dados terminam antes de 31/12, os dois anos são comparados de 1º de janeiro até o mesmo dia e mês do último dado (29/02 vira 28/02 em anos não bissextos). "Ano inteiro" compara os anos civis completos. |
| Artistas em comum   | Artistas com reprodução registrada nos dois anos; "só em A" e "só em B" são os demais.                                                                                                                              |

## Histórico

Lista cada reprodução registrada (inclusive as de menos de 30 s), da mais recente para a mais
antiga, na hora local. A busca procura faixa, artista e álbum por prefixo de palavra, sem
diferenciar maiúsculas e acentos. Reproduções com 0 s não aparecem.

### Identidade de artistas e álbuns

- O artista é o artista principal registrado na exportação. Participações não aparecem nos arquivos.
- Artistas com nomes que diferem só em maiúsculas ou largura de caracteres são o mesmo artista.
- Um álbum é identificado por artista + título.

## Desempenho de referência

Medido com 520 mil registros sintéticos (`npm run test:load`), no mesmo SQLite WASM do app:
Visão geral de todo o período em ~0,7 s; últimos 30 dias em ~30 ms; troca de fuso em ~1,5 s.
