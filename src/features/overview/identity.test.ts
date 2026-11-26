import { describe, expect, it } from 'vitest';
import { identityLead, relativeChange } from './identity.ts';

describe('identity lead', () => {
  it('agrees with the period', () => {
    expect(identityLead({ preset: 'all' }, '2024-03-01')).toBe('Sua história soou como');
    expect(identityLead({ preset: 'year' }, '2024-03-01')).toBe('Seu 2024 soou como');
    expect(identityLead({ preset: '12m' }, '2024-03-01')).toBe('Seus últimos 12 meses soaram como');
    expect(identityLead({ preset: 'custom', start: 'a', end: 'b' }, '')).toBe(
      'Este período soou como',
    );
  });
});

describe('relativeChange', () => {
  it('is null without a base', () => {
    expect(relativeChange(10, 0)).toBeNull();
    expect(relativeChange(15, 10)).toBeCloseTo(0.5);
    expect(relativeChange(5, 10)).toBeCloseTo(-0.5);
  });
});
