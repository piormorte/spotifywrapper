import { expect, test } from '@playwright/test';

test.describe('Stage 1 sample screen', () => {
  test('labels its data as fictional', async ({ page }) => {
    await page.goto('/#exemplo');
    await expect(page.getByRole('heading', { level: 1, name: 'Visão geral' })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('fictícios');
  });

  test('period control switches the figures and supports arrow keys', async ({ page }) => {
    await page.goto('/#exemplo');
    const periods = page.getByRole('radiogroup', { name: 'Período' });
    const hero = page.locator('dd .text-hero');
    const allTime = await hero.textContent();

    await periods.getByRole('radio').nth(4).click();
    await expect(periods.getByRole('radio').nth(4)).toHaveAttribute('aria-checked', 'true');
    await expect(hero).not.toHaveText(allTime ?? '');

    await page.keyboard.press('ArrowRight');
    await expect(periods.getByRole('radio').nth(0)).toHaveAttribute('aria-checked', 'true');
    await expect(hero).toHaveText(allTime ?? '');
  });

  test('non-built destinations are plain text, never dead buttons or links', async ({ page }) => {
    await page.goto('/#exemplo');
    const nav = page.getByRole('navigation', { name: 'Principal' }).first();
    for (const link of await nav.getByRole('link').all()) {
      await expect(link).toHaveAttribute('href', /^#[a-z]+$/);
    }
    await expect(nav.getByRole('button')).toHaveCount(0);
  });
});

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
