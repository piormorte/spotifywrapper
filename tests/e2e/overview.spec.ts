import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'America/Sao_Paulo' });

async function importFixtures(page: Page) {
  await page.goto('/#importar');
  await expect(page.getByRole('button', { name: 'Escolher arquivos' })).toBeEnabled();
  await page
    .locator('#import-files')
    .setInputFiles([
      'tests/fixtures/Streaming_History_Audio_2023-2024_0.json',
      'tests/fixtures/StreamingHistory_music_0.json',
    ]);
  await expect(page.getByText(/novas reproduções importadas/)).toBeVisible();
}

const hero = (page: Page) => page.locator('dd .text-hero');

test('shows an empty state that leads to the import screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Visão geral' })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Importar dados' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Importar dados' })).toBeVisible();
});

test('computes the overview from imported data and switches periods', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#visao-geral');

  // 866 000 ms of music across the fixtures (see tests/fixtures).
  await expect(hero(page)).toHaveText('14');
  const figure = (label: string) =>
    page.locator('dt.eyebrow', { hasText: new RegExp(`^${label}$`) }).locator('..');
  await expect(figure('Streams')).toContainText('5');
  await expect(figure('Reproduções registradas')).toContainText('6');
  await expect(page.getByRole('list', { name: 'Artistas mais ouvidos' })).toContainText(
    'Halden Vale',
  );
  await expect(page.getByText('Como calculamos')).toBeVisible();

  const periods = page.getByRole('radiogroup', { name: 'Período' });
  await periods.getByRole('radio').nth(4).click(); // 30 days
  await expect(hero(page)).toHaveText('4');

  await periods.getByRole('radio').nth(5).click(); // custom dates
  await page.locator('#period-start').fill('2024-01-02');
  await page.locator('#period-end').fill('2024-01-02');
  await expect(hero(page)).toHaveText('3');
  await expect(page.getByText(/2 jan\. 2024 – 2 jan\. 2024 · 1 dia/)).toBeVisible();
});

test('changing the time zone moves plays between days', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#visao-geral');
  await page.getByRole('radiogroup', { name: 'Período' }).getByRole('radio').nth(5).click();
  await page.locator('#period-start').fill('2023-12-31');
  await page.locator('#period-end').fill('2023-12-31');
  // 2023-12-31T23:59Z is 20:59 on Dec 31 in São Paulo: 215 000 ms ≈ 4 min.
  await expect(hero(page)).toHaveText('4');

  await page.goto('/#ajustes');
  await page.locator('#time-zone').selectOption('Asia/Tokyo');
  await expect(page.getByText('Recalculando…')).toBeHidden();
  await page.goto('/#visao-geral');
  // In Tokyo the same play falls on Jan 1; Dec 31 is now outside the data.
  await expect(page.getByText(/1 jan\. 2024 –/)).toBeVisible();
});

test('unbuilt destinations are plain text, never dead links or buttons', async ({ page }) => {
  await page.goto('/#visao-geral');
  const nav = page.getByRole('navigation', { name: 'Principal' }).first();
  for (const link of await nav.getByRole('link').all()) {
    await expect(link).toHaveAttribute('href', /^#[a-z-]+$/);
  }
  await expect(nav.getByRole('button')).toHaveCount(0);
});
