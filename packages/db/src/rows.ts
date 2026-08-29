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
  source: z.enum(['spotter', 'business', 'osm_candidate', 'overture_candidate']),
  verification_status: VerificationStatus,
  witness_count: z.number().int().min(0),
  created_by_spotter_id: z.string().uuid().nullable(),
  confirmed_by_spotter_id: z.string().uuid().nullable(),
  // pg returns timestamptz as Date; normalise to an ISO string either way.
  verified_at: z
    .union([z.string(), z.date()])
    .nullable()
    .transform((v) => (v instanceof Date ? v.toISOString() : v)),
  rejection_reason: z.string().nullable(),
  // Present when the query joins spotters (territory identity on pins).
  spotter_name: z.string().nullable().optional(),
  spotter_photo_url: z.string().nullable().optional(),
  // Public listing data (Overture, Foursquare); labelled public until a
  // local confirms it, which sets contact_confirmed_at.
  public_phone: z.string().nullable().optional(),
  public_website: z.string().nullable().optional(),
  public_socials: z.array(z.string()).nullable().optional(),
  public_address: z.string().nullable().optional(),
  public_source: z.string().nullable().optional(),
  contact_confirmed_at: z
    .union([z.string(), z.date()])
    .nullable()
    .optional()
    .transform((v) => (v instanceof Date ? v.toISOString() : v)),
});

export type PlaceRow = z.infer<typeof PlaceRowSchema>;
