import { z } from 'zod';

export const ReasonCode = z.enum([
  'OPEN_NOW',
  'NEAREST',
  'MATCHES_TOPIC',
  'BEST_RATED',
  'AVOID_CLOSED',
  'SEQUENCE_FIT',
]);

/**
 * The planner's output contract — VERBATIM from plan §7.3. Integers and
 * enums only. There is deliberately no title/description/name field: a
 * hostile provider has no slot to name a place into. `.strict()` makes
 * extra keys fail structurally.
 */
export const PlanDraft = z
  .object({
    stops: z
      .array(
        z
          .object({
            ref: z.number().int().positive(),
            startMin: z.number().int().min(0).max(1439),
            durationMin: z.number().int().min(10).max(300),
            reasonCode: ReasonCode,
          })
          .strict(),
      )
      .min(1)
      .max(8),
    languageCode: z.enum(['es', 'en', 'pt', 'fr', 'de', 'it', 'nl']),
  })
  .strict();

export type PlanDraft = z.infer<typeof PlanDraft>;
