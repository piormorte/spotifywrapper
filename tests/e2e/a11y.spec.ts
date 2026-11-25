import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'America/Sao_Paulo' });

const ROUTES = [
  'visao-geral',
  'historico',
  'faixas',
  'artistas',
  'albuns',
  'linha-do-tempo',
  'analises',
  'perfil',
  'exportar',
  'importar',
  'ajustes',
  'mais',
];

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

for (const scheme of ['dark', 'light'] as const) {
  test(`every screen passes axe (WCAG 2.2 AA) in ${scheme} mode`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await importFixtures(page);
    const report: string[] = [];
    for (const route of ROUTES) {
      await page.goto(`/#${route}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      for (const v of results.violations) {
        report.push(
          `${route}: ${v.id} (${v.impact ?? ''}) — ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
        );
      }
    }
    expect(report).toEqual([]);
  });
}
