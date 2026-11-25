import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { readGlobalHeaders } from './config/headers.ts';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
    headers: readGlobalHeaders('public/_headers'),
  },
  test: {
    include: ['src/**/*.test.ts', 'config/**/*.test.ts'],
    testTimeout: 20_000,
    environment: 'node',
  },
});
