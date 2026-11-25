# Segurança e privacidade — revisão da v1

Revisão da Etapa 9 (25/11/2026). Escopo: o app inteiro em `src/`, a configuração de build e os
headers de produção.

## Modelo

O Liner é um app estático e local. Não há servidor, conta, token, chave de API nem telemetria.
Os únicos dados são os arquivos que o próprio usuário importa, processados e guardados no
dispositivo.

## Controles

| Risco                              | Controle                                                                                                                                                                          | Verificação                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Dados saindo do dispositivo        | CSP `connect-src 'self'`. ESLint proíbe `fetch`, `XMLHttpRequest`, `WebSocket` e `EventSource` em `src/`.                                                                         | e2e: nenhuma requisição externa, sem violações de CSP                   |
| Dados pessoais da exportação       | IP, usuário, plataforma, país, agente de usuário e `offline_timestamp` são descartados na leitura, antes de qualquer gravação. O relatório lista o que foi descartado.            | Teste unitário: os valores não aparecem nos registros normalizados      |
| Dados de escuta em caches          | O service worker guarda só os arquivos do build. Não há cache em tempo de execução, e os dados ficam no OPFS.                                                                     | e2e: o Cache Storage contém apenas `/assets`, `/icons`, HTML e manifest |
| Armazenamento no navegador         | Nada é gravado em `localStorage` ou `sessionStorage` (proibido pelo ESLint). Preferências ficam no SQLite.                                                                        | Lint                                                                    |
| Injeção de SQL                     | Todos os valores entram como parâmetros. Trechos interpolados são só constantes internas (nomes de coluna, limiares) ou literais tipados (`'ASC' \| 'DESC'`).                     | Revisão de código (`grep` por interpolação em SQL)                      |
| Injeção na busca (FTS5)            | O texto digitado vira termos entre aspas, sem operadores (`toFtsQuery`).                                                                                                          | Testes unitários                                                        |
| XSS                                | O React escapa todo o texto. Não há `innerHTML`, `dangerouslySetInnerHTML` nem `eval`. CSP `script-src 'self' 'wasm-unsafe-eval'` e `object-src 'none'`.                          | `grep`, CSP                                                             |
| Arquivos maliciosos ou corrompidos | Os JSON são validados por registro, com UTF-8 estrito. Um backup só é restaurado depois de verificar cabeçalho, `application_id`, versão, `integrity_check`, contagens e SHA-256. | Testes unitários e e2e                                                  |
| Perda de dados                     | Cópia de segurança automática antes de substituir ou apagar. Apagar e substituir pedem confirmação.                                                                               | Testes unitários e e2e                                                  |
| Clickjacking                       | `frame-ancestors 'none'`.                                                                                                                                                         | Headers                                                                 |
| Logs                               | Nenhum log contém dados de escuta. O `ErrorBoundary` registra só o nome do erro.                                                                                                  | Revisão de código                                                       |

## Dependências

- **Em produção** (vão para o navegador): React, SQLite WASM, d3-scale, pdf-lib (carregado só ao
  gerar PDF), workbox-window e a fonte Inter. `npm audit --omit=dev`: 0 vulnerabilidades.
- **Só de build:** `vite-plugin-pwa` → `workbox-build` → `minimatch` tem um alerta moderado de ReDoS
  (GHSA-g3hv-75wg-m249). Ele processa apenas os padrões de arquivo do próprio projeto durante o
  build e não chega ao navegador. Será resolvido quando o `workbox-build` atualizar a dependência.

## Pontos de atenção para o futuro

- Antes de qualquer distribuição pública: revisão jurídica da relação com os termos da Spotify
  (`docs/PLANNING.md` §2).
- Se uma integração externa for adicionada, ela exige nova revisão desta tabela e a ampliação
  explícita da CSP.
