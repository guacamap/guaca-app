import type { Pool } from 'pg';
import {
  answerDeterministic,
  categoryHits,
  classifiesIntent,
  classifyWithModel,
  extractIntent,
  groundFromVerifiedRows,
  renderItinerary,
  runGroundedPlanner,
  type FastPathPlace,
  type Inference,
} from '@guaca/agents';
import {
  q,
  recordQuestion,
  trendsForPlaces,
  createTrip,
  type PlaceRow,
} from '@guaca/db';
import {
  PACE_STOPS_PER_DAY,
  TripReasonCode,
  type Trip,
  type TripPace,
  type TripStop,
} from '@guaca/shared';
import { suggestionsNear } from './suggestionsService.js';

export interface AskResult {
  kind: 'answer' | 'refusal';
  text: string;
  placeIds: string[];
  /** The persisted question — the demand signal the gap agent later reads. */
  questionId?: string;
  /** Grounded follow-ups near the ask — deterministic trend picks, never model output. */
  suggestions?: Array<{ placeId: string; name: string; why: 'trending' | 'asked_about' | 'fresh' }>;
}

const REFUSAL_TEXT: Record<string, string> = {
  es: 'Nadie ha verificado lugares para eso todavía. Ya encargamos a un local que vaya a mirar.',
  en: 'No one has verified places for that yet — we have commissioned a local to go look.',
};

/**
 * The tourist-facing ask path: retrieval → coverage (before any LLM) → fast
 * path (zero inference) → guarded model path → multilingual render.
 *
 * EVERY exit records the question. A refusal that isn't written down is not a
 * demand signal — `clusterUnanswered` reads `questions where answered = false`,
 * so an unrecorded refusal means the gap agent never sees it and no mission is
 * ever commissioned. This function is where the core loop is closed.
 *
 * Intent extraction is the deterministic lexicon, so recording costs zero
 * inference and the refusal path still touches no model.
 */
