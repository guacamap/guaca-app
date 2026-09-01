import { describe, expect, it } from 'vitest';

// subcategoryFor is not exported (osmImport.ts keeps it module-private, same
// as landmarkDescriptionFor); this test drives it indirectly is unnecessary
// complexity for a pure string function, so it is exported for testing.
import { subcategoryForOsmTags } from '../../src/seed/osmImport.js';

describe('osm subcategory extraction', () => {
  it('prefers a human-written description tag over everything else', () => {
    const tags = [{ '@_k': 'description', '@_v': 'Family bakery, arepas in the morning' }, { '@_k': 'cuisine', '@_v': 'venezuelan' }];
    expect(subcategoryForOsmTags(tags)).toBe('Family bakery, arepas in the morning');
  });

  it('falls back to brand and cuisine, cuisine list humanized', () => {
    expect(subcategoryForOsmTags([{ '@_k': 'cuisine', '@_v': 'italian;pizza' }])).toBe('Italian, Pizza');
    expect(subcategoryForOsmTags([{ '@_k': 'brand', '@_v': 'Farmatodo' }])).toBe('Farmatodo');
    expect(subcategoryForOsmTags([{ '@_k': 'brand', '@_v': 'Farmatodo' }, { '@_k': 'cuisine', '@_v': 'pharmacy' }])).toBe('Farmatodo · Pharmacy');
  });

  it('is null with nothing descriptive on the tag list', () => {
    expect(subcategoryForOsmTags([{ '@_k': 'name', '@_v': 'Kiosko' }])).toBeNull();
  });
});
