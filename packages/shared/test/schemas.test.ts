import { describe, expect, it } from 'vitest';
import {
  PlaceSchema,
  PlaceCategory,
  PublicPlaceProfileSchema,
  TAXONOMY,
  TAXONOMY_BY_CATEGORY,
  targetDensityFor,
  observationIsCurrent,
  CreateStayReservationRequestSchema,
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

describe('PublicPlaceProfileSchema', () => {
  const licensedImage = {
    url: '/demo/puerto-cabello/fortin-solano.jpg',
    credit: 'Periergeia / Wikimedia Commons · 2007',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fortinpuertocabello.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  };

  function baseProfile(overrides: Record<string, unknown> = {}) {
    return {
      demo: true,
      researchedAt: '2026-09-06',
      summary: { en: 'A public square.', es: 'Una plaza pública.' },
      sources: [{ label: 'OpenStreetMap', url: 'https://www.openstreetmap.org/way/157189923' }],
      ...overrides,
    };
  }

  it('accepts a profile without an image', () => {
    expect(PublicPlaceProfileSchema.safeParse(baseProfile()).success).toBe(true);
  });

  it('parses a profile with gettingThere knowledge', () => {
    const parsed = PublicPlaceProfileSchema.safeParse(
      baseProfile({
        gettingThere: {
          en: 'Shared taxis from the centre leave when full, roughly every 20 minutes.',
          es: 'Los taxis compartidos desde el centro salen llenos, aproximadamente cada 20 minutos.',
        },
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it('keeps gettingThere optional', () => {
    const parsed = PublicPlaceProfileSchema.safeParse(baseProfile());
    expect(parsed.success && parsed.data.gettingThere).toBeUndefined();
  });

  it('accepts a redistributably licensed image with its licence URL', () => {
    const parsed = PublicPlaceProfileSchema.safeParse(baseProfile({ image: licensedImage }));
    expect(parsed.success).toBe(true);
  });

  it('accepts an explicitly unverified demo-only image and reports its rights status', () => {
    const parsed = PublicPlaceProfileSchema.safeParse(
      baseProfile({
        image: { ...licensedImage, license: undefined, licenseUrl: undefined, rights: 'unverified-demo-only' },
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it('rejects "Demo use only" as a licence value', () => {
    const parsed = PublicPlaceProfileSchema.safeParse(
      baseProfile({ image: { ...licensedImage, license: 'Demo use only', licenseUrl: undefined } }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects a licence without a licence URL', () => {
    const parsed = PublicPlaceProfileSchema.safeParse(
      baseProfile({ image: { ...licensedImage, licenseUrl: undefined } }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects an image that states neither a licence nor unverified demo-only rights', () => {
    const parsed = PublicPlaceProfileSchema.safeParse(
      baseProfile({ image: { ...licensedImage, license: undefined, licenseUrl: undefined } }),
    );
    expect(parsed.success).toBe(false);
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

  it('includes lodging as a first-class stay category', () => {
    expect(CATEGORIES).toContain('lodging');
    expect(TAXONOMY_BY_CATEGORY.get('lodging')?.emoji).toBe('🛏️');
    expect(TAXONOMY_BY_CATEGORY.get('lodging')?.labelEn).toBe('Stay');
    expect(TAXONOMY_BY_CATEGORY.get('lodging')?.labelEs).toBe('Alojamiento');
  });
});

describe('observation freshness', () => {
  it('treats expired status and past validUntil as not current', () => {
    const now = '2026-09-12T14:00:00.000Z';
    expect(observationIsCurrent({ status: 'active', validUntil: '2026-09-14T00:00:00.000Z' }, now)).toBe(true);
    expect(observationIsCurrent({ status: 'expired', validUntil: '2026-09-11T00:00:00.000Z' }, now)).toBe(false);
    expect(observationIsCurrent({ status: 'active', validUntil: '2026-09-11T00:00:00.000Z' }, now)).toBe(false);
    expect(observationIsCurrent({ status: 'active', validUntil: null }, now)).toBe(true);
  });
});

describe('stay reservation request', () => {
  it('accepts half-open local dates with an idempotency key', () => {
    const parsed = CreateStayReservationRequestSchema.safeParse({
      checkIn: '2026-09-12',
      checkOut: '2026-09-14',
      guests: 2,
      idempotencyKey: 'rec-stay-0001',
    });
    expect(parsed.success).toBe(true);
  });
});
