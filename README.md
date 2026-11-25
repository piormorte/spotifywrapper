# Liner

PWA local-first para analisar o histórico musical vitalício a partir dos arquivos
**Extended Streaming History** exportados pelo próprio usuário.

- Todo o processamento acontece no dispositivo. Nenhum dado sai do navegador.
- A v1 não faz nenhuma requisição externa: sem OAuth, sem Spotify Web API, sem busca de imagens.
- Planejamento, decisões e base de conformidade: [`docs/PLANNING.md`](docs/PLANNING.md).
- Definições de todas as métricas: [`docs/METRICS.md`](docs/METRICS.md).
- Design system e acessibilidade: [`docs/DESIGN.md`](docs/DESIGN.md).
- Segurança e privacidade: [`docs/SECURITY.md`](docs/SECURITY.md).

> Projeto independente, sem afiliação com a Spotify.

## Requisitos

- Node.js 22 (`.nvmrc`)

## Scripts

| Comando             | O que faz                                                                |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run dev`       | Servidor de desenvolvimento em `http://127.0.0.1:5173`                   |
| `npm run build`     | Typecheck + build de produção em `dist/`                                 |
| `npm run preview`   | Serve `dist/` com os mesmos headers de produção (`public/_headers`)      |
| `npm test`          | Testes unitários (Vitest)                                                |
| `npm run test:load` | Teste de carga: 520 mil registros sintéticos (importação, busca, backup) |
| `npm run e2e`       | Testes end-to-end (Playwright, desktop e mobile)                         |
| `npm run lint`      | ESLint, incluindo as regras de fronteira entre módulos                   |
| `npm run check`     | Formatação, lint, typecheck, testes e build                              |

## Deploy (Cloudflare Pages)

Conecte o repositório no painel do Cloudflare Pages com:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Variável de ambiente:** `NODE_VERSION=22`

Os headers de segurança (CSP com `connect-src 'self'`) são aplicados por `public/_headers`.
Sem um `404.html`, o Pages serve `index.html` em rotas desconhecidas (modo SPA).

## PWA

- `vite-plugin-pwa` gera o manifest e o service worker (`generateSW`).
- O service worker guarda **apenas os arquivos do app**: HTML, JS, CSS, WASM, fontes e ícones. Não há cache em tempo de execução, e os dados de escuta ficam no OPFS, nunca no Cache Storage.
- Novas versões aparecem como um aviso "Atualizar". O app não recarrega sozinho.
- Ícones: edite `public/icons/icon.svg` e `icon-maskable.svg` e rode `node scripts/generate-icons.mjs`.
- `public/_headers` desativa cache longo para `sw.js` e o manifest e marca `/assets/*` como imutável.

## Privacidade

Nunca faça commit dos seus arquivos de exportação. O `.gitignore` já bloqueia os nomes
padrão (`Streaming_History*.json`, `StreamingHistory*.json`, `my_spotify_data*`).
Os testes usam somente dados sintéticos em `tests/fixtures/`.
