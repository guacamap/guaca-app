import { z } from 'zod';

export const ReasonCode = z.enum([
  'OPEN_NOW',
  'NEAREST',
  'MATCHES_TOPIC',
  'BEST_RATED',
  'AVOID_CLOSED',
  'SEQUENCE_FIT',
]);

/** A trip spans at most 7 days (dayIndex 0..6). */
export const MAX_DAYS = 7;
/** At most 8 stops in any single day. */
export const MAX_STOPS_PER_DAY = 8;
/** At most 24 stops in a whole trip (3/day average — a holiday, not a marathon). */
export const MAX_STOPS_TOTAL = 24;

/**
 * The planner's output contract — VERBATIM from plan §7.3, extended once for
 * multi-day trips. Integers and enums only. There is deliberately no
 * title/description/name field: a hostile provider has no slot to name a
 * place into. `.strict()` makes extra keys fail structurally.
 *
 * `dayIndex` defaults to 0 — an output that omits it is a single-day plan,
 * exactly what every pre-multi-day draft was. Multi-day is an integer the
 * same way startMin is: bounded, projection-free, guard-checkable.
 */
export const PlanDraft = z
  .object({
    stops: z
      .array(
        z
          .object({
            ref: z.number().int().positive(),
            dayIndex: z.number().int().min(0).max(MAX_DAYS - 1).default(0),
            startMin: z.number().int().min(0).max(1439),
            durationMin: z.number().int().min(10).max(300),
            reasonCode: ReasonCode,
          })
          .strict(),
      )
      .min(1)
      .max(MAX_STOPS_TOTAL),
    languageCode: z.enum(['es', 'en', 'pt', 'fr', 'de', 'it', 'nl']),
  })
  .strict();

export type PlanDraft = z.infer<typeof PlanDraft>;
