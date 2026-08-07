import { z } from 'zod';

/** Place categories — the taxonomy lives in taxonomy.ts; this is the enum. */
export const PlaceCategory = z.enum([
  'eat_drink',
  'beach_water',
  'nature_walk',
  'culture_history',
  'market_shop',
  'services',
  'nightlife_music',
  'practical',
]);
export type PlaceCategory = z.infer<typeof PlaceCategory>;

export const VerificationStatus = z.enum([
  'candidate',
  'pending',
  'provisional',
  'verified',
  'rejected',
]);

/**
 * A verified place MUST have both a creator and an independent confirmer —
 * mirrors the DB constraint `verified_needs_two_locals`.
 */
export const PlaceSchema = z
  .object({
    id: z.string().uuid(),
    areaId: z.string().uuid(),
    name: z.string().min(1),
    category: PlaceCategory,
    description: z.string().nullable(),
    landmarkDescription: z.string().min(1),
    lat: z.number(),
    lon: z.number(),
    h3_8: z.string().min(1),
    openHours: z.record(z.string(), z.string()).nullable(),
    priceBand: z.number().int().min(1).max(4).nullable(),
    tags: z.array(z.string()),
    source: z.enum(['spotter', 'business', 'osm_candidate']),
    verificationStatus: VerificationStatus,
    witnessCount: z.number().int().min(0),
    createdBySpotterId: z.string().uuid().nullable(),
    confirmedBySpotterId: z.string().uuid().nullable(),
    verifiedAt: z.string().datetime().nullable(),
    rejectionReason: z.string().nullable(),
  })
  .refine(
    (p) =>
      p.verificationStatus !== 'verified' ||
      (p.createdBySpotterId !== null &&
        p.confirmedBySpotterId !== null &&
        p.confirmedBySpotterId !== p.createdBySpotterId),
    'verified place must have two distinct spotters',
  );

export type Place = z.infer<typeof PlaceSchema>;

export const MissionStatus = z.enum([
  'offered',
  'accepted',
  'submitted',
  'verified',
  'paid',
  'expired',
  'cancelled',
]);

export const MissionSchema = z.object({
  id: z.string().uuid(),
  gapId: z.string().uuid(),
  spotterId: z.string().uuid(),
  brief: z.string().min(1),
  targetCategory: PlaceCategory,
  targetH3: z.string().min(1),
  rewardMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: MissionStatus,
  createdBy: z.enum(['agent', 'operator']),
  resultPlaceId: z.string().uuid().nullable(),
  offeredAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  submittedAt: z.string().datetime().nullable(),
  paidAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  cancelReason: z.string().nullable(),
});

export type Mission = z.infer<typeof MissionSchema>;

export const GapStatus = z.enum(['open', 'commissioned', 'filled', 'dismissed']);

export const GapSchema = z.object({
  id: z.string().uuid(),
  areaId: z.string().uuid(),
  category: PlaceCategory,
  h3_8: z.string().min(1),
  questionCount: z.number().int().nonnegative(),
  distinctSessionCount: z.number().int().nonnegative(),
  payingPropertyMinor: z.number().int().nonnegative(),
  coverageDensity: z.number().nonnegative(),
  score: z.number().nonnegative(),
  lastAskedAt: z.string().datetime().nullable(),
  status: GapStatus,
});

export type Gap = z.infer<typeof GapSchema>;

export const QuestionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  areaId: z.string().uuid().nullable(),
  rawText: z.string().min(1),
  language: z.string().length(2),
  intent: z.record(z.string(), z.unknown()).nullable(),
  answered: z.boolean(),
  answerPlaceIds: z.array(z.string().uuid()),
  refusalReason: z.string().nullable(),
  gapId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export type Question = z.infer<typeof QuestionSchema>;
