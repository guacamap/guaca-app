import { describe, expect, it } from 'vitest';
import { Catalog } from '../../src/catalog/catalog.ts';
import { PlanDraft } from '../../src/guard/planDraft.ts';
import {
  assertGrounded,
  GuardViolation,
  type GuardCtx,
  type PlaceRowForGuard,
} from '../../src/guard/assertGrounded.ts';

const P1 = '00000000-0000-4000-8000-000000000001';
const P2 = '00000000-0000-4000-8000-000000000002';
const P3 = '00000000-0000-4000-8000-000000000003';

function row(id: string, name = `Place ${id.slice(-1)}`): PlaceRowForGuard {
  return {
    id,
    name,
    category: 'eat_drink',
    verificationStatus: 'verified',
    witnessCount: 2,
  };
}

const CATALOG = Catalog.build([row(P1, 'A'), row(P2, 'B'), row(P3, 'C')]);

function ctx(overrides: Partial<GuardCtx> = {}): GuardCtx {
  return {
    fingerprint: CATALOG.fingerprint,
    reReadVerified: async (ids: string[]) =>
      ids.map((id) => row(id)),
    lexicalSweep: () => [],
    ...overrides,
  };
}

function draft(stops: Array<Record<string, unknown>>): PlanDraft {
  const parsed = PlanDraft.safeParse({
    stops,
    languageCode: 'en',
  });
  if (!parsed.success) throw new Error('bad draft in test');
  return parsed.data;
}

const stop = (ref: number, startMin = 540, durationMin = 90) => ({
  ref,
  startMin,
  durationMin,
  reasonCode: 'OPEN_NOW',
});

async function violationOf(fn: () => Promise<unknown> | unknown): Promise<string> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof GuardViolation) return e.code;
    throw e;
  }
  throw new Error('expected a GuardViolation');
}

describe('assertGrounded', () => {
  it('G1: unknown ref fails membership (step 3)', async () => {
    const code = await violationOf(() =>
      assertGrounded(draft([stop(99)]), CATALOG, ctx()),
    );
    expect(code).toBe('UNKNOWN_REF');
  });

  it('G2: duplicate refs fail uniqueness (step 4)', async () => {
    const code = await violationOf(() =>
      assertGrounded(draft([stop(1), stop(1)]), CATALOG, ctx()),
    );
    expect(code).toBe('DUP_REF');
  });

  it('G3: malformed refs fail parsing (step 1)', async () => {
    const raw = {
      stops: [{ ref: 'not-a-number', startMin: 540, durationMin: 90, reasonCode: 'OPEN_NOW' }],
      languageCode: 'en',
    };
    const code = await violationOf(() => assertGrounded(raw as unknown as PlanDraft, CATALOG, ctx()));
    expect(code).toBe('SCHEMA');
  });

  it('G4: empty plan fails size (step 2)', async () => {
    const parsed = PlanDraft.safeParse({
      stops: [],
      languageCode: 'en',
    });
    expect(parsed.success).toBe(false);
    const code = await violationOf(() =>
      assertGrounded(parsed.data as unknown as PlanDraft, CATALOG, ctx()),
    );
    expect(code).toBe('SCHEMA');
  });

  it('G4b: oversized plan (9 stops) fails size (step 2)', async () => {
    const raw = {
      stops: Array.from({ length: 9 }, (_, i) => stop(i + 1)),
      languageCode: 'en',
    };
    const parsed = PlanDraft.safeParse(raw);
    expect(parsed.success).toBe(false);
    const code = await violationOf(() =>
      assertGrounded(parsed.data as unknown as PlanDraft, CATALOG, ctx()),
    );
    expect(code).toBe('SCHEMA');
  });

  it('G5: extra keys fail parsing (step 1)', async () => {
    const raw = {
      stops: [stop(1)],
      languageCode: 'en',
      placeName: 'La Sirena Dorada',
    };
    const code = await violationOf(() => assertGrounded(raw as unknown as PlanDraft, CATALOG, ctx()));
    expect(code).toBe('SCHEMA');
  });

  it('G6: incoherent times fail coherence (step 7)', async () => {
    // Two stops that overlap in wall-clock time after sorting.
    const code = await violationOf(() =>
      assertGrounded(
        draft([
          { ...stop(1), startMin: 700, durationMin: 300 },
          { ...stop(2), startMin: 800, durationMin: 90 },
        ]),
        CATALOG,
        ctx(),
      ),
    );
    expect(code).toBe('TIME_INCOHERENT');
  });

  it('G7: a place flipped to provisional mid-flight fails the TOCTOU re-read (step 6)', async () => {
    const reReadVerified = async (ids: string[]) => {
      // The place that WAS verified at retrieval is now provisional.
      return ids
        .filter((id) => id !== P2)
        .map((id) => row(id));
    };
    const code = await violationOf(() =>
      assertGrounded(draft([stop(1), stop(2)]), CATALOG, ctx({ reReadVerified })),
    );
    expect(code).toBe('NOT_VERIFIED_AT_RENDER');
  });

  it('G8: a catalog built from an unverified row has no ref for it', async () => {
    const bad = Catalog.build([row(P1, 'A'), { ...row(P2, 'B'), verificationStatus: 'pending', witnessCount: 0 }]);
    expect(bad.size).toBe(1);
    const code = await violationOf(() => assertGrounded(draft([stop(2)]), bad, ctx()));
    expect(code).toBe('UNKNOWN_REF');
  });

  it('G9: fingerprint mismatch fails (step 9)', async () => {
    const code = await violationOf(() =>
      assertGrounded(draft([stop(1)]), CATALOG, ctx({ fingerprint: 'deadbeef' })),
    );
    expect(code).toBe('CATALOG_FINGERPRINT_MISMATCH');
  });

  it('G10: free-text entity in the raw output fails the lexical sweep (step 8)', async () => {
    const raw = draft([stop(1)]);
    const code = await violationOf(() =>
      assertGrounded(
        raw,
        CATALOG,
        ctx({ lexicalSweep: () => ['La Sirena Dorada'] }),
      ),
    );
    expect(code).toBe('FREE_TEXT_ENTITY');
  });

  it('happy path: returns a branded PlanArtifact with catalog placeIds only', async () => {
    const artifact = await assertGrounded(
      draft([stop(1, 540, 60), stop(3, 700, 60)]),
      CATALOG,
      ctx(),
    );
    expect(artifact.placeIds).toEqual([P1, P3]);
    expect(artifact.stops).toHaveLength(2);
    const catalogIds = new Set<string>(CATALOG.placeIds());
    expect(artifact.placeIds.every((id) => catalogIds.has(id))).toBe(true);
  });
});