export async function ask(
  pool: Pool,
  input: {
    text: string;
    language: string;
    lat: number;
    lon: number;
    sessionId?: string | null;
    propertyId?: string | null;
  },
  opts: { minCandidates: number; inference: import('@guaca/agents').Inference },
): Promise<AskResult> {
  const intent = extractIntent(input.text);
  /** Set when the lexicon missed and the model placed the question. */
  let resolvedCategory: string | null = null;

  const record = async (
    answered: boolean,
    placeIds: string[],
    refusalReason: string | null,
  ): Promise<string | undefined> => {
    try {
      const rec = await recordQuestion(pool, {
        rawText: input.text,
        language: input.language,
        category: intent.category,
        lat: input.lat,
        lon: input.lon,
        answered,
        answerPlaceIds: placeIds,
        refusalReason,
        sessionId: input.sessionId ?? null,
        propertyId: input.propertyId ?? null,
      });
      return rec.questionId;
    } catch {
      // Never fail a guest's request because bookkeeping failed. The demand
      // signal is valuable, the answer is what they came for.
      return undefined;
    }
  };

  const refuse = async (reason: string): Promise<AskResult> => {
    const questionId = await record(false, [], reason);
    return {
      kind: 'refusal',
      text: REFUSAL_TEXT[input.language] ?? REFUSAL_TEXT.en!,
      placeIds: [],
      ...(questionId ? { questionId } : {}),
    };
  };

  /** Grounded follow-ups near the ask, excluding what the answer just cited. */
  const followUps = async (
    answered: readonly string[],
  ): Promise<NonNullable<AskResult['suggestions']> | undefined> => {
    try {
      const s = await suggestionsNear(pool, {
        lat: input.lat,
        lon: input.lon,
        exclude: answered,
      });
      return s.length > 0 ? s : undefined;
    } catch {
      // Suggestions are garnish; the answer is the meal.
      return undefined;
    }
  };

  /*
   * An unrecognised question must not inherit the broad default category —
   * "best sushi in Tokyo" used to come back as a confident, verified-looking
   * arepa plan. But refusing everything the lexicon misses refused real
   * questions too ("fresh seafood by the water"). So: lexicon first, then one
   * cheap classification that returns a CATEGORY or nothing. It never names a
   * place, so grounding is untouched — an unplaceable question still refuses.
   */
  if (!classifiesIntent(input.text)) {
    resolvedCategory = await classifyWithModel(opts.inference, input.text);
    if (!resolvedCategory) return refuse('UNCLEAR_QUESTION');
    intent.category = resolvedCategory as typeof intent.category;
  }

  const rows = await q.places.findVerifiedNear(pool, input.lat, input.lon, 5000, undefined);
  const verifiedIds = new Set(rows.map((r) => r.id));
  const places = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        landmarkDescription: r.landmark_description,
        category: r.category,
      },
    ]),
  );

  // T4.3 — coverage before any LLM call. Zero tokens spent to say "I don't know".
  if (rows.length < opts.minCandidates) {
    return refuse('INSUFFICIENT_COVERAGE');
  }

  const fastPathPlaces: FastPathPlace[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    landmarkDescription: r.landmark_description,
    lat: r.lat,
    lon: r.lon,
    openAt: 0,
    closeAt: 1440,
  }));

  // T4.4 — deterministic fast path, zero inference.
  const fast = await answerDeterministic({
    text: input.text,
    language: input.language,
    lat: input.lat,
    lon: input.lon,
    places: fastPathPlaces,
    inference: opts.inference,
    ...(resolvedCategory ? { categoryOverride: resolvedCategory } : {}),
  });
  if (fast) {
    const artifact = groundFromVerifiedRows(fast.stops, verifiedIds);
    const ids = [...artifact.placeIds];
    // An answer citing zero verified places is not an answer (§7.3) — it is
    // unmet demand wearing an answer's clothes. Refuse so the gap agent sees it.
    if (ids.length === 0) return refuse('NO_GROUNDED_STOPS');
    const questionId = await record(true, ids, null);
    const sugg = await followUps(ids);
    return {
      kind: 'answer',
      text: renderItinerary(artifact, places, input.language),
      placeIds: ids,
      ...(questionId ? { questionId } : {}),
      ...(sugg ? { suggestions: sugg } : {}),
    };
  }

  // Single-topic honesty: a question the lexicon places in exactly ONE
  // category is answered from that category only — "where can I hear live
  // music?" must refuse (and fund a mission) rather than cite arepa places.
  // Cross-category questions keep the whole catalog; a day plan is the
  // point of those. Grounding is untouched: a subset of a grounded set is
  // grounded.
  const hits = categoryHits(input.text);
  const singleCategory: string | null = resolvedCategory
    ? resolvedCategory // lexicon missed; the model placed it in ONE category
    : hits.length === 1
      ? hits[0]!
      : null;
  const catalogRows = singleCategory
    ? rows.filter((r) => r.category === singleCategory)
    : rows;
  if (catalogRows.length < opts.minCandidates) {
    return refuse('INSUFFICIENT_COVERAGE');
  }

  // T4.5 — the guarded model path, wired. The catalog IS the retrieved rows;
  // the model's only vocabulary is their integer refs; assertGrounded (10
  // steps, in-memory re-read) mints the artifact; the re-mint below is the
  // second, render-boundary check against the verified set we actually hold.
  const outcome = await runGroundedPlanner({
    text: input.text,
    language: input.language,
    rows: catalogRows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      verificationStatus: r.verification_status,
      witnessCount: r.witness_count,
    })),
    inference: opts.inference,
    // The refusal itself is the demand record: refuse() below writes the
    // question row the gap agent clusters on — no separate gap log needed.
    onGap: () => undefined,
  });

  if (outcome.kind === 'PlanArtifact') {
    // Re-check the planner's ids against the verified rows we actually hold —
    // defence in depth at the render boundary, and the only legal mint.
    const artifact = groundFromVerifiedRows(
      outcome.artifact.stops.map((s) => ({
        placeId: s.placeId,
        dayIndex: s.dayIndex,
        startMin: s.startMin,
        durationMin: s.durationMin,
        reasonCode: s.reasonCode,
      })),
      verifiedIds,
    );
    const ids = [...artifact.placeIds];
    if (ids.length === 0) return refuse('NO_GROUNDED_STOPS');
    const questionId = await record(true, ids, null);
    const sugg = await followUps(ids);
    return {
      kind: 'answer',
      text: renderItinerary(artifact, places, input.language),
      placeIds: ids,
      ...(questionId ? { questionId } : {}),
      ...(sugg ? { suggestions: sugg } : {}),
    };
  }

  if (outcome.kind === 'RefusalArtifact') {
    return refuse(outcome.reason);
  }
  return refuse('PLANNER_ERROR');
}

export interface TripResult {
  kind: 'trip' | 'refusal';
  text: string;
  placeIds: string[];
  /** Present on success — the saved, shareable trip. */
  trip?: Trip;
  questionId?: string;
}

/**
 * Deterministic catalog ranking: blend where a place is (distance rank,
 * which findVerifiedNear already computed) with how much recorded demand
 * and engagement it has (trend rank). The guard only cares about catalog
 * MEMBERSHIP, so ranking cannot weaken grounding — but it decides which
 * verified places the model is even offered, which is the honest way to
 * make "trending" mean something without letting the model freestyle.
 */
