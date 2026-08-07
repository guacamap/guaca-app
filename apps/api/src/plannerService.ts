import type { Pool } from 'pg';
import {
  answerDeterministic,
  extractIntent,
  groundFromVerifiedRows,
  renderItinerary,
  runPlanner,
  type FastPathPlace,
} from '@guaca/agents';
import { q, recordQuestion } from '@guaca/db';

export interface AskResult {
  kind: 'answer' | 'refusal';
  text: string;
  placeIds: string[];
  /** The persisted question — the demand signal the gap agent later reads. */
  questionId?: string;
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
  });
  if (fast) {
    const artifact = groundFromVerifiedRows(fast.stops, verifiedIds);
    const ids = [...artifact.placeIds];
    const questionId = await record(true, ids, null);
    return {
      kind: 'answer',
      text: renderItinerary(artifact, places, input.language),
      placeIds: ids,
      ...(questionId ? { questionId } : {}),
    };
  }

  // T4.5 — guarded model path.
  const outcome = await runPlanner({
    input: {
      text: input.text,
      language: input.language,
      areaId: '00000000-0000-4000-8000-00000000000a',
      lat: input.lat,
      lon: input.lon,
    },
    db: {
      findVerifiedNear: async (lat, lon, radiusM, category) =>
        q.places.findVerifiedNear(pool, lat, lon, radiusM, category).then((rs) =>
          rs.map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            landmarkDescription: r.landmark_description,
            lat: r.lat,
            lon: r.lon,
          })),
        ),
    },
    inference: opts.inference,
    minCandidates: opts.minCandidates,
  });

  if (outcome.kind === 'PlanArtifact') {
    // Re-check the planner's ids against the verified rows we actually hold —
    // defence in depth at the render boundary, and the only legal mint.
    const artifact = groundFromVerifiedRows(
      outcome.placeIds.map((id, i) => ({
        placeId: id,
        startMin: 540 + i * 75,
        durationMin: 60,
        reasonCode: 'MATCHES_TOPIC',
      })),
      verifiedIds,
    );
    const ids = [...artifact.placeIds];
    const questionId = await record(true, ids, null);
    return {
      kind: 'answer',
      text: renderItinerary(artifact, places, input.language),
      placeIds: ids,
      ...(questionId ? { questionId } : {}),
    };
  }

  if (outcome.kind === 'RefusalArtifact') {
    return refuse(outcome.reason);
  }
  return refuse('PLANNER_ERROR');
}
