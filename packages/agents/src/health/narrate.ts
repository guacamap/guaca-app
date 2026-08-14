import { z } from 'zod';
import type { Inference } from '../inference/types.js';
import type { MapHealthAnalysis } from './analyze.js';

const NarrativeSchema = z
  .object({
    summary: z.string().min(1).max(600),
    priorities: z.array(z.string().min(1).max(160)).min(1).max(5),
  })
  .strict();

export type HealthNarrative = z.infer<typeof NarrativeSchema>;

/**
 * The single optional inference call of the audit: turn the deterministic
 * findings into operator prose. The model narrates numbers it is given —
 * it cannot add places, spotters or figures the analysis does not contain,
 * and the audit is complete without it (returns null on any failure).
 */
export async function narrateMapHealth(
  inference: Inference,
  analysis: MapHealthAnalysis,
  language: 'en' | 'es' = 'en',
): Promise<HealthNarrative | null> {
  try {
    const result = await inference.json({
      schema: NarrativeSchema,
      purpose: 'map_health_narrative',
      maxOutputTokens: 350,
      system:
        'You are the map-health analyst for a verified-places travel map. ' +
        'Write a short operator-facing summary and up to 5 priorities, in the requested language. ' +
        'Use ONLY the findings and numbers provided in the data. Never invent places, spotters, or figures.',
      user: JSON.stringify({
        language,
        totals: analysis.totals,
        findings: analysis.findings,
        missionCandidates: analysis.missionCandidates,
      }),
    });
    return result.raw;
  } catch {
    return null;
  }
}
