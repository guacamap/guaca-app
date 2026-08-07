import { describe, expect, it } from 'vitest';
import {
  checkFreshness,
  checkGeoDistance,
  type GeoVerdict,
  type FreshnessVerdict,
} from '../../src/verification/rungs12.ts';

describe('checkFreshness (rung L1)', () => {
  const missionStart = new Date('2026-08-06T10:00:00Z');
  const missionEnd = new Date('2026-08-08T10:00:00Z');

  it('passes when capture is inside the mission window', () => {
    const v = checkFreshness(new Date('2026-08-07T12:00:00Z'), missionStart, missionEnd);
    expect(v.pass).toBe(true);
  });

  it('hard-fails when capture is more than 24h outside the window', () => {
    const v = checkFreshness(new Date('2026-08-09T12:00:00Z'), missionStart, missionEnd);
    expect(v.pass).toBe(false);
    expect(v.hard).toBe(true);
  });

  it('exactly at the boundary passes (within tolerance)', () => {
    const v = checkFreshness(new Date('2026-08-08T10:00:00Z'), missionStart, missionEnd);
    expect(v.pass).toBe(true);
  });

  it('a day after the window fails', () => {
    const v = checkFreshness(new Date('2026-08-09T11:00:00Z'), missionStart, missionEnd);
    expect(v.pass).toBe(false);
  });
});

describe('checkGeoDistance (rung L2)', () => {
  const pin = { lat: 10.4716, lon: -68.0056 };

  it('≤75m passes with score 1.0', () => {
    const v = checkGeoDistance(10.4716, -68.0056, 30, pin);
    expect(v.verdict).toBe('PASS');
    expect(v.score).toBe(1);
  });

  it('exactly at 75m passes (at tolerance)', () => {
    // 75m north at this latitude ≈ 0.000674 degrees lat.
    const v = checkGeoDistance(10.4716 + 75 / 111320, -68.0056, 30, pin);
    expect(v.verdict).toBe('PASS');
    expect(v.score).toBe(1);
  });

  it('75–250m is WEAK with a linear 1.0→0.3 score', () => {
    const v = checkGeoDistance(10.4716 + 150 / 111320, -68.0056, 30, pin);
    expect(v.verdict).toBe('WEAK');
    expect(v.score).toBeGreaterThan(0.3);
    expect(v.score).toBeLessThan(1);
  });

  it('one metre beyond 250m hard-fails', () => {
    const v = checkGeoDistance(10.4716 + 251 / 111320, -68.0056, 30, pin);
    expect(v.verdict).toBe('HARD');
  });

  it('absent geolocation is INCONCLUSIVE', () => {
    const v = checkGeoDistance(null, null, null, pin);
    expect(v.verdict).toBe('INCONCLUSIVE');
    expect(v.score).toBe(0);
  });
});
