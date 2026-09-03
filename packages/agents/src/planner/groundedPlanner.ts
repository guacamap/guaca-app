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
  /** Trip length in days, 1–7. Default 1 (a single-day plan). */
  days?: number;
  /** Called with the violation code when the guard refuses — logs the gap. */
  onGap: (reason: string) => Promise<void> | void;
  /** Minutes past midnight, local to the town; a single-day plan starts after it. */
  nowMin?: number;
  /** Hours with rain likely, e.g. "13:00–16:00"; the planner keeps open-air stops out of them. */
  rainWindows?: string;
}

export type GroundedOutcome =
  | { kind: 'RefusalArtifact'; reason: string }
  | { kind: 'PlanArtifact'; placeIds: readonly string[]; artifact: PlanArtifact }
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
  const days = Math.max(1, Math.min(7, options.days ?? 1));

  const refEnum = catalog.refEnum();
  const planSchema = z.object({
    stops: z
      .array(
        z.object({
          ref: z.number().int().positive(),
          dayIndex: z.number().int().min(0).max(days - 1),
          startMin: z.number().int().min(0).max(1439),
          durationMin: z.number().int().min(10).max(300),
          reasonCode: z.enum(['OPEN_NOW', 'NEAREST', 'MATCHES_TOPIC', 'BEST_RATED', 'AVOID_CLOSED', 'SEQUENCE_FIT']),
        }),
      )
      .min(1)
      .max(24),
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
          dayIndex: z.number().int().min(0).max(days - 1),
          startMin: z.number().int().min(0).max(1439),
          durationMin: z.number().int().min(10).max(300),
          reasonCode: z.enum(['OPEN_NOW', 'NEAREST', 'MATCHES_TOPIC', 'BEST_RATED', 'AVOID_CLOSED', 'SEQUENCE_FIT']),
        }),
      )
      .min(1)
      .max(24),
    languageCode: z.enum(['es', 'en', 'pt', 'fr', 'de', 'it', 'nl']),
  });

  // The guard refuses overlapping or back-to-back stops (step 7). A model
  // that is never told the rule fails it about a third of the time; told,
  // it almost never does. The rule is stated here in the model's own units.
  const timing =
    'startMin is minutes after midnight and durationMin is how long the stop lasts. Within a day, order stops by startMin, never overlap them, and leave at least 15 minutes between one stop ending and the next starting. Keep every stop between 07:00 (420) and 22:00 (1320).';
  // The tiers, in the model's units: prefer what a local stood in front of,
  // fill from what several open maps agree on, reach for a single listing
  // only when nothing better fits the ask.
  const clock = options.nowMin !== undefined && days === 1
    ? ` It is now ${String(Math.floor(options.nowMin / 60)).padStart(2, '0')}:${String(options.nowMin % 60).padStart(2, '0')} local time: the first stop starts after now, and if less than two hours of the day remain, plan one or two stops only.`
    : '';
  const rain = options.rainWindows
    ? ` Rain is likely ${options.rainWindows}: put beaches, walks, markets and anything open-air outside those hours, and museums, restaurants and indoor stops inside them.`
    : '';
  const tiers = 'Each entry carries a tier: verified (a local stood there), corroborated (several open maps agree), listed (one open map). Prefer verified, then corroborated, and use listed only when nothing better matches the ask.';
  const instruction =
    (days === 1
      ? `You plan a single day of visits from a catalog. Each stop references a catalog entry by its integer ref; dayIndex is always 0. ${timing} Never invent places. ${tiers}`
      : `You plan a ${days}-day trip from a catalog. Each stop references a catalog entry by its integer ref and carries dayIndex 0..${days - 1}. Every day from 0 to ${days - 1} gets at least two stops; at most 8 stops per day; do not repeat a place within the same day. ${timing} Never invent places. ${tiers}`) +
    clock + rain +
    `\n\nCatalog:\n${catalog.listing()}`;

  try {
    const res = await options.inference.json<z.infer<typeof requestSchema>>({
      schema: requestSchema,
      purpose: 'plan',
      // Pretty-printed JSON burns ~50 tokens per stop, and a trip may carry
      // eight stops a day up to the 24-stop cap. The old budget (700 at
      // most) cut every real two-day plan mid-object; the benchmark scored
      // both multi-day prompts as unparseable JSON. Decoding is schema
      // constrained, so a wide budget costs nothing on short answers.
      maxOutputTokens: Math.min(1500, 220 + 60 * Math.min(24, 8 * days)),
      system: instruction,
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

    // Trip-shape conformance is the PLANNER's job, not the guard's: the
    // guard proves every place is witnessed (dayIndex is just a bounded
    // integer to it); here we check the shape matches what was asked. A
    // provider that answers a 2-day request with a 6-day plan is refused
    // even though every stop in it is grounded.
    const maxDay = artifact.stops.reduce((m, s) => Math.max(m, s.dayIndex), 0);
    if (maxDay >= days) {
      await options.onGap('TRIP_SHAPE');
      return { kind: 'RefusalArtifact', reason: 'TRIP_SHAPE:day-span' };
    }

    return { kind: 'PlanArtifact', placeIds: artifact.placeIds, artifact };
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
