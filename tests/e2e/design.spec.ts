import { expect, test } from '@playwright/test';

test.describe('themes', () => {
  test('follows the system scheme and can be overridden', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/#ajustes');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe('rgb(0, 0, 0)');

    await page
      .getByRole('radiogroup', { name: 'Tema' })
      .getByRole('radio', { name: 'Claro' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(bg).toBe('rgb(255, 255, 255)');

    await page
      .getByRole('radiogroup', { name: 'Tema' })
      .getByRole('radio', { name: 'Sistema' })
      .click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });
});

test('export specimens render with the bundled font', async ({ page }) => {
  await page.goto('/#referencia');
  const canvas = page.getByRole('img', { name: /Stories, tema escuro/ });
  await canvas.scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('200 100px "Inter Variable"')))
    .toBe(true);
});
