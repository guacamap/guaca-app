import { describe, expect, it } from 'vitest';
import {
  PlaceSchema,
  PlaceCategory,
  TAXONOMY,
  TAXONOMY_BY_CATEGORY,
  targetDensityFor,
} from '../src/index.js';

const CATEGORIES = PlaceCategory.options;

function basePlace(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    areaId: '00000000-0000-4000-8000-000000000002',
    name: 'Arepera La Guacamaya',
    category: 'eat_drink' as const,
    description: null,
    landmarkDescription: 'Casa amarilla al lado del puente',
    lat: 10.4716,
    lon: -68.0056,
    h3_8: '8a0000000000000',
    openHours: null,
    priceBand: 2,
    tags: [],
    source: 'spotter' as const,
    verificationStatus: 'pending' as const,
    witnessCount: 0,
    createdBySpotterId: null,
    confirmedBySpotterId: null,
    verifiedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

describe('PlaceSchema', () => {
  it('accepts a pending place', () => {
    const parsed = PlaceSchema.safeParse(basePlace());
    expect(parsed.success).toBe(true);
  });

  it('rejects a verified place with no confirmed_by_spotter_id', () => {
    const parsed = PlaceSchema.safeParse(
      basePlace({
        verificationStatus: 'verified',
        witnessCount: 2,
        createdBySpotterId: '00000000-0000-4000-8000-000000000011',
        confirmedBySpotterId: null,
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects a verified place where creator and confirmer are the same spotter', () => {
    const parsed = PlaceSchema.safeParse(
      basePlace({
        verificationStatus: 'verified',
        witnessCount: 2,
        createdBySpotterId: '00000000-0000-4000-8000-000000000011',
        confirmedBySpotterId: '00000000-0000-4000-8000-000000000011',
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it('accepts a verified place with two distinct spotters', () => {
    const parsed = PlaceSchema.safeParse(
      basePlace({
        verificationStatus: 'verified',
        witnessCount: 2,
        createdBySpotterId: '00000000-0000-4000-8000-000000000011',
        confirmedBySpotterId: '00000000-0000-4000-8000-000000000012',
      }),
    );
    expect(parsed.success).toBe(true);
  });
});

describe('taxonomy', () => {
  it('round-trips every category', () => {
    expect(TAXONOMY.map((e) => e.category).sort()).toEqual([...CATEGORIES].sort());
    for (const c of CATEGORIES) {
      expect(TAXONOMY_BY_CATEGORY.get(c)?.labelEs.length).toBeGreaterThan(0);
      expect(TAXONOMY_BY_CATEGORY.get(c)?.labelEn.length).toBeGreaterThan(0);
      expect(TAXONOMY_BY_CATEGORY.get(c)?.targetDensity).toBeGreaterThan(0);
      expect(targetDensityFor(c)).toBeGreaterThan(0);
    }
  });

  it('targetDensityFor throws on unknown category', () => {
    expect(() => targetDensityFor('unknown' as PlaceCategory)).toThrow();
  });
});
