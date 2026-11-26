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

test('the overview opens with the musical identity built from real figures', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#visao-geral');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sua música, sua história.' }),
  ).toBeVisible();
  // The sentence is chosen by fixed rules and always shows its basis.
  await expect(page.getByText(/soou como .+\./)).toBeVisible();
  await expect(page.getByText(/^Com base em: /)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Álbuns mais ouvidos' })).toBeVisible();
  // Across all time there is no earlier period to compare with.
  await expect(page.getByText(/vs\. período anterior/)).toHaveCount(0);
});

test('the library shows albums, artists and tracks for the period', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#sua-musica');
  await expect(page.getByRole('heading', { level: 1, name: 'Sua música' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Artistas mais ouvidos' })).toContainText(
    'Halden Vale',
  );
  await expect(page.getByRole('list', { name: 'Faixas mais ouvidas' })).toBeVisible();
});

test('the retrospective moves with the keyboard and can be left', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#retrospectiva');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/em música/);
  const position = page.getByText(/^\d+ \/ 7$/);
  await expect(position).toHaveText('1 / 7');

  await page.keyboard.press('ArrowRight');
  await expect(position).toHaveText('2 / 7');
  // 866 000 ms of music in the fixtures ≈ 14 minutes.
  await expect(page.getByText('14 minutos')).toBeAttached();

  await page.keyboard.press('End');
  await expect(position).toHaveText('7 / 7');
  await expect(page.getByRole('link', { name: 'Criar imagem para compartilhar' })).toHaveAttribute(
    'href',
    '#exportar',
  );

  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(position).toHaveText('6 / 7');

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#visao-geral$/);
});

test('the retrospective without data leads to the import screen', async ({ page }) => {
  await page.goto('/#retrospectiva');
  await expect(page.getByRole('heading', { level: 1, name: 'Retrospectiva' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Importar dados' })).toBeVisible();
});

test('reduced motion keeps fades and drops movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#ajustes');
  const motion = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'enter';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const result = {
      name: style.animationName,
      distance: getComputedStyle(document.documentElement).getPropertyValue('--motion-distance'),
    };
    probe.remove();
    return result;
  });
  expect(motion.name).toBe('fade-in');
  expect(motion.distance.trim()).toBe('0px');
});

test('the display name greets the person and stays on the device', async ({ page }) => {
  await page.goto('/#ajustes');
  await page.locator('#display-name').fill('Ana Clara');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Nome salvo.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Perfil: Ana Clara' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Perfil: Ana Clara' })).toBeVisible();
});
