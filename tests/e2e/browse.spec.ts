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
      'tests/fixtures/StreamingHistory_podcast_0.json',
    ]);
  await expect(page.getByText(/novas reproduções importadas/)).toBeVisible();
}

test('ranks tracks, switches sort and limit', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#faixas');
  const list = page.getByRole('list', { name: 'Ranking de faixas' });
  await expect(list.getByRole('listitem')).toHaveCount(5);
  // Low Tide Letters: 2 streams (one Extended, one basic) — the top track.
  await expect(list.getByRole('listitem').first()).toContainText('Low Tide Letters');

  await page
    .getByRole('radiogroup', { name: 'Ordenar por' })
    .getByRole('radio', { name: /Tempo/ })
    .click();
  await expect(list.getByRole('listitem').first()).toContainText('Low Tide Letters');

  await page
    .getByRole('radiogroup', { name: 'Quantidade' })
    .getByRole('radio', { name: 'Top 10', exact: true })
    .click();
  await expect(list.getByRole('listitem')).toHaveCount(5);
});

test('ranks artists and expands an album', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#artistas');
  await expect(
    page.getByRole('list', { name: 'Ranking de artistas' }).getByRole('listitem').first(),
  ).toContainText('Halden Vale');

  await page.goto('/#albuns');
  const first = page.getByRole('list', { name: 'Ranking de álbuns' }).getByRole('listitem').first();
  await expect(first).toContainText('Northern Rooms');
  await first.getByRole('button', { name: 'Faixas mais ouvidas' }).click();
  await expect(first).toContainText('Low Tide Letters');
  await expect(first).toContainText('Night Ferry');
});

test('searches the history and separates spoken word', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#historico');
  await expect(page.getByText(/^\d+ reproduções$/)).toBeVisible();

  await page.locator('#history-search').fill('cinza');
  await expect(page.getByText('1 reprodução para “cinza”')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Lua Nascente · Madrugada Aberta');

  await page.locator('#history-search').fill('');
  await page
    .getByRole('radiogroup', { name: 'Tipo' })
    .getByRole('radio', { name: 'Podcasts' })
    .click();
  await expect(page.getByText('2 reproduções', { exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('The Quiet Hour Show');
});

test('phones reach every section through "Mais"', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.goto('/#visao-geral');
  await page
    .getByRole('navigation', { name: 'Principal' })
    .last()
    .getByRole('link', { name: 'Mais' })
    .click();
  await page
    .getByRole('navigation', { name: 'Todas as seções' })
    .getByRole('link', { name: 'Importar dados' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Importar dados' })).toBeVisible();
});
