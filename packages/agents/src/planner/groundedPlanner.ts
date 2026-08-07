import { z } from 'zod';
import { Catalog } from '../catalog/catalog.js';
import {
  assertGrounded,
  GuardViolation,
  type PlanArtifact,
  type PlaceRowForGuard,
} from '../guard/assertGrounded.js';
import { PlanDraft } from '../guard/planDraft.js';
import { lexicalSweep } from '../guard/lexicalSweep.js';
import type { Inference } from '../inference/types.js';

export interface GroundedPlannerOptions {
  text: string;
  language: string;
  rows: readonly PlaceRowForGuard[];
  inference: Inference;
  /** Called with the violation code when the guard refuses — logs the gap. */
  onGap: (reason: string) => Promise<void> | void;
}

export type GroundedOutcome =
  | { kind: 'RefusalArtifact'; reason: string }
  | { kind: 'PlanArtifact'; placeIds: readonly string[] }
  | { kind: 'error'; message: string };

/**
 * T4.5 — the planner's model path, guard-wired. Retrieval rows build the
 * Catalog; catalog.refEnum() becomes the model's only vocabulary; the raw
 * response passes assertGrounded (all 10 steps); any GuardViolation routes
 * to a typed RefusalArtifact + a gap row. NEVER a degraded answer.
 */
export async function runGroundedPlanner(
  options: GroundedPlannerOptions,
): Promise<GroundedOutcome> {
  const catalog = Catalog.build(options.rows);

  const refEnum = catalog.refEnum();
  const planSchema = z.object({
    stops: z
      .array(
        z.object({
          ref: z.number().int().positive(),
          startMin: z.number().int().min(0).max(1439),
          durationMin: z.number().int().min(10).max(300),
          reasonCode: z.enum(['OPEN_NOW', 'NEAREST', 'MATCHES_TOPIC', 'BEST_RATED', 'AVOID_CLOSED', 'SEQUENCE_FIT']),
        }),
      )
      .min(1)
      .max(8),
    languageCode: z.enum(['es', 'en', 'pt', 'fr', 'de', 'it', 'nl']),
  });

  // The model request schema embeds the catalog's integer ref enum — the
  // only placeIds-free channel the model can answer with. The enum values
  // are literal in the schema so constrained decoding sees them.
  const refEnumValues = refEnum.enum;
  const requestSchema = z.object({
    stops: z
      .array(
        z.object({
          ref: (refEnumValues.length === 1
            ? z.literal(refEnumValues[0]!)
            : z.union(
                refEnumValues.map((r) => z.literal(r)) as unknown as [
                  z.ZodTypeAny,
                  z.ZodTypeAny,
                  ...z.ZodTypeAny[],
                ],
              )) as z.ZodType<number>,
          startMin: z.number().int().min(0).max(1439),
          durationMin: z.number().int().min(10).max(300),
          reasonCode: z.enum(['OPEN_NOW', 'NEAREST', 'MATCHES_TOPIC', 'BEST_RATED', 'AVOID_CLOSED', 'SEQUENCE_FIT']),
        }),
      )
      .min(1)
      .max(8),
    languageCode: z.enum(['es', 'en', 'pt', 'fr', 'de', 'it', 'nl']),
  });

  try {
    const res = await options.inference.json<z.infer<typeof requestSchema>>({
      schema: requestSchema,
      purpose: 'plan',
      maxOutputTokens: 200,
      system:
        'You plan visits from a catalog. Each stop references a catalog entry by its integer ref. Never invent places.',
      user: options.text,
      untrusted: options.text,
    });

    const raw = res.raw as unknown as PlanDraft;
    const artifact: PlanArtifact = await assertGrounded(raw, catalog, {
      fingerprint: catalog.fingerprint,
      reReadVerified: async (ids) =>
        options.rows.filter((r) => ids.includes(r.id)),
      lexicalSweep: (draft) => {
        // Sweep only the string VALUES of the draft (there are none besides
        // languageCode) plus the untrusted question — JSON keys are structure,
        // not prose, and would false-positive.
        const stringValues = Object.values(draft).flatMap((v) =>
          typeof v === 'string' ? [v] : [],
        );
        return lexicalSweep(
          [...stringValues, options.text].join(' '),
          options.rows.map((r) => r.name),
        );
      },
    });

    return { kind: 'PlanArtifact', placeIds: artifact.placeIds };
  } catch (e) {
    if (e instanceof GuardViolation) {
      await options.onGap(e.code);
      return { kind: 'RefusalArtifact', reason: `GUARD_VIOLATION:${e.code}` };
    }
    if (e instanceof z.ZodError) {
      await options.onGap('SCHEMA');
      return { kind: 'RefusalArtifact', reason: 'GUARD_VIOLATION:SCHEMA' };
    }
    return { kind: 'error', message: (e as Error).message };
  }
}
