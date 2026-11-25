# Planejamento — Liner

Revisão 3 · 25/11/2026 · Direção aprovada: **v1 local-first, sem Spotify Web API**

> Nome do produto: **Liner** (aprovado na Etapa 1). Ele não contém "Spotify" (ver §2.4).
> O nome do repositório (`spotifywrapper`) é provisório.
> Etapa 1 aprovada em 25/11/2026: ver `docs/DESIGN.md`.

---

## 1. Decisões aprovadas

| Área           | Decisão                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Produto        | Dashboard completa do histórico musical vitalício, de uso pessoal                                                            |
| Fonte de dados | **Somente arquivos exportados pelo próprio usuário** (Extended Streaming History; pacote básico como fonte complementar)     |
| Rede           | **Nenhuma chamada externa na v1.** Sem OAuth, sem Client ID, sem Spotify Web API, sem scraping, sem busca externa de imagens |
| UI             | React 19 + TypeScript (strict) + Vite                                                                                        |
| Estilo         | Tailwind CSS v4 com tokens em variáveis CSS (claro/escuro)                                                                   |
| Banco          | SQLite WASM (`@sqlite.org/sqlite-wasm`), VFS `opfs-sahpool`, em Web Worker dedicado                                          |
| Busca          | SQLite FTS5 (histórico pesquisável)                                                                                          |
| Gráficos       | SVG próprio + módulos `d3-scale` / `d3-shape` / `d3-time`                                                                    |
| Exportação     | Canvas 2D desenhado diretamente; PDF via `pdf-lib`                                                                           |
| Hospedagem     | Cloudflare Pages (HTTPS estático)                                                                                            |
| Testes         | Vitest (unidades e cálculos) + Playwright (e2e e regressão visual das exportações)                                           |

---

## 2. Base de conformidade

### 2.1 Por que não usar a Web API

- A Spotify Developer Policy proíbe analisar o conteúdo ou o serviço da Spotify, "including without limitation, creating new or derived listenership metrics". Também proíbe benchmarking, estatísticas de uso e criação de perfis de usuários. A numeração da seção (II.13 ou III.13) ainda precisa ser confirmada na página oficial.
- Os Developer Terms definem _Spotify Content_ como qualquer conteúdo ou dado disponibilizado "through the Spotify Platform, Spotify Service **or by Spotify**". Também restringem guardar ou compilar esse conteúdo e proíbem armazená-lo indefinidamente.
- Um app que usa a Web API é um SDA e fica sujeito a esses termos **como um todo**. Isso colocaria em risco justamente a função principal do produto, que é gerar estatísticas derivadas.
- Uso pessoal e processamento local **não** foram tratados como exceções.

### 2.2 Base da v1

- O app não usa a Spotify Platform (APIs, SDKs, Widgets). Por isso não se enquadra como SDA.
- Os dados processados são **dados pessoais do próprio usuário**, obtidos pelo direito de acesso e portabilidade (GDPR arts. 15 e 20; LGPD art. 18, II e V) e entregues por ele ao app no próprio dispositivo.
- Nenhum dado sai do dispositivo. Não há servidor nem telemetria.

### 2.3 Riscos que permanecem

- A Spotify pode interpretar a expressão "or by Spotify" de forma ampla. Probabilidade baixa sem relação de desenvolvedor, mas não é zero.
- Os Termos de Uso dos usuários proíbem crawling, scraping e uso para treinar IA. O app não faz nenhuma dessas coisas.
- **Antes de qualquer distribuição pública:** revisão jurídica e, se possível, esclarecimento por escrito da Spotify.

### 2.4 Marca

