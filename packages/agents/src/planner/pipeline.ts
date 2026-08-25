import {
  groundFromVerifiedRows,
  GuardViolation,
  type PlanArtifact,
} from '../guard/assertGrounded.js';
import type { Inference } from '../inference/types.js';
import { answerDeterministic, type FastPathPlace } from './fastPath.js';
import { runGroundedPlanner } from './groundedPlanner.js';
import {
  categoryHits,
  classifiesIntent,
  classifyWithModel,
  extractIntent,
} from './intent.js';

/** A verified place as the pipeline needs it: identity, category, position. */
export interface CatalogPlace {
  id: string;
  name: string;
  category: string;
  landmarkDescription?: string | null;
  lat: number;
  lon: number;
  verificationStatus: string;
  witnessCount: number;
}

export type AnswerPath = 'fast' | 'model';
export type RefusalStage = 'intent' | 'coverage' | 'fast' | 'model';

export type PipelineOutcome =
  | {
      kind: 'answer';
      path: AnswerPath;
      artifact: PlanArtifact;
      placeIds: string[];
      category: string | null;
    }
  | {
      kind: 'refusal';
      reason: string;
      stage: RefusalStage;
      category: string | null;
      /** The underlying message when the stage was an error, for the eval. */
      detail?: string;
    };

export interface PipelineOptions {
  text: string;
  language: string;
  lat: number;
  lon: number;
  /** Trip length in days, 1–7. Default 1. */
  days?: number;
  /** The verified rows retrieved near the ask. Nothing else is ever cited. */
  places: readonly CatalogPlace[];
  inference: Inference;
  /** Fewer verified candidates than this is a refusal before any model call. */
  minCandidates: number;
  /** Minutes past midnight for the fast path; the wall clock when omitted. */
  nowMin?: number;
}

/**
 * The tourist ask, from question to grounded stops, with no database in it:
 * intent (lexicon, then one cheap classification) → coverage → the
 * deterministic fast path → single-topic filter → the guarded model path →
 * the render-boundary re-mint. The API wraps this with retrieval, the
 * question record and the rendered text; the benchmark runs it bare on a
 * fixed catalog. One function, so what the benchmark scores is what a
 * traveller gets.
 */
export async function answerFromCatalog(options: PipelineOptions): Promise<PipelineOutcome> {
  const days = Math.max(1, Math.min(7, options.days ?? 1));
  const lexical = extractIntent(options.text);

  /*
   * An unrecognised question must not inherit the broad default category:
   * "best sushi in Tokyo" used to come back as a confident, verified-looking
   * arepa plan. But refusing everything the lexicon misses refused real
   * questions too ("fresh seafood by the water"). So: lexicon first, then one
   * classification that returns a CATEGORY or nothing. It never names a
   * place, so grounding is untouched; an unplaceable question still refuses.
   */
  let resolvedCategory: string | null = null;
  if (!classifiesIntent(options.text)) {
    resolvedCategory = await classifyWithModel(options.inference, options.text);
    if (!resolvedCategory) {
      return { kind: 'refusal', reason: 'UNCLEAR_QUESTION', stage: 'intent', category: lexical.category };
    }
  }
  const category = resolvedCategory ?? lexical.category;
  const refuse = (reason: string, stage: RefusalStage, detail?: string): PipelineOutcome => ({
    kind: 'refusal', reason, stage, category, ...(detail ? { detail } : {}),
  });

  // Coverage before any planning call. Zero tokens spent to say "I don't know".
  if (options.places.length < options.minCandidates) return refuse('INSUFFICIENT_COVERAGE', 'coverage');

  const verifiedIds = new Set(options.places.map((p) => p.id));

  // Deterministic fast path, zero inference. A single day only: a trip is a
  // composition question by definition.
  if (days === 1) {
    const fastPathPlaces: FastPathPlace[] = options.places.map((p) => ({
      id: p.id, name: p.name, category: p.category, landmarkDescription: p.landmarkDescription ?? '',
      lat: p.lat, lon: p.lon, openAt: 0, closeAt: 1440,
    }));
    const fast = await answerDeterministic({
      text: options.text, language: options.language, lat: options.lat, lon: options.lon,
      places: fastPathPlaces, inference: options.inference,
      ...(options.nowMin !== undefined ? { nowMin: options.nowMin } : {}),
      ...(resolvedCategory ? { categoryOverride: resolvedCategory } : {}),
    });
    if (fast) {
      const artifact = groundFromVerifiedRows(fast.stops, verifiedIds);
      const ids = [...artifact.placeIds];
      // An answer citing zero verified places is not an answer: it is unmet
      // demand wearing an answer's clothes. Refuse so the gap agent sees it.
      if (ids.length === 0) return refuse('NO_GROUNDED_STOPS', 'fast');
      return { kind: 'answer', path: 'fast', artifact, placeIds: ids, category };
    }
  }

  // Single-topic honesty: a one-day question the lexicon places in exactly
  // ONE category is answered from that category only. "Where can I hear
  // live music?" must refuse (and fund a mission) rather than cite arepa
  // places. Cross-category questions and trips keep the catalog; a day plan
  // is the point of those. A subset of a grounded set is grounded.
  const hits = categoryHits(options.text);
  const singleCategory = resolvedCategory ?? (hits.length === 1 ? hits[0]! : null);
  const catalogRows = days === 1
    ? (singleCategory ? options.places.filter((p) => p.category === singleCategory) : options.places)
    : options.places.slice(0, 24);
  if (catalogRows.length < options.minCandidates) return refuse('INSUFFICIENT_COVERAGE', 'coverage');

  const outcome = await runGroundedPlanner({
    text: options.text, language: options.language, days,
    rows: catalogRows.map((p) => ({
      id: p.id, name: p.name, category: p.category,
      verificationStatus: p.verificationStatus, witnessCount: p.witnessCount,
    })),
    inference: options.inference,
    onGap: () => undefined,
  });

  if (outcome.kind === 'PlanArtifact') {
    // Re-check the planner's ids against the verified rows we actually hold:
    // defence in depth at the render boundary, and the only legal mint.
    try {
      const artifact = groundFromVerifiedRows(
        outcome.artifact.stops.map((s) => ({
          placeId: s.placeId, dayIndex: s.dayIndex, startMin: s.startMin,
          durationMin: s.durationMin, reasonCode: s.reasonCode,
        })),
        verifiedIds,
      );
      const ids = [...artifact.placeIds];
      if (ids.length === 0) return refuse('NO_GROUNDED_STOPS', 'model');
      return { kind: 'answer', path: 'model', artifact, placeIds: ids, category };
    } catch (e) {
      if (e instanceof GuardViolation) return refuse(`GUARD_VIOLATION:${e.code}`, 'model');
      throw e;
    }
  }
  if (outcome.kind === 'RefusalArtifact') return refuse(outcome.reason, 'model');
  return refuse('PLANNER_ERROR', 'model', outcome.message);
}
