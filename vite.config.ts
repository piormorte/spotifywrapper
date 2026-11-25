import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { readGlobalHeaders } from './config/headers.ts';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    environment: 'node',
  },
});
