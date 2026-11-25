import { describe, expect, it } from 'vitest';
import { toFtsQuery } from './search.ts';

describe('toFtsQuery', () => {
  it('turns words into quoted prefix terms', () => {
    expect(toFtsQuery('low tide')).toBe('"low"* "tide"*');
  });

  it('strips FTS syntax so user input cannot inject operators', () => {
    expect(toFtsQuery('a OR b')).toBe('"a"* "OR"* "b"*');
    expect(toFtsQuery('"(x)*:')).toBe('"x"*');
    expect(toFtsQuery('NEAR(a b)')).toBe('"NEAR"* "a"* "b"*');
  });

  it('returns null for empty input', () => {
    expect(toFtsQuery('   ')).toBeNull();
    expect(toFtsQuery('"()"')).toBeNull();
  });
});
