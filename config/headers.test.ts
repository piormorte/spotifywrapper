import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGlobalHeaders } from './headers.ts';

function withFile(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'headers-')), '_headers');
  writeFileSync(path, contents);
  return path;
}

describe('readGlobalHeaders', () => {
  it('reads only the global /* block and ignores comments', () => {
    const path = withFile(
      ['# comment', '/*', '  X-A: 1', '  # inner', '  X-B: a: b', '/api/*', '  X-C: 3'].join('\n'),
    );
    expect(readGlobalHeaders(path)).toEqual({ 'X-A': '1', 'X-B': 'a: b' });
  });

  it('parses the project headers file with a CSP that forbids external connections', () => {
    const headers = readGlobalHeaders('public/_headers');
    expect(headers['Content-Security-Policy']).toContain("connect-src 'self'");
  });
});
