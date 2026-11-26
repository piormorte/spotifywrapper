import { expect, test, type Page } from '@playwright/test';

// The rest of the suite runs with reduced motion; this file checks the motion itself.
test.use({ contextOptions: { reducedMotion: 'no-preference' }, timezoneId: 'America/Sao_Paulo' });

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

test('the import screen links to the data request page without sending anything', async ({
  page,
}) => {
  await page.goto('/#importar');
  const link = page.getByRole('link', { name: /Pedir meus dados à Spotify/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://www.spotify.com/account/privacy/');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('figures count up and settle on the exact value', async ({ page }) => {
  await importFixtures(page);
  // Record every frame of the hero figure while the overview opens.
  const frames = page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const seen: string[] = [];
        const start = performance.now();
        const sample = () => {
          const text = document.querySelector('dd .text-hero')?.textContent;
          if (text && seen.at(-1) !== text) seen.push(text);
          if (performance.now() - start < 2500) requestAnimationFrame(sample);
          else resolve(seen);
        };
        requestAnimationFrame(sample);
      }),
  );
  await page.evaluate(() => {
    window.location.hash = '#visao-geral';
  });
  const seen = await frames;
  // 866 000 ms of music across the fixtures (see tests/fixtures).
  expect(seen.at(-1)).toBe('14');
  expect(seen.length).toBeGreaterThan(2);
  expect(seen[0]).toBe('0');
});

test('the phone top bar shows the screen title once the heading scrolls away', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout only');
  await importFixtures(page);
  const bar = page.locator('header p[aria-hidden]');
  await expect(bar).toHaveText('Importar dados');
  await expect(bar).toHaveCSS('opacity', '0');
  await page.evaluate(() => {
    window.scrollTo({ top: 600, behavior: 'instant' });
  });
  await expect(bar).toHaveCSS('opacity', '1');
});
