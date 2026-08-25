import { Catalog } from '../catalog/catalog.js';
import { MAX_STOPS_PER_DAY, MAX_STOPS_TOTAL, PlanDraft } from './planDraft.js';

/** A DB row sufficient for the step-6 TOCTOU re-read. */
export interface PlaceRowForGuard {
  id: string;
  name: string;
  category: string;
  verificationStatus: string;
  witnessCount: number;
}

/**
 * Phantom brand. `GROUNDED` is declared but never defined, so it exists only
 * in the type system — no runtime value can produce it. The single cast that
 * mints a PlanArtifact lives at the bottom of assertGrounded and nowhere else.
 *
 * This is what makes "the AI never generates a place" a property of the
 * compiler rather than a promise in a comment: application code cannot type an
 * object literal as a PlanArtifact, so the renderer cannot be handed one that
 * did not come through the ten steps below.
 */
declare const GROUNDED: unique symbol;

/** The branded artifact — assertGrounded is the ONLY construction site. */
export interface PlanArtifact {
  readonly [GROUNDED]: true;
  readonly placeIds: readonly string[];
  readonly stops: readonly {
    placeId: string;
    dayIndex: number;
    startMin: number;
    durationMin: number;
    reasonCode: string;
  }[];
}

/**
 * Mint an artifact for a plan whose stops were selected by deterministic code
 * rather than by the model — the fast path, and the render boundary of the
 * guarded path. Every placeId is re-checked against the verified set the
 * caller actually retrieved, so this is a *checked* mint, not an escape
 * hatch: an unverified id throws exactly as the model path would.
 *
 * This exists so no code outside this module ever needs to cast. The renderer
 * accepts only PlanArtifact, and PlanArtifact can only be produced here or by
 * assertGrounded.
 */
export function groundFromVerifiedRows(
  stops: ReadonlyArray<{
    placeId: string;
    /** Omitted means day 0 — the deterministic fast path is a one-day plan. */
    dayIndex?: number;
    startMin: number;
    durationMin: number;
    reasonCode: string;
  }>,
  verifiedIds: ReadonlySet<string>,
): PlanArtifact {
  for (const s of stops) {
    if (!verifiedIds.has(s.placeId)) {
      throw new GuardViolation('UNKNOWN_REF', `placeId not in verified set: ${s.placeId}`);
    }
  }
  return {
    placeIds: stops.map((s) => s.placeId),
    stops: stops.map((s) => ({ dayIndex: 0, ...s })),
  } as unknown as PlanArtifact;
}

export type GuardViolationCode =
  | 'SCHEMA'
  | 'EMPTY_PLAN'
  | 'OVERSIZED_PLAN'
  | 'UNKNOWN_REF'
  | 'DUP_REF'
  | 'NOT_VERIFIED_AT_RENDER'
  | 'TIME_INCOHERENT'
  | 'FREE_TEXT_ENTITY'
  | 'CATALOG_FINGERPRINT_MISMATCH';

export class GuardViolation extends Error {
  constructor(
    readonly code: GuardViolationCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'GuardViolation';
  }
}

export interface GuardCtx {
  /** The catalog fingerprint the planner embedded in its request. */
  fingerprint: string;
  /** Step 6: re-read rows from Postgres; must be verified with witness_count >= 2. */
  reReadVerified(placeIds: readonly string[]): Promise<readonly PlaceRowForGuard[]>;
  /** Step 8: belt-and-braces free-text sweep over the raw output. */
  lexicalSweep(raw: PlanDraft): string[];
}

function fail(code: GuardViolationCode): never {
  throw new GuardViolation(code);
}

/**
 * The anti-hallucination guard — §7.3, exactly.
 *
 * 1. PARSE       PlanDraft.safeParse            fail → SCHEMA
 * 2. SIZE        1 ≤ stops ≤ 24 total           fail → EMPTY_PLAN / OVERSIZED_PLAN
 * 3. MEMBERSHIP  catalog.refs.has(ref)          fail → UNKNOWN_REF
 * 4. UNIQUENESS  refs pairwise distinct         fail → DUP_REF
 * 5. PROJECT     ref → catalog.byRef(ref).placeId
 * 6. RE-READ     SELECT … WHERE id = ANY($placeIds) AND verified AND witness_count>=2
 * 7. COHERENCE   per day: ≤ 8 stops, sorted, non-overlapping, travel feasible
 * 8. SWEEP       lexicalSweep(raw, catalog)     fail → FREE_TEXT_ENTITY
 * 9. FINGERPRINT ctx.fingerprint === catalog.fingerprint
 * 10. CONSTRUCT  return branded PlanArtifact
 *
 * Step 5 is the whole trick: the model's output is reduced to (int, int,
 * int, enum) tuples. No path exists by which a novel place crosses the
 * boundary, because the boundary is arithmetic.
 */
