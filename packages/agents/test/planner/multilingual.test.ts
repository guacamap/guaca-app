import { describe, expect, it } from 'vitest';
import { renderItinerary, type RenderPlace } from '../../src/render/itinerary.ts';
import type { PlanArtifact } from '../../src/guard/assertGrounded.ts';

const P1 = '00000000-0000-4000-8000-000000000001';
const P2 = '00000000-0000-4000-8000-000000000002';

// TEST-ONLY mint. The brand's escape hatch is this cast; production code
// cannot use it (see test/guard/brand.test.ts, which fails the build if
// `as unknown as PlanArtifact` appears anywhere under src/).
const artifact: PlanArtifact = {
  placeIds: [P1, P2],
  stops: [
    { placeId: P1, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' },
    { placeId: P2, startMin: 700, durationMin: 60, reasonCode: 'NEAREST' },
  ],
} as unknown as PlanArtifact;

const places = new Map<string, RenderPlace>([
  [P1, { id: P1, name: 'Arepera La Guacamaya', landmarkDescription: 'Casa amarilla', category: 'eat_drink' }],
  [P2, { id: P2, name: 'Café El Puerto', landmarkDescription: 'Frente al malecón', category: 'eat_drink' }],
]);

describe('T4.6 — multilingual composition', () => {
  it('a Spanish question yields a Spanish answer with identical place IDs', () => {
    const es = renderItinerary(artifact, places, 'es');
    const en = renderItinerary(artifact, places, 'en');

    // Same places, same order — language changes only the prose.
    const idsOf = (text: string) =>
      [P1, P2].filter((id) => text.includes(places.get(id)!.name));
    expect(idsOf(es)).toEqual(idsOf(en));

    // Spanish template, not English.
    expect(es).toContain('Este es tu plan');
    expect(en).toContain('Here is your plan');
    expect(es).not.toBe(en);
  });

  it('every language template resolves (es and en minimum)', () => {
    for (const lang of ['es', 'en']) {
      const out = renderItinerary(artifact, places, lang);
      expect(out).toContain('Arepera La Guacamaya');
      expect(out).toContain('Café El Puerto');
    }
  });
});
