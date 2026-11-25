import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { readGlobalHeaders } from './config/headers.ts';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // An update waits for the user's consent (see src/app/UpdateNotice.tsx).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        id: '/',
        name: 'Liner',
        short_name: 'Liner',
        description: 'Estatísticas do seu histórico de escuta, calculadas no seu dispositivo.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/#visao-geral',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        categories: ['music', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Importar dados', url: '/#importar' },
          { name: 'Export Studio', url: '/#exportar' },
        ],
      },
      workbox: {
        // Precache only the app itself. There is no runtime caching: the app
        // makes no network requests, and listening data lives in OPFS, never
        // in Cache Storage.
        globPatterns: ['**/*.{html,js,css,wasm,woff2,png,svg,webmanifest}'],
        globIgnores: ['**/*.map'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
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