- "Spotify" não aparece no nome nem no ícone do produto. O app não usa o logo nem o verde da Spotify como identidade visual.
- A cor de destaque é um jade próprio (#47D7A0 / #08784F), aprovado na Etapa 1.
- Pode ser usada uma referência descritiva, como "Funciona com os arquivos exportados da sua conta Spotify".
- Links `https://open.spotify.com/track/{id}` montados a partir da URI do próprio histórico são permitidos. São só URLs, e o app não faz nenhuma requisição a elas.

---

## 3. Fontes de dados

### 3.1 Extended Streaming History (fonte principal)

São os arquivos `Streaming_History_Audio_*.json` (e `Streaming_History_Video_*.json`), arrays JSON. Campos usados:

| Campo                                                                                  | Uso                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------ |
| `ts`                                                                                   | Fim da reprodução, em UTC (ISO 8601) |
| `ms_played`                                                                            | Tempo reproduzido, em milissegundos  |
| `master_metadata_track_name`                                                           | Nome da faixa                        |
| `master_metadata_album_artist_name`                                                    | Artista                              |
| `master_metadata_album_album_name`                                                     | Álbum                                |
| `spotify_track_uri`                                                                    | Identidade da faixa                  |
| `episode_name`, `episode_show_name`, `spotify_episode_uri`                             | Podcasts (separados)                 |
| `audiobook_title`, `audiobook_uri`, `audiobook_chapter_title`, `audiobook_chapter_uri` | Audiolivros (separados)              |
| `reason_start`, `reason_end`                                                           | Motivo de início e fim               |
| `shuffle`, `skipped`, `offline`, `incognito_mode`                                      | Contexto da reprodução               |

**Campos descartados na leitura, antes de chegar ao banco:** `ip_addr`, `ip_addr_decrypted`, `conn_country`, `platform`, `user_agent_decrypted`, `username` e `offline_timestamp`.

### 3.2 Pacote básico "Account data" (complementar)

São os arquivos `StreamingHistory_music_*.json` e `StreamingHistory_podcast_*.json`, com `endTime` (UTC, precisão de minuto, conforme a documentação da Spotify), `artistName`/`trackName` (ou `podcastName`/`episodeName`) e `msPlayed`. Cobrem cerca de 1 ano, não têm URI e chegam mais rápido que o Extended.

- Servem para cobrir o período depois da última exportação Extended.
- Ficam marcados com `source = 'basic'`.
- **O Extended é a fonte de autoridade no período que ele cobre** (até o seu último registro):
  - um registro básico dentro desse período não é gravado (aparece no relatório como "ignorado: o histórico estendido já cobre esse período");
  - registros básicos já gravados são removidos quando um Extended novo passa a cobri-los;
  - um registro Extended idêntico a um básico (mesma hora, faixa e duração) assume a linha, com `source` e detalhes do Extended.
- A faixa é ligada pelo nome do artista e da faixa (sem diferenciar maiúsculas) a uma faixa já conhecida, preferindo a que tem URI.

### 3.3 O que não existe sem a API e como cada caso é tratado

| Ausência                              | Como o app lida                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Capas e imagens                       | Identidade **tipográfica**. Sem placeholders decorativos                                                |
| Gêneros                               | A seção de gêneros não existe na v1. Nenhuma métrica depende de gênero                                  |
| Duração da faixa                      | Não é necessária: completa ou interrompida é definida por `reason_end` (§4)                             |
| ID de artista e participações         | Artista identificado pelo nome normalizado (o histórico só traz o artista principal)                    |
| Dados posteriores à exportação        | "Dados até {data}" visível em todo o app, lembrete para nova exportação, pacote básico como complemento |
| Rankings e "tocando agora" da Spotify | Fora do escopo                                                                                          |

---

## 4. Definições de reprodução

Todas são **constantes fixas**, para que os resultados possam ser reproduzidos.

| Termo na UI                 | Definição                                     |
| --------------------------- | --------------------------------------------- |
| **Reproduções registradas** | Registro válido de música com `ms_played > 0` |
| **Streams (≥ 30 s)**        | Registro com `ms_played ≥ 30 000`             |
| **Tempo ouvido**            | Σ `ms_played`                                 |
| **Completa**                | `reason_end = 'trackdone'`                    |
| **Interrompida**            | Registrada e `reason_end ≠ 'trackdone'`       |
| **Pulo**                    | `skipped = true` (quando o campo existe)      |

- Registros com `ms_played = 0` são guardados com uma marca e não entram em nenhuma contagem. Aparecem no relatório da importação.
- Registros do pacote básico não têm `reason_end`, então entram nas contagens mas não na taxa de reproduções completas. A interface mostra quantos são.
- Podcasts e audiolivros ficam de fora das estatísticas de música e têm uma seção própria, simples.
- **Fuso horário:** `ts` está em UTC. Hora do dia, dia da semana e "dia" usam o fuso escolhido pelo usuário (padrão: o fuso do dispositivo). O fuso é uma configuração persistente e entra no cálculo de forma determinística.

---

## 5. Importação

1. São aceitos vários `.json` ao mesmo tempo. O `.zip` original entra numa etapa posterior, se não exigir dependência pesada (por enquanto o app pede para extrair).
2. A leitura roda no **worker do banco**, um arquivo por vez (memória limitada ao maior arquivo). A validação é feita registro a registro, por um esquema escrito à mão, e cada motivo de rejeição tem um código: `not_an_object`, `missing_timestamp`, `invalid_timestamp` (inválida, anterior a 2008 ou no futuro), `invalid_ms_played`, `missing_identity`.
3. **Normalização:**
   - `ts` vira época em milissegundos (UTC).
   - Nomes passam por NFC, `trim` e colapso de espaços.
   - `track_key` = URI ou, quando não há URI, `name:<tipo>:` + hash de artista e título normalizados.
   - `artist_key` e `album_key` vêm de nomes normalizados (NFKC + minúsculas).
   - Uma faixa vista primeiro sem URI adota a URI quando ela aparece depois (sem duplicar a faixa).
4. **Deduplicação** pela chave natural `(ts_end, track_id, ms_played)` com `INSERT OR IGNORE`. Reimportar o mesmo arquivo não muda nada; o relatório avisa quando o arquivo (mesmo SHA-256) já tinha sido importado.
5. **Gravação em lotes** de 5 000 linhas por transação, enviadas ao SQLite como um único JSON (`json_each`). O progresso é informado ao app por lote.
6. **Relatório por arquivo:** registros lidos, novos, já existentes, rejeitados por motivo, registros de 0 s, dados pessoais descartados e campos não reconhecidos.
7. Depois de importar: remoção de reproduções básicas cobertas pelo Extended, limpeza do catálogo sem reproduções e reconstrução do índice de busca (FTS5).
8. Cada importação fica registrada no log `imports`: nome do arquivo, SHA-256, tipo, contagens, relatório e data.
9. Depois da primeira importação com dados novos, o app pede ao navegador armazenamento persistente (`navigator.storage.persist()`).

**Desempenho medido** (Node, dados sintéticos, `npm run test:load`): 520 mil registros em 33 arquivos importados em ~10 s; reimportação idempotente em ~8 s; busca em ~40 ms; backup de 53 MB em ~8 s; restauração em ~9 s.

---

## 6. Modelo de dados (esquema v1)

Definição completa em `src/db/schema.ts` (migrações numeradas).

```sql
artists(id, artist_key UNIQUE, name)
albums(id, album_key UNIQUE, name, artist_id)
tracks(id, track_key UNIQUE, kind, uri, name, name_key, artist_id, album_id)
  -- kind: 'track' | 'episode' | 'audiobook' (podcasts e audiolivros no mesmo
  --        catálogo, sempre fora das estatísticas de música)
plays(id, ts_end, ms_played, track_id, source, import_id, reason_start,
      reason_end, shuffle, skipped, offline, incognito)
  UNIQUE(ts_end, track_id, ms_played); INDEX(track_id, ts_end)
imports(id, file_name, file_sha256, kind, created_at, inserted, duplicates, report_json)
settings(key, value)                 -- tema, data do último backup, (fuso na Etapa 3)
search_fts USING fts5(track, artist, album)  -- contentless, sem acentos
PRAGMA application_id = 'LINR', PRAGMA user_version = 1
```

Tabelas auxiliares para estatísticas (por dia local, por exemplo) serão definidas na Etapa 3, junto com as métricas que as usam.

---

## 7. Funcionalidades da v1

- **Overview:** tempo total (minutos, horas, dias equivalentes), reproduções registradas, streams, faixas, artistas e álbuns distintos, artista, faixa e álbum mais ouvidos, dia de pico, média diária. Períodos: All Time, This Year, Last 12 Months, Last 6 Months, Last 30 Days e Custom.
- **Histórico pesquisável:** busca de texto em faixa, artista e álbum (FTS5), filtros por período, fonte e completa/interrompida, e lista virtualizada.
- **Top Tracks, Artists, Albums:** Top 10/25/50/100/todos; ordenação por streams, reproduções ou tempo; primeira e última reprodução; faixas distintas por artista; faixas mais ouvidas de cada álbum.
- **Artistas ao longo do tempo:** dominante por ano, evolução do ranking, artistas que pararam de aparecer, descobertas.
- **Timeline:** ano, mês, semana, dia e hora; mapa de calor de dia × hora; comparação entre dois períodos.
- **Advanced Analytics:** streak, dia de pico, faixa mais repetida, sessão mais longa, audição de madrugada, lealdade, descoberta, diversidade, média mensal e hora mais ativa. A definição matemática de cada uma fica em `docs/METRICS.md`.
- **Music Personality:** observações acompanhadas do número em que se baseiam, nunca afirmações categóricas.
- **Export Studio:** os templates do plano, nos formatos 1080×1920, 1080×1080, 1200×675, personalizado e PDF. Peças **tipográficas e editoriais**, sem capas.
- **PWA:** instalável, funciona offline, dados persistentes.
- **Backup e restauração** completos (§8).

---

## 8. Backup e restauração

- O backup é o banco **inteiro** num único arquivo `.sqlite`, compactado com `VACUUM`, com uma tabela `backup_meta` contendo formato, versões do app e do esquema, data, contagens por tabela e **SHA-256 do conteúdo lógico** (todas as reproduções com os nomes resolvidos, em ordem canônica, sem IDs internos).
- **Como salvar:** janela nativa de salvar (File System Access API) onde existir; download comum como alternativa.
- **Como restaurar:**
  1. Validação completa antes de qualquer alteração: cabeçalho SQLite, `application_id`, versão do esquema (não pode ser mais nova que a do app), `integrity_check`, contagens e hash. Cada falha tem uma mensagem própria.
  2. Cópia de segurança do banco atual guardada no OPFS antes de mudar qualquer coisa.
  3. Modo **substituir** (troca o arquivo do banco) ou **mesclar** (reinsere as reproduções do backup pelo mesmo caminho da importação, sem duplicar).
- **Testes:** ida e volta com hash idêntico, mesclagem sem duplicatas, cópia de segurança, rejeição de arquivo não SQLite, de outro app, sem `backup_meta`, adulterado e de versão mais nova — sempre sem alterar os dados atuais. O teste ponta a ponta faz backup, apaga, restaura e compara no navegador real.

---

## 9. Arquitetura modular e extensões futuras

```
importer ──► db (worker) ◄── stats ◄── features (UI) ──► export
                 ▲
                 └── backup
```

**Regras de dependência**, garantidas pelo ESLint com `no-restricted-imports`:

- `importer/`, `db/`, `stats/` e `export/` **não importam React** nem `features/`.
- `stats/` só depende de `db/` (a interface `HistoryStore`) e de `lib/`.
- `features/` não acessa o SQLite diretamente: passa sempre por `HistoryStore`.

**Ponto de extensão documentado, mas não implementado:**

- Se um dia houver uma fonte externa de metadados, como imagens, ela entraria como um módulo `integrations/<nome>/` atrás de uma interface (`ArtworkProvider`). Esse módulo seria proibido de alimentar `stats/` e teria tabelas próprias.
- Cada integração exigirá uma avaliação de conformidade própria **antes** de ser implementada.
- Na v1 esse diretório não existe.

**Perfis:** um arquivo de banco por perfil no OPFS, previsto e não implementado.

---

## 10. Estrutura de pastas

```
src/
  app/          shell, rotas, providers
  ui/           design system (tokens, tipografia, primitivos) — Etapa 1
  features/     telas — somente após a aprovação visual
  importer/     parsers, validação, normalização (puro)
  db/           worker SQLite, esquema, migrações, HistoryStore, backup
  stats/        métricas puras + SQL
  charts/       primitivos SVG (UI e exportação)
  export/       renderizadores Canvas, PDF
  lib/          utilitários puros (tempo, unidades, formatação)
  workers/      entrypoints dos workers
  pwa/          service worker, instalação
tests/
  e2e/          Playwright
  fixtures/     dados sintéticos — somente para testes
docs/
  PLANNING.md   este documento
  METRICS.md    definições matemáticas (Etapa 3)
public/
  _headers      CSP e headers de segurança (Cloudflare Pages)
```

---

## 11. Segurança e privacidade

- **CSP:** `default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`.
  - `connect-src 'self'` garante, no próprio navegador, que nenhuma requisição externa é feita.
- Sem telemetria, sem logs com dados de reprodução e sem dados em `localStorage`. O banco fica só no OPFS.
- O service worker guarda em cache apenas os arquivos do app, nunca dados do usuário.
- `navigator.storage.persist()` é pedido depois da primeira importação.

---

## 12. Riscos

| Risco                                        | Nível       | O que reduz o risco                                                                   |
| -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| Interpretação ampla de "Spotify Content"     | Baixo–médio | Nenhum uso da Platform, dados pessoais do usuário, revisão jurídica antes de publicar |
| Mudança no formato da exportação             | Baixo       | Validação tolerante e relatório de campos desconhecidos                               |
| Artistas homônimos e variações de grafia     | Médio       | Normalização; mesclagem manual de artistas numa etapa futura                          |
| OPFS no Safari iOS (apagamento após 7 dias)  | Médio       | `storage.persist()`, recomendar instalar o PWA, backup                                |
| Desempenho com mais de 1 milhão de registros | Médio       | Worker, lotes, tabelas auxiliares, índices, testes de carga com dados sintéticos      |
| Fuso horário e viagens                       | Baixo       | Fuso configurável; métricas por hora rotuladas como baseadas no fuso escolhido        |
| Defasagem dos dados                          | Médio       | "Dados até", pacote básico, lembrete de nova exportação                               |

---

## 13. Roadmap

| Etapa                                | Entregas                                                                                                                                                                                                                      | Critério de pronto                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **0. Base**                          | Vite + React + TS strict, Tailwind v4, ESLint (regras de fronteira) + Prettier, Vitest, Playwright, CI (GitHub Actions), `_headers`/CSP, estrutura e docs                                                                     | CI verde: lint, typecheck, unit, build, e2e                                                       |
| **1. Identidade visual**             | Nome do produto, tokens claro/escuro, tipografia (pilha do sistema + Inter), grid, movimento, primitivos, shell responsivo, página de referência e uma tela de exemplo **com dados de demonstração explicitamente rotulados** | ✅ **Aprovada em 25/11/2026**                                                                     |
| **2. Banco, importação e backup** ✅ | Worker SQLite, esquema v1, migrações, parsers Extended e básico, validação, deduplicação, progresso, relatório, FTS5, backup e restauração                                                                                    | Mais de 500 mil registros sem travar a interface; reimportação idempotente; ida e volta do backup |
| **3. Estatísticas + Overview**       | `stats/`, `METRICS.md`, seletor de período, Overview                                                                                                                                                                          | Cada métrica com teste e explicação                                                               |
| **4. Histórico e rankings**          | Busca, filtros, Top Tracks/Artists/Albums, lista virtualizada                                                                                                                                                                 | Desempenho com mais de 30 mil faixas                                                              |
| **5. Timeline e comparações**        | Ano, mês, semana, dia e hora, mapa de calor, período A×B                                                                                                                                                                      | —                                                                                                 |
| **6. Advanced e Personality**        | Métricas e textos de observação                                                                                                                                                                                               | Testes com dados sintéticos                                                                       |
| **7. Export Studio**                 | Motor Canvas, templates, formatos, PDF                                                                                                                                                                                        | Regressão visual dos PNG                                                                          |
| **8. PWA completo**                  | Manifest, ícones, splash, uso offline, instalação                                                                                                                                                                             | Instalação ok em Windows, Android e iOS                                                           |
| **9. Acabamento**                    | Acessibilidade, movimento, revisão de desempenho e segurança                                                                                                                                                                  | —                                                                                                 |

---

## 14. Pendências de verificação

O acesso a `developer.spotify.com` estava bloqueado no ambiente de planejamento. Faltam conferir na página oficial:

- A numeração e o texto completo da cláusula de análise na Developer Policy.
- O texto completo da definição de "Spotify Content" e de "SDA" nos Developer Terms.

### Fontes

- https://developer.spotify.com/policy
- https://developer.spotify.com/terms
- https://developer.spotify.com/documentation/embeds/terms
- https://www.spotify.com/uk/legal/privacy-policy/
- https://support.spotify.com/us/article/understanding-your-data/
