import { describe, expect, it } from 'vitest';
import { CARIBBEAN_COUNTRIES, CARIBBEAN_CITIES, liveCountries } from '../src/caribbean.ts';

describe('CARIBBEAN_COUNTRIES — every marker is an honest claim', () => {
  it('exactly ONE country is live: the pilot', () => {
    const live = liveCountries();
    expect(live).toHaveLength(1);
    expect(live[0]!.code).toBe('VE');
    expect(live[0]!.note).toContain('Puerto Cabello');
  });

  it('Mexico is not a Caribbean country — it must never appear', () => {
    expect(CARIBBEAN_COUNTRIES.some((c) => c.code === 'MX')).toBe(false);
  });

  it('the UN-geoscheme islands are all present', () => {
    const codes = new Set(CARIBBEAN_COUNTRIES.map((c) => c.code));
    for (const code of ['AI', 'VG', 'VI', 'TC', 'MS', 'BL', 'SX', 'BQ', 'GY', 'SR']) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it('the named expansion targets are planned, not implied-live', () => {
    const planned = CARIBBEAN_COUNTRIES.filter((c) => c.status === 'planned').map((c) => c.code);
    expect(planned).toContain('CO');
    expect(planned).toContain('CR');
  });

  it('every country has a capital coordinate and unique code', () => {
    const codes = new Set<string>();
    for (const c of CARIBBEAN_COUNTRIES) {
      expect(Number.isFinite(c.lat)).toBe(true);
      expect(Number.isFinite(c.lon)).toBe(true);
      expect(codes.has(c.code)).toBe(false);
      codes.add(c.code);
      // Caribbean basin sanity: lat 5–28, lon -100…-58.
      expect(c.lat).toBeGreaterThan(5);
      expect(c.lat).toBeLessThan(28);
      expect(c.lon).toBeGreaterThan(-100);
      expect(c.lon).toBeLessThan(-54); // Suriname's Paramaribo sets the edge
    }
  });
});

describe('CARIBBEAN_CITIES — expansion areas', () => {
  it('every city maps to a known country with a bbox span', () => {
    const codes = new Set(CARIBBEAN_COUNTRIES.map((c) => c.code));
    for (const city of CARIBBEAN_CITIES) {
      expect(codes.has(city.countryCode)).toBe(true);
      expect(city.span).toBeGreaterThan(0.01);
      expect(city.span).toBeLessThan(0.15);
    }
  });
});
