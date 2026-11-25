import { expect, test } from '@playwright/test';

test('serves the shell with the production security headers', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('renders without console errors, CSP violations or external requests', async ({
  page,
  baseURL,
}) => {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(msg.text());
  });
  page.on('pageerror', (err) => problems.push(err.message));
  page.on('request', (req) => {
    if (baseURL && !req.url().startsWith(baseURL) && !req.url().startsWith('data:')) {
      problems.push(`external request: ${req.url()}`);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
});

for (const path of ['/', '/#ajustes', '/#exemplo', '/#referencia']) {
  test(`has no horizontal overflow at the current viewport: ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
