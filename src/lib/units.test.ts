import { describe, expect, it } from 'vitest';
import {
  STREAM_THRESHOLD_MS,
  isRegisteredPlay,
  isStream,
  msToDays,
  msToHours,
  msToMinutes,
} from './units.ts';

describe('play definitions', () => {
  it('counts any positive playback as a registered play', () => {
    expect(isRegisteredPlay(0)).toBe(false);
    expect(isRegisteredPlay(1)).toBe(true);
    expect(isRegisteredPlay(STREAM_THRESHOLD_MS - 1)).toBe(true);
  });

  it('counts a stream from exactly 30 seconds', () => {
    expect(STREAM_THRESHOLD_MS).toBe(30_000);
    expect(isStream(29_999)).toBe(false);
    expect(isStream(30_000)).toBe(true);
    expect(isStream(180_000)).toBe(true);
  });

  it('keeps streams a subset of registered plays', () => {
    for (const ms of [0, 1, 29_999, 30_000, 1e9]) {
      if (isStream(ms)) expect(isRegisteredPlay(ms)).toBe(true);
    }
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid ms_played %s', (ms) => {
    expect(() => isRegisteredPlay(ms)).toThrow(RangeError);
    expect(() => isStream(ms)).toThrow(RangeError);
  });
});

describe('unit conversion', () => {
  it('converts milliseconds to minutes, hours and equivalent days', () => {
    expect(msToMinutes(90_000)).toBe(1.5);
    expect(msToHours(5_400_000)).toBe(1.5);
    expect(msToDays(129_600_000)).toBe(1.5);
  });
});
