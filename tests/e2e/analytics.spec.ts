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

test('analytics show defined metrics with their explanations', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#analises');
  await expect(page.getByRole('heading', { level: 1, name: 'Análises' })).toBeVisible();
  for (const section of [
    'Constância',
    'Sessões',
    'Repetição',
    'Horários',
    'Artistas',
    'Descoberta',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: section })).toBeVisible();
  }
  await expect(page.getByText('Nova sessão após mais de 15 min sem música')).toBeVisible();
  await expect(page.getByText(/entropia de Shannon normalizada/)).toBeVisible();
  // The fixture spans weeks, not a year: no artist can have faded yet.
  await expect(page.getByText(/Nenhum artista nessa condição/)).toBeVisible();
});

test('the listening profile states observations with their basis', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#perfil');
  const observations = page.getByRole('list', { name: 'Observações' });
  await expect(observations.getByRole('listitem').first()).toBeVisible();
  await expect(observations).toContainText(/artistas/);
  await expect(page.getByText(/Gêneros musicais não aparecem/)).toBeVisible();
});
