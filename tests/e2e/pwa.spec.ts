import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'America/Sao_Paulo' });

test('serves an installable manifest with icons', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    name: string;
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest).toMatchObject({
    name: 'Liner',
    display: 'standalone',
    start_url: '/#visao-geral',
  });
  expect(manifest.icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const res = await request.get(`/${icon.src}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
});

test('works offline with imported data, caching only the app itself', async ({ page, context }) => {
  await page.goto('/#importar');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load is not controlled yet; reload once under the service worker.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await expect(page.getByRole('button', { name: 'Escolher arquivos' })).toBeEnabled();
  await page
    .locator('#import-files')
    .setInputFiles(['tests/fixtures/Streaming_History_Audio_2023-2024_0.json']);
  await expect(page.getByText(/novas reproduções importadas/)).toBeVisible();

  // Cache Storage holds build assets only — never listening data.
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) urls.push(new URL(req.url).pathname);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(5);
  for (const path of cached) {
    expect(path).toMatch(/^\/(assets\/|icons\/|index\.html$|manifest\.webmanifest$)/);
  }

  await context.setOffline(true);
  await page.goto('/#visao-geral');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Visão geral' })).toBeVisible();
  await expect(page.locator('dd .text-hero')).not.toHaveText('');
  await page.goto('/#faixas');
  await expect(page.getByRole('list', { name: 'Ranking de faixas' })).toContainText(
    'Low Tide Letters',
  );
  await context.setOffline(false);
});

test('settings explain how to install', async ({ page }) => {
  await page.goto('/#ajustes');
  await expect(page.getByRole('heading', { name: 'Instalar o app' })).toBeVisible();
});
