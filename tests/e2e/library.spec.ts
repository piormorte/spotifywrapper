import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURES = [
  'tests/fixtures/Streaming_History_Audio_2023-2024_0.json',
  'tests/fixtures/StreamingHistory_music_0.json',
];

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(msg.text());
  });
  page.on('pageerror', (err) => problems.push(err.message));
  return problems;
}

async function importFixtures(page: Page) {
  await page.goto('/#importar');
  await expect(page.getByRole('button', { name: 'Escolher arquivos' })).toBeEnabled();
  await page.locator('#import-files').setInputFiles(FIXTURES);
  await expect(page.getByText(/novas reproduções importadas/)).toBeVisible();
}

test.describe('local library', () => {
  test.describe.configure({ mode: 'serial' });

  test('imports exports, reports results and persists across reloads', async ({ page }) => {
    const problems = collectProblems(page);
    await importFixtures(page);

    await expect(page.getByText('Streaming_History_Audio_2023-2024_0.json').first()).toBeVisible();
    await expect(page.getByText(/Dados pessoais descartados/)).toContainText('ip_addr');
    await expect(page.getByText('Sem data e hora')).toBeVisible();
    await expect(page.getByText(/o histórico estendido já cobre esse período/)).toBeVisible();
    await expect(page.getByText('Reproduções registradas')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Reproduções registradas')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Importações anteriores' })).toBeVisible();

    // Importing the same files again adds nothing.
    await page.locator('#import-files').setInputFiles(FIXTURES);
    await expect(page.getByText('Nenhuma reprodução nova.')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('backs up, erases and restores the library', async ({ page }) => {
    // Headless Chromium cannot answer the native save dialog; use the download fallback.
    await page.addInitScript(() => {
      delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });
    const problems = collectProblems(page);
    await importFixtures(page);
    const before = await page.getByText('Reproduções registradas').locator('..').textContent();

    await page.goto('/#ajustes');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Fazer backup' }).click();
    const file = await (await download).path();
    await expect(page.getByText(/Backup salvo/)).toBeVisible();

    await page.getByRole('button', { name: 'Apagar todos os dados…' }).click();
    await page.getByRole('button', { name: 'Apagar definitivamente' }).click();
    await expect(page.getByText('Todos os dados foram apagados.')).toBeVisible();

    await page.locator('#restore-file').setInputFiles({
      name: 'liner-backup.sqlite',
      mimeType: 'application/octet-stream',
      buffer: readFileSync(file),
    });
    await expect(
      page.getByText(/Verificado: estrutura, contagens e conteúdo conferem/),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Substituir' }).click();
    await page.getByRole('button', { name: 'Restaurar' }).click();
    await page.getByRole('button', { name: 'Substituir todos os dados' }).click();
    await expect(page.getByText(/Dados substituídos pelo backup/)).toBeVisible();

    await page.goto('/#importar');
    await expect(page.getByText('Reproduções registradas').locator('..')).toHaveText(before ?? '');
    expect(problems).toEqual([]);
  });

  test('rejects a file that is not a backup without changing data', async ({ page }) => {
    await page.goto('/#ajustes');
    await page.locator('#restore-file').setInputFiles({
      name: 'not-a-backup.sqlite',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('definitely not sqlite'),
    });
    await expect(page.getByRole('alert')).toHaveText('O arquivo não é um banco SQLite.');
  });
});
