# Music Analytics (codinome)

PWA local-first para analisar o histórico musical vitalício a partir dos arquivos
**Extended Streaming History** exportados pelo próprio usuário.

- Todo o processamento acontece no dispositivo. Nenhum dado sai do navegador.
- A v1 não faz nenhuma requisição externa: sem OAuth, sem Spotify Web API, sem busca de imagens.
- Planejamento, decisões e base de conformidade: [`docs/PLANNING.md`](docs/PLANNING.md).

> Projeto independente, sem afiliação com a Spotify.

## Requisitos

- Node.js 22 (`.nvmrc`)

## Scripts

| Comando           | O que faz                                                           |
| ----------------- | ------------------------------------------------------------------- |
| `npm run dev`     | Servidor de desenvolvimento em `http://127.0.0.1:5173`              |
| `npm run build`   | Typecheck + build de produção em `dist/`                            |
| `npm run preview` | Serve `dist/` com os mesmos headers de produção (`public/_headers`) |
| `npm test`        | Testes unitários (Vitest)                                           |
| `npm run e2e`     | Testes end-to-end (Playwright, desktop e mobile)                    |
| `npm run lint`    | ESLint, incluindo as regras de fronteira entre módulos              |
| `npm run check`   | Formatação, lint, typecheck, testes e build                         |

## Deploy (Cloudflare Pages)

Conecte o repositório no painel do Cloudflare Pages com:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Variável de ambiente:** `NODE_VERSION=22`

Os headers de segurança (CSP com `connect-src 'self'`) são aplicados por `public/_headers`.
Sem um `404.html`, o Pages serve `index.html` em rotas desconhecidas (modo SPA).

## Privacidade

Nunca faça commit dos seus arquivos de exportação. O `.gitignore` já bloqueia os nomes
padrão (`Streaming_History*.json`, `StreamingHistory*.json`, `my_spotify_data*`).
Os testes usam somente dados sintéticos em `tests/fixtures/`.
