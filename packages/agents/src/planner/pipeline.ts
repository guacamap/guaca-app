import type { PlaceTier } from '@guaca/shared';
import { TIER_RANK } from '@guaca/shared';
import {
  groundFromVerifiedRows,
  GuardViolation,
  type PlanArtifact,
} from '../guard/assertGrounded.js';
import type { Inference } from '../inference/types.js';
import { answerDeterministic, greedyRoute, type FastPathPlace } from './fastPath.js';
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
  /** Tiered honesty; absent means the row is offered as verified (the benchmark fixture). */
  tier?: PlaceTier;
  corroboration?: number;
  subcategory?: string | null;
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
  /** Suggestions are alternatives, not a committed timed itinerary. */
  recommendations?: boolean;
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
  /** Hours with rain likely, as text for the planner and as hours for the fast path. */
  rain?: { windows: string; wetHours: readonly number[] };
  /** The specific kind of place the traveller named, when they did. A broad category never satisfies it. */
  kind?: string;
  /** Local sunrise and sunset; open-air stops are kept inside them. */
  daylight?: { sunrise: string; sunset: string };
}

/** "tattoo studio" against "Tattoo parlor" or "Ink Tattoo Studio": any content word in common, accents and case aside. */
export function matchesKind(kind: string, name: string, subcategory: string | null | undefined): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const stop = new Set(['the', 'a', 'an', 'de', 'del', 'la', 'el', 'los', 'las', 'and', 'y', 'shop', 'place', 'studio', 'bar', 'restaurant', 'restaurante', 'tienda', 'local', 'centro', 'center']);
  const words = norm(kind).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stop.has(w));
  if (words.length === 0) return true;
  const hay = norm(`${name} ${subcategory ?? ''}`);
  return words.some((w) => hay.includes(w.replace(/s$/, '')));
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

  // A named kind narrows the catalog to places whose name or listed kind
  // says so. "A tattoo studio" answered with a bank is worse than a refusal:
  // the refusal funds a mission, the bank teaches the traveller not to ask.
  const kind = options.kind?.trim();
  const places = kind ? options.places.filter((p) => matchesKind(kind, p.name, p.subcategory)) : options.places;
  if (kind && places.length === 0) return refuse('INSUFFICIENT_COVERAGE', 'coverage');

  const verifiedIds = new Set(places.map((p) => p.id));

  if (options.recommendations && days === 1) {
    const hits = categoryHits(options.text);
    const categories = hits.length ? hits : [category];
    // Cover every requested topic, never silently answer only the first.
    if (categories.some((c) => !places.some((p) => p.category === c))) return refuse('INSUFFICIENT_COVERAGE', 'coverage');
    const ranked = places.map((p) => ({ ...p, landmarkDescription: p.landmarkDescription ?? '', openAt: 0, closeAt: 1440, tierRank: TIER_RANK[p.tier ?? 'verified'] }));
    const stops = categories.flatMap((c) => greedyRoute({ places: ranked, category: c, startMin: 480, partySize: categories.length > 1 ? 1 : 2, lat: options.lat, lon: options.lon }));
    const artifact = groundFromVerifiedRows(stops, verifiedIds);
    if (!artifact.stops.length) return refuse('NO_GROUNDED_STOPS', 'fast');
    return { kind: 'answer', path: 'fast', artifact, placeIds: [...artifact.placeIds], category };
  }

  // Deterministic fast path, zero inference. A single day only: a trip is a
  // composition question by definition.
  if (days === 1) {
    const fastPathPlaces: FastPathPlace[] = places.map((p) => ({
      id: p.id, name: p.name, category: p.category, landmarkDescription: p.landmarkDescription ?? '',
      lat: p.lat, lon: p.lon, openAt: 0, closeAt: 1440, tierRank: TIER_RANK[p.tier ?? 'verified'],
    }));
    const fast = await answerDeterministic({
      text: options.text, language: options.language, lat: options.lat, lon: options.lon,
      places: fastPathPlaces, inference: options.inference,
      ...(options.nowMin !== undefined ? { nowMin: options.nowMin } : {}),
      ...(resolvedCategory ? { categoryOverride: resolvedCategory } : {}),
      ...(options.rain ? { wetHours: options.rain.wetHours } : {}),
      ...(options.daylight ? { sunsetMin: Number(options.daylight.sunset.slice(0, 2)) * 60 + Number(options.daylight.sunset.slice(3, 5)) } : {}),
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
    ? (singleCategory ? places.filter((p) => p.category === singleCategory) : places)
    : places.slice(0, 24);
  if (catalogRows.length < options.minCandidates) return refuse('INSUFFICIENT_COVERAGE', 'coverage');

  const outcome = await runGroundedPlanner({
    text: options.text, language: options.language, days,
    rows: catalogRows.map((p) => ({
      id: p.id, name: p.name, category: p.category,
      verificationStatus: p.verificationStatus, witnessCount: p.witnessCount,
      ...(p.tier ? { tier: p.tier } : {}), corroboration: p.corroboration ?? 0, subcategory: p.subcategory ?? null,
    })),
    inference: options.inference,
    onGap: () => undefined,
    ...(options.nowMin !== undefined ? { nowMin: options.nowMin } : {}),
    ...(options.rain ? { rainWindows: options.rain.windows } : {}),
    ...(options.daylight ? { daylight: options.daylight } : {}),
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