export function rankCatalog(
  rows: readonly PlaceRow[],
  trendScores: ReadonlyMap<string, number>,
  interests: readonly string[],
): PlaceRow[] {
  // rows arrive distance-ordered (rank 0 = nearest).
  const distRank = new Map(rows.map((r, i) => [r.id, i]));
  const byTrend = [...rows].sort(
    (a, b) => (trendScores.get(b.id) ?? 0) - (trendScores.get(a.id) ?? 0),
  );
  const trendRank = new Map(byTrend.map((r, i) => [r.id, i]));
  const interestSet = new Set(interests);

  return [...rows]
    .map((r) => {
      const blend =
        0.6 * (distRank.get(r.id) ?? rows.length) +
        0.4 * (trendRank.get(r.id) ?? rows.length);
      // A stated interest lifts a place without ever hiding the rest.
      const lift = interestSet.has(r.category) ? -rows.length : 0;
      return { row: r, score: blend + lift };
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.row);
}

/** Keep at most `maxPerDay` stops of each day, earliest first — deterministic. */
function trimToPace(stops: TripStop[], pace: TripPace): TripStop[] {
  const maxPerDay = PACE_STOPS_PER_DAY[pace];
  const kept = new Map<number, TripStop[]>();
  for (const s of [...stops].sort((a, b) => a.startMin - b.startMin)) {
    const day = kept.get(s.dayIndex) ?? [];
    if (day.length < maxPerDay) {
      day.push(s);
      kept.set(s.dayIndex, day);
    }
  }
  // Restore the artifact's original ordering (day, then time).
  return stops.filter((s) => {
    const day = kept.get(s.dayIndex) ?? [];
    return day.includes(s);
  });
}

/**
 * The trip path: the same guarded pipeline as ask(), shaped by days and
 * pace, ranked by distance × trend, saved as a shareable trip. Every exit
 * records the question — a refused trip request is as much a demand signal
 * as a refused ask.
 */
export async function planTrip(
  pool: Pool,
  input: {
    touristId: string;
    text: string;
    language: string;
    lat: number;
    lon: number;
    days: number;
    pace: TripPace;
    interests?: readonly string[];
  },
  opts: { minCandidates: number; inference: Inference },
): Promise<TripResult> {
  const intent = extractIntent(input.text);
  let resolvedCategory: string | null = null;

  const record = async (
    answered: boolean,
    placeIds: string[],
    refusalReason: string | null,
  ): Promise<string | undefined> => {
    try {
      const rec = await recordQuestion(pool, {
        rawText: input.text,
        language: input.language,
        category: intent.category,
        lat: input.lat,
        lon: input.lon,
        answered,
        answerPlaceIds: placeIds,
        refusalReason,
      });
      return rec.questionId;
    } catch {
      return undefined;
    }
  };

  const refuse = async (reason: string): Promise<TripResult> => {
    const questionId = await record(false, [], reason);
    return {
      kind: 'refusal',
      text: REFUSAL_TEXT[input.language] ?? REFUSAL_TEXT.en!,
      placeIds: [],
      ...(questionId ? { questionId } : {}),
    };
  };

  if (!classifiesIntent(input.text)) {
    resolvedCategory = await classifyWithModel(opts.inference, input.text);
    if (!resolvedCategory) return refuse('UNCLEAR_QUESTION');
    intent.category = resolvedCategory as typeof intent.category;
  }

  const rows = await q.places.findVerifiedNear(pool, input.lat, input.lon, 5000, undefined);
  const verifiedIds = new Set(rows.map((r) => r.id));

  if (rows.length < opts.minCandidates) {
    return refuse('INSUFFICIENT_COVERAGE');
  }

  const trends = await trendsForPlaces(pool, rows.map((r) => r.id));
  const trendScores = new Map(
    [...trends.entries()].map(([id, t]) => [id, t.score] as const),
  );
  const catalogRows = rankCatalog(rows, trendScores, input.interests ?? []).slice(0, 24);

  const outcome = await runGroundedPlanner({
    text: input.text,
    language: input.language,
    rows: catalogRows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      verificationStatus: r.verification_status,
      witnessCount: r.witness_count,
    })),
    days: input.days,
    inference: opts.inference,
    onGap: () => undefined,
  });

  if (outcome.kind !== 'PlanArtifact') {
    return refuse(outcome.kind === 'RefusalArtifact' ? outcome.reason : 'PLANNER_ERROR');
  }

  const stops: TripStop[] = outcome.artifact.stops.map((s) => ({
    placeId: s.placeId,
    dayIndex: s.dayIndex,
    startMin: s.startMin,
    durationMin: s.durationMin,
    reasonCode: TripReasonCode.parse(s.reasonCode),
  }));
  // Pace trim, then the render-boundary re-mint against the verified set.
  const trimmed = trimToPace(stops, input.pace);
  if (trimmed.length === 0) return refuse('NO_GROUNDED_STOPS');
  const artifact = groundFromVerifiedRows(
    trimmed.map((s) => ({ ...s })),
    verifiedIds,
  );
  const ids = [...artifact.placeIds];

  const places = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        landmarkDescription: r.landmark_description,
        category: r.category,
      },
    ]),
  );

  let trip: Trip | undefined;
  try {
    trip = await createTrip(pool, {
      touristId: input.touristId,
      question: input.text,
      language: input.language,
      stops: trimmed,
    });
  } catch {
    // The trip is the bonus, not the answer — a failed save must not cost
    // the guest their plan.
  }

  const questionId = await record(true, ids, null);
  return {
    kind: 'trip',
    text: renderItinerary(artifact, places, input.language),
    placeIds: ids,
    ...(trip ? { trip } : {}),
    ...(questionId ? { questionId } : {}),
  };
}
