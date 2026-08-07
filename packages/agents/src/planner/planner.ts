import type { Inference } from '../inference/types.js';

export interface PlannerInput {
  text: string;
  language: string;
  areaId: string;
  lat: number;
  lon: number;
}

export interface PlannerDb {
  findVerifiedNear(
    lat: number,
    lon: number,
    radiusM: number,
    category?: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      category: string;
      landmarkDescription: string;
      lat: number;
      lon: number;
    }>
  >;
}

export type PlannerOutcome =
  | { kind: 'RefusalArtifact'; reason: string }
  | { kind: 'PlanArtifact'; placeIds: readonly string[] }
  | { kind: 'error'; message: string };

export interface RunPlannerOptions {
  input: PlannerInput;
  db: PlannerDb;
  inference: Inference;
  minCandidates: number;
  radiusM?: number;
}

/**
 * The planner's entry point. Coverage check runs BEFORE any LLM call (§7.3
 * point 7): insufficient candidates → deterministic refusal, zero tokens
 * spent, gap logged downstream. We do not pay to say "I don't know."
 */
export async function runPlanner(
  options: RunPlannerOptions,
): Promise<PlannerOutcome> {
  const { input, db, inference, minCandidates, radiusM = 2000 } = options;

  const candidates = await db.findVerifiedNear(
    input.lat,
    input.lon,
    radiusM,
    undefined,
  );

  if (candidates.length < minCandidates) {
    return { kind: 'RefusalArtifact', reason: 'INSUFFICIENT_COVERAGE' };
  }

  try {
    // Model path — full planner graph (T4.5 wires the guard here).
    const res = await inference.json<{ ok: boolean }>({
      schema: (await import('zod')).z.object({ ok: (await import('zod')).z.boolean() }),
      purpose: 'plan',
      maxOutputTokens: 100,
      system: 'Plan from the catalog',
      user: input.text,
    });
    return { kind: 'PlanArtifact', placeIds: [] };
  } catch (e) {
    return { kind: 'error', message: (e as Error).message };
  }
}
