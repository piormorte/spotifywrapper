# Project rules

Read `docs/PLANNING.md` before making changes. It is the source of truth for scope and decisions.

## Hard rules

- **v1 is fully offline.** No OAuth, no Client ID, no Spotify Web API, no scraping, no external
  image lookup, no telemetry. CSP enforces `connect-src 'self'`; ESLint forbids `fetch`,
  `XMLHttpRequest`, `WebSocket` and `EventSource` in `src/`.
- **Stage 1 visual approval is a mandatory gate.** Do not build functional screens in
  `src/features/` until the owner has approved the visual direction.
- **No fabricated data.** Demo data is allowed only in tests/fixtures or explicitly labelled
  design references. Never show it as real statistics.
- Play definitions are fixed constants in `src/lib/units.ts` (registered play: `ms_played > 0`;
  stream: `ms_played >= 30000`). Do not make them configurable.
- Module boundaries are enforced by ESLint (`eslint.config.js`): the data core
  (`importer`, `db`, `stats`, `export`, `charts`, `lib`) never imports React or UI layers.
- Do not use "Spotify" in the product name, icons or branding; do not use Spotify's logo or green.
- Never commit real streaming-history exports.

## Workflow

- `npm run check` must pass before committing; `npm run e2e` for UI-affecting changes.
- Every statistic needs unit tests and a plain-language definition in `docs/METRICS.md`.
