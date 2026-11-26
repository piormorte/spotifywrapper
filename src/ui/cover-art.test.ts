import { describe, expect, it } from 'vitest';
import { coverArt, coverBackground, hashName, initialsOf } from './cover-art.ts';

describe('cover art', () => {
  it('is deterministic and ignores case and width differences', () => {
    expect(coverArt('Halden Vale')).toEqual(coverArt('Halden Vale'));
    expect(hashName('Halden Vale')).toBe(hashName('HALDEN VALE'));
    expect(hashName('Ｈalden')).toBe(hashName('halden'));
    expect(hashName('Halden Vale')).not.toBe(hashName('Halden Valle'));
  });

  it('keeps hues in range', () => {
    for (const name of ['a', 'Björk', '宇多田ヒカル', '', '123']) {
      const art = coverArt(name);
      expect(art.hue).toBeGreaterThanOrEqual(0);
      expect(art.hue).toBeLessThan(360);
      expect(art.hue2).toBeLessThan(360);
      expect(coverBackground(art)).toContain(`oklch(0.34 0.06 ${art.hue})`);
    }
  });

  it('takes up to two meaningful initials', () => {
    expect(initialsOf('Halden Vale')).toBe('HV');
    expect(initialsOf('The Midnight Choir')).toBe('MC');
    expect(initialsOf('björk')).toBe('B');
    expect(initialsOf('Os Mutantes')).toBe('M');
    expect(initialsOf('AC/DC')).toBe('AD');
    expect(initialsOf('(  )')).toBe('·');
    expect(initialsOf('宇多田ヒカル')).toBe('宇');
  });
});
