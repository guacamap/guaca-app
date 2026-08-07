import { z } from 'zod';
import { PlaceCategory, VerificationStatus } from '@guaca/shared';

/** Row parser for places — converts DB snake_case + geography into the shared Place shape. */
export const PlaceRowSchema = z.object({
  id: z.string().uuid(),
  area_id: z.string().uuid(),
  name: z.string().min(1),
  category: PlaceCategory,
  description: z.string().nullable(),
  landmark_description: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
  h3_8: z.string().min(1),
  open_hours: z.record(z.string(), z.string()).nullable(),
  price_band: z.number().int().min(1).max(4).nullable(),
  tags: z.array(z.string()),
  source: z.enum(['spotter', 'business', 'osm_candidate']),
  verification_status: VerificationStatus,
  witness_count: z.number().int().min(0),
  created_by_spotter_id: z.string().uuid().nullable(),
  confirmed_by_spotter_id: z.string().uuid().nullable(),
  verified_at: z.string().datetime().nullable(),
  rejection_reason: z.string().nullable(),
});

export type PlaceRow = z.infer<typeof PlaceRowSchema>;
