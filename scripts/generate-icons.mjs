// Renders the SVG app icons to the PNG sizes the web manifest and iOS need.
// Run: node scripts/generate-icons.mjs  (uses the Playwright Chromium)
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const outputs = [
  ['public/icons/icon.svg', 'public/icons/icon-192.png', 192],
  ['public/icons/icon.svg', 'public/icons/icon-512.png', 512],
  ['public/icons/icon-maskable.svg', 'public/icons/icon-maskable-512.png', 512],
  // iOS ignores transparency and applies its own mask: use the full-bleed art.
  ['public/icons/icon-maskable.svg', 'public/icons/apple-touch-icon.png', 180],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [svg, png, size] of outputs) {
  const markup = readFileSync(svg, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  writeFileSync(
    png,
    await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    }),
  );
  console.log(png);
}
await browser.close();