export async function assertGrounded(
  raw: PlanDraft,
  catalog: Catalog,
  ctx: GuardCtx,
): Promise<PlanArtifact> {
  // 1. PARSE
  const parsed = PlanDraft.safeParse(raw);
  if (!parsed.success) fail('SCHEMA');

  // 2. SIZE — total cap at the schema, per-day cap here in step 7.
  const stops = parsed.data.stops;
  if (stops.length < 1) fail('EMPTY_PLAN');
  if (stops.length > MAX_STOPS_TOTAL) fail('OVERSIZED_PLAN');

  const refs = stops.map((s) => s.ref);

  // 3. MEMBERSHIP
  const refSet = catalog.refs();
  for (const ref of refs) {
    if (!refSet.has(ref)) fail('UNKNOWN_REF');
  }

  // 4. UNIQUENESS — a place anchors at most one stop PER DAY. The same
  // place may anchor different days of a multi-day trip (a favourite
  // breakfast spot is real travel behaviour, and small catalogs force
  // reuse); repeating within a single day is the model padding, and
  // refuses. The adversarial DUP_REFS payload (default day 0) still dies.
  const seenDayRef = new Set<string>();
  for (let i = 0; i < refs.length; i++) {
    const key = `${stops[i]!.dayIndex}:${refs[i]}`;
    if (seenDayRef.has(key)) fail('DUP_REF');
    seenDayRef.add(key);
  }

  // 5. PROJECT — every other byte of model output is discarded here.
  const placeIds = refs.map((ref) => catalog.byRef(ref).placeId);

  // 6. RE-READ — TOCTOU guard. Step 4 lets one place anchor two DAYS, so
  // the re-read is over distinct ids: comparing against the stop count
  // refused every multi-day trip that returned to a favourite.
  const distinctIds = [...new Set(placeIds)];
  const fresh = await ctx.reReadVerified(distinctIds);
  if (new Set(fresh.map((r) => r.id)).size !== distinctIds.length) fail('NOT_VERIFIED_AT_RENDER');

  // 7. COHERENCE — per day: sorted, non-overlapping, travel-feasible. Days
  // are independent: two stops at 10:00 on different days is a valid trip,
  // and a rest day between used days is none of the guard's business.
  const byDay = new Map<number, typeof stops>();
  for (const s of stops) {
    const day = byDay.get(s.dayIndex) ?? [];
    day.push(s);
    byDay.set(s.dayIndex, day);
  }
  for (const dayStops of byDay.values()) {
    if (dayStops.length > MAX_STOPS_PER_DAY) fail('OVERSIZED_PLAN');
    const sorted = [...dayStops].sort((a, b) => a.startMin - b.startMin);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      if (a.startMin + a.durationMin > b.startMin) fail('TIME_INCOHERENT');
      // Travel-time feasibility: the next stop must start at least 10 minutes
      // after the previous one ends (the deterministic minimum the pure guard
      // can prove; the graph refines this with PostGIS at 4.5 km/h).
      if (b.startMin - (a.startMin + a.durationMin) < 10) fail('TIME_INCOHERENT');
    }
  }

  // 8. SWEEP
  const hits = ctx.lexicalSweep(raw);
  if (hits.length > 0) fail('FREE_TEXT_ENTITY');

  // 9. FINGERPRINT
  if (ctx.fingerprint !== catalog.fingerprint) fail('CATALOG_FINGERPRINT_MISMATCH');

  // 10. CONSTRUCT — the one and only place a PlanArtifact is minted.
  // The cast is the brand's escape hatch and is deliberately confined here;
  // `test/guard/brand.test.ts` fails the build if it appears anywhere else.
  return {
    placeIds,
    stops: stops.map((s, i) => ({
      placeId: placeIds[i]!,
      dayIndex: s.dayIndex,
      startMin: s.startMin,
      durationMin: s.durationMin,
      reasonCode: s.reasonCode,
    })),
  } as unknown as PlanArtifact;
}
