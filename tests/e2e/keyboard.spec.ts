import { expect, test } from '@playwright/test';

test('each screen has its own title and navigation moves focus to the heading', async ({
  page,
}) => {
  await page.goto('/#visao-geral');
  await expect(page).toHaveTitle('Visão geral · Liner');
  await page.goto('/#ajustes');
  await expect(page).toHaveTitle('Ajustes · Liner');
  await page.evaluate(() => {
    window.location.hash = 'importar';
  });
  await expect(page).toHaveTitle('Importar dados · Liner');
  await expect(page.getByRole('heading', { level: 1, name: 'Importar dados' })).toBeFocused();
});

test('a skip control jumps past the navigation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard navigation');
  await page.goto('/#ajustes');
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('button', { name: 'Pular para o conteúdo' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeFocused();
});

test('option lists support arrow keys with a single tab stop', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard navigation');
  await page.goto('/#importar');
  await expect(page.getByRole('button', { name: 'Escolher arquivos' })).toBeEnabled();
  await page
    .locator('#import-files')
    .setInputFiles(['tests/fixtures/Streaming_History_Audio_2023-2024_0.json']);
  await expect(page.getByText(/novas reproduções importadas/)).toBeVisible();

  await page.goto('/#exportar');
  const group = page.getByRole('radiogroup', { name: 'Modelo' });
  const first = group.getByRole('radio', { name: 'Minha vida em escuta' });
  await first.focus();
  await page.keyboard.press('ArrowDown');
  const second = group.getByRole('radio', { name: 'Meu ano em escuta' });
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-checked', 'true');
  await expect(first).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('End');
  await expect(group.getByRole('radio', { name: 'Minhas estatísticas' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(first).toBeFocused();
});

test('the period control is operable with the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard navigation');
  await page.goto('/#ajustes');
  const theme = page.getByRole('radiogroup', { name: 'Tema' });
  await theme.getByRole('radio', { name: 'Sistema' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(theme.getByRole('radio', { name: 'Claro' })).toBeFocused();
  await expect(theme.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');
  await expect(theme.getByRole('radio', { name: 'Sistema' })).toHaveAttribute('tabindex', '-1');
});
