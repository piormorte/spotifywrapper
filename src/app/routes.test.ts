import { describe, expect, it } from 'vitest';
import { parseRoute } from './routes.ts';

describe('parseRoute', () => {
  it('accepts plain and legacy slash hashes', () => {
    expect(parseRoute('#ajustes')).toBe('ajustes');
    expect(parseRoute('#/importar')).toBe('importar');
  });
  it('falls back to the overview', () => {
    expect(parseRoute('')).toBe('visao-geral');
    expect(parseRoute('#exemplo')).toBe('visao-geral');
  });
});
