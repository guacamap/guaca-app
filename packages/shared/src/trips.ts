import { z } from 'zod';
import { PlaceCategory } from './schemas.js';

/**
 * The trip contract — the API boundary for "plan me a trip". Everything the
 * model contributes downstream is integers and enums (the guard's regime);
 * this shape is what the SERVER stores and the CLIENT renders, so it lives
 * in the shared contract package where both are compile-checked against it.
 */

/** Mirrors the guard's ReasonCode — the honest reasons a stop was chosen. */
export const TripReasonCode = z.enum([
  'OPEN_NOW',
  'NEAREST',
  'MATCHES_TOPIC',
  'BEST_RATED',
  'AVOID_CLOSED',
  'SEQUENCE_FIT',
]);

export const TripPace = z.enum(['relaxed', 'balanced', 'packed']);

/** Stops per day the pace allows — enforced deterministically after the guard. */
export const PACE_STOPS_PER_DAY: Record<TripPace, number> = {
  relaxed: 3,
  balanced: 4,
  packed: 6,
};

export const TripStopSchema = z
  .object({
    placeId: z.string().uuid(),
    /** 0-based day within the trip. */
    dayIndex: z.number().int().min(0).max(6),
    /** Minutes since midnight. */
    startMin: z.number().int().min(0).max(1439),
    durationMin: z.number().int().min(10).max(300),
    reasonCode: TripReasonCode,
  })
  .strict();

export const TripRequestSchema = z
  .object({
    text: z.string().min(1),
    language: z.string().length(2),
    lat: z.number(),
    lon: z.number(),
    days: z.number().int().min(1).max(7).default(1),
    pace: TripPace.default('balanced'),
    /** Categories to bias toward (from the fixed taxonomy). */
    interests: z.array(PlaceCategory).max(8).optional(),
  })
  .strict();

export const TripSchema = z
  .object({
    id: z.string().uuid(),
    question: z.string().min(1),
    language: z.string().length(2),
    stops: z.array(TripStopSchema),
    shareSlug: z.string().min(6).max(64),
    createdAt: z.string().datetime(),
  })
  .strict();

export type TripPace = z.infer<typeof TripPace>;
export type TripStop = z.infer<typeof TripStopSchema>;
export type TripRequest = z.infer<typeof TripRequestSchema>;
export type Trip = z.infer<typeof TripSchema>;
