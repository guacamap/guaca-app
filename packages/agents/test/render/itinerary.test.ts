import { describe, expect, it } from 'vitest';
import { renderItinerary, type RenderPlace } from '../../src/render/itinerary.ts';
import type { PlanArtifact } from '../../src/guard/assertGrounded.ts';

/** A name that exists ONLY in the database row — never in the artifact. */
const DB_ONLY_SENTINEL = '§§FROM-THE-DATABASE§§';

interface Stop {
  placeId: string;
  startMin: number;
  durationMin: number;
  reasonCode: string;
}

/**
 * TEST-ONLY. Mints an artifact without going through the guard so the
 * renderer can be unit-tested in isolation. Production code cannot do this —
 * `brand.test.ts` fails the build if this cast appears anywhere under src/.
 */
function grounded(stops: Stop[]): PlanArtifact {
  return {
    placeIds: stops.map((s) => s.placeId),
    stops,
  } as unknown as PlanArtifact;
}

function place(id: string, overrides: Partial<RenderPlace> = {}): RenderPlace {
  return {
    id,
    name: DB_ONLY_SENTINEL,
    landmarkDescription: 'Casa amarilla',
    category: 'eat_drink',
    ...overrides,
  };
}

describe('renderItinerary (test A3)', () => {
  it('every place name in the output came from a DB row, not from the artifact', () => {
    // The sentinel exists only in the DB row. If it appears in the output,
    // the renderer sourced the name from the database — which is the claim.
    const artifact = grounded([
      { placeId: 'p1', startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' },
    ]);
    const places = new Map<string, RenderPlace>([['p1', place('p1')]]);

    const out = renderItinerary(artifact, places, 'en');

    expect(out).toContain(DB_ONLY_SENTINEL);
  });

  it('a name absent from the DB can never appear, even if the artifact carries it', () => {
    // Simulate the worst case: an artifact carrying a fabricated venue name in
    // a field the renderer might be tempted to read.
    const hostile = {
      placeIds: ['p1'],
      stops: [
        {
          placeId: 'p1',
          startMin: 540,
          durationMin: 60,
          reasonCode: 'OPEN_NOW',
          name: 'La Sirena Dorada',
          description: 'La Sirena Dorada, the best seafood in town',
        },
      ],
    } as unknown as PlanArtifact;
    const places = new Map<string, RenderPlace>([['p1', place('p1')]]);

    const out = renderItinerary(hostile, places, 'en');

    expect(out.toLowerCase()).not.toContain('sirena');
    expect(out).toContain(DB_ONLY_SENTINEL);
  });

  it('uses the guest language for the template', () => {
    const artifact = grounded([
      { placeId: 'p1', startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' },
    ]);
    const places = new Map([['p1', place('p1', { name: 'Café El Puerto' })]]);
    const en = renderItinerary(artifact, places, 'en');
    const es = renderItinerary(artifact, places, 'es');
    expect(en).not.toBe(es);
    expect(es).toContain('Café El Puerto');
  });

  it('renders a full itinerary deterministically', () => {
    const artifact = grounded([
      { placeId: 'p1', startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' },
      { placeId: 'p2', startMin: 700, durationMin: 60, reasonCode: 'NEAREST' },
    ]);
    const places = new Map<string, RenderPlace>([
      ['p1', place('p1', { name: 'Café El Puerto' })],
      ['p2', place('p2', { name: 'Arepera La Guacamaya' })],
    ]);
    const a = renderItinerary(artifact, places, 'en');
    const b = renderItinerary(artifact, places, 'en');
    expect(a).toBe(b);
  });

  it('fails closed: a stop whose place is missing from the DB map is an error', () => {
    const artifact = grounded([
      { placeId: 'ghost', startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' },
    ]);
    expect(() =>
      renderItinerary(artifact, new Map<string, RenderPlace>(), 'en'),
    ).toThrow(/ghost/);
  });
});
