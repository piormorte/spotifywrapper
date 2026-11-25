import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Module boundaries (docs/PLANNING.md §9).
 * The data core (importer, db, stats, export, charts, lib) is framework-free
 * and must never depend on the UI layers.
 */
const UI_LAYERS = String.raw`(^|/)(app|ui|features)(/|$)`;
const REACT = String.raw`^(react|react-dom)(/.*)?$`;

const restrict = (...patterns) => ['error', { patterns }];
const noUi = { regex: UI_LAYERS, message: 'The data core must not depend on UI layers.' };
const noReact = { regex: REACT, message: 'The data core must stay framework-free.' };

/** v1 makes no network requests (docs/PLANNING.md §1, §11). */
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
  name,
  message: 'v1 is fully offline: no network requests are allowed.',
}));
const STORAGE_GLOBALS = ['localStorage', 'sessionStorage'].map((name) => ({
  name,
  message: 'User data lives only in the SQLite database (OPFS).',
}));

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...STORAGE_GLOBALS],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },

  {
    files: ['src/{importer,db,stats,export,charts,workers}/**/*.ts'],
    rules: { 'no-restricted-imports': restrict(noUi, noReact) },
  },
  {
    files: ['src/stats/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(noUi, noReact, {
        regex: String.raw`(^|/)(importer|export|charts|workers)(/|$)`,
        message: 'stats/ may depend only on db/ (HistoryStore) and lib/.',
      }),
    },
  },
  {
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(noUi, noReact, {
        regex: String.raw`^\.\./`,
        message: 'lib/ holds leaf utilities and must not import other modules.',
      }),
    },
  },

  {
    files: ['*.{js,ts}', 'config/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
