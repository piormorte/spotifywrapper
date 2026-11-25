import { readFileSync } from 'node:fs';

/**
 * Parses the Cloudflare Pages `_headers` file so the local preview server
 * serves exactly the same security headers as production.
 *
 * Only the global `/*` block is supported, which is all this project uses.
 */
export function readGlobalHeaders(path: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let inGlobalBlock = false;

  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trimEnd();
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;

    if (!/^\s/.test(line)) {
      inGlobalBlock = line.trim() === '/*';
      continue;
    }
    if (!inGlobalBlock) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;
    headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return headers;
}
