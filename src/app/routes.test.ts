import { describe, expect, it } from 'vitest';
import { parseRoute } from './routes.ts';

describe('parseRoute', () => {
  it('accepts plain and legacy slash hashes', () => {
    expect(parseRoute('#ajustes')).toBe('ajustes');
    expect(parseRoute('#/exemplo')).toBe('exemplo');
  });
  it('falls back to the import screen', () => {
    expect(parseRoute('')).toBe('importar');
    expect(parseRoute('#nope')).toBe('importar');
  });
});
