import { z } from 'zod';

/** Editorial public information is separate from evidence of a local visit. */

const imageShape = {
  url: z.string().regex(/^\/demo\/[a-z-]+\/[a-z-]+\.(jpg|webp)$/),
  credit: z.string(),
  sourceUrl: z.string().url().regex(/^https:\/\//),
  /** Said when the photo shows the setting rather than the venue ("the Malecón, which it faces"). */
  caption: z.object({ en: z.string(), es: z.string() }).optional(),
};

/** A photo whose redistribution rights are established: a real licence, never a made-up label. */
export const LicensedImageSchema = z.object({
  ...imageShape,
  /** A real licence that allows redistribution. */
  license: z.enum(['CC0', 'Public domain', 'CC BY 2.0', 'CC BY 2.5', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 2.0', 'CC BY-SA 2.5', 'CC BY-SA 3.0', 'CC BY-SA 4.0']),
  licenseUrl: z.string().url().regex(/^https:\/\//),
});

/** A photo kept for the local demo whose reuse rights are not established. Demo intent is not a licence;
 * the rights status is stated instead of a licence so no label is invented. */
export const UnverifiedDemoImageSchema = z.object({
  ...imageShape,
  rights: z.literal('unverified-demo-only'),
});

export const PublicPlaceProfileSchema = z.object({
  demo: z.literal(true),
  researchedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.object({ en: z.string(), es: z.string() }),
  /** How the place is usually reached: approximate public knowledge, never a confirmed timetable. */
  gettingThere: z.object({ en: z.string(), es: z.string() }).optional(),
  image: z.union([LicensedImageSchema, UnverifiedDemoImageSchema]).optional(),
  sources: z.array(z.object({ label: z.string(), url: z.string().url().regex(/^https:\/\//) })).min(1),
});

export type LicensedImage = z.infer<typeof LicensedImageSchema>;
export type UnverifiedDemoImage = z.infer<typeof UnverifiedDemoImageSchema>;
export type PublicPlaceProfile = z.infer<typeof PublicPlaceProfileSchema>;
