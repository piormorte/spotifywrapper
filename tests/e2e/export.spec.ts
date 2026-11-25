import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

test.use({ timezoneId: 'America/Sao_Paulo' });

async function importFixtures(page: Page) {
  await page.addInitScript(() => {
    delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });
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

async function download(page: Page, name: RegExp): Promise<{ file: string; bytes: Buffer }> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name }).click();
  const dl = await pending;
  const path = await dl.path();
  return { file: dl.suggestedFilename(), bytes: readFileSync(path) };
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): [number, number] {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('exports PNG pieces in every format with the chosen options', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#exportar');
  await expect(
    page.getByRole('img', { name: /Pré-visualização: Minha vida em escuta/ }),
  ).toBeVisible();

  let png = await download(page, /Baixar PNG/);
  expect(png.file).toMatch(/^liner-wrapped-1080x1920-.*\.png$/);
  expect(pngSize(png.bytes)).toEqual([1080, 1920]);

  const formats = page.getByRole('radiogroup', { name: 'Formato' });
  await formats.getByRole('radio', { name: 'Quadrado' }).click();
  await page.getByRole('radio', { name: 'Faixas mais ouvidas' }).click();
  png = await download(page, /Baixar PNG/);
  expect(pngSize(png.bytes)).toEqual([1080, 1080]);

  await formats.getByRole('radio', { name: 'X / Twitter' }).click();
  png = await download(page, /Baixar PNG/);
  expect(pngSize(png.bytes)).toEqual([1200, 675]);

  await formats.getByRole('radio', { name: 'Outro tamanho' }).click();
  await page.locator('#export-width').fill('800');
  await page.locator('#export-height').fill('1000');
  png = await download(page, /Baixar PNG/);
  expect(pngSize(png.bytes)).toEqual([800, 1000]);
});

test('custom pieces and titles update the preview', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#exportar');
  await page.getByRole('radio', { name: 'Minhas estatísticas' }).click();
  await page.getByLabel('Perfil de escuta').check();
  await page.locator('#export-title').fill('Meu resumo');
  await expect(page.getByRole('img', { name: 'Pré-visualização: Meu resumo' })).toBeVisible();
});

test('exports a four-page PDF report', async ({ page }) => {
  await importFixtures(page);
  await page.goto('/#exportar');
  await page
    .getByRole('radiogroup', { name: 'Formato' })
    .getByRole('radio', { name: 'PDF' })
    .click();
  await expect(page.getByRole('img', { name: /página 4/ })).toBeVisible();
  const pdf = await download(page, /Baixar PDF/);
  expect(pdf.file).toMatch(/\.pdf$/);
  expect(pdf.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect((await PDFDocument.load(pdf.bytes)).getPageCount()).toBe(4);
});
