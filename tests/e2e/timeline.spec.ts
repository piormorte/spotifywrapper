import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'UTC' });

/** Two calendar years of synthetic plays; the second ends on June 30. */
function syntheticExport(): Buffer {
  const rows = [];
  for (const [year, lastMonth] of [
    [2023, 12],
    [2024, 6],
  ] as const) {
    for (let month = 1; month <= lastMonth; month++) {
      for (let day = 1; day <= 28; day += 3) {
        rows.push({
          ts: `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T21:00:00Z`,
          ms_played: 200_000,
          master_metadata_track_name: `Song ${String(month)}`,
          master_metadata_album_artist_name: year === 2023 ? 'Artist One' : 'Artist Two',
          master_metadata_album_album_name: 'Record',
          spotify_track_uri: `spotify:track:${String(year * 100 + month).padStart(22, '0')}`,
          reason_end: 'trackdone',
        });
      }
    }
  }
  return Buffer.from(JSON.stringify(rows));
}

test('shows activity, the weekly heatmap, yearly leaders and a like-for-like comparison', async ({
  page,
}) => {
  await page.goto('/#importar');
  await expect(page.getByRole('button', { name: 'Escolher arquivos' })).toBeEnabled();
  await page.locator('#import-files').setInputFiles({
    name: 'Streaming_History_Audio_timeline.json',
    mimeType: 'application/json',
    buffer: syntheticExport(),
  });
  await expect(page.getByText(/novas reproduções importadas/)).toBeVisible();

  await page.goto('/#linha-do-tempo');
  await expect(page.getByRole('heading', { level: 1, name: 'Linha do tempo' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Atividade por mês/ })).toBeVisible();

  await page
    .getByRole('radiogroup', { name: 'Agrupar por' })
    .getByRole('radio', { name: 'Semana' })
    .click();
  await expect(page.getByRole('img', { name: /Atividade por semana/ })).toBeVisible();

  await expect(page.getByText(/Mais ativo: .*, 21h/)).toBeVisible();

  const leaders = page
    .getByRole('heading', { name: 'Artista de cada ano' })
    .locator('xpath=ancestor::section[1]');
  await expect(leaders).toContainText('2023');
  await expect(leaders).toContainText('Artist One');
  await expect(leaders).toContainText('Artist Two');

  // 2024 ends in June: both years are compared from Jan 1 to Jun 28.
  const table = page.getByRole('table', { name: /Comparação entre 2023 e 2024/ });
  await expect(page.getByRole('radio', { name: '1 jan – 28 jun' })).toBeChecked();
  const streams = table.getByRole('row', { name: /^Streams/ });
  await expect(streams).toContainText('60');
  await expect(streams).toContainText('0%');

  await page.getByRole('radio', { name: 'Ano inteiro' }).click();
  await expect(streams).toContainText('120');
  await expect(streams).toContainText('−50%');
});
