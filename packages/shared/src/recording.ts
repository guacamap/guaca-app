import { z } from 'zod';
import { PlaceCategory } from './schemas.js';
import { LicensedImageSchema, UnverifiedDemoImageSchema } from './placeProfile.js';

/** Time-sensitive fact about a place, separate from the enduring profile. */
export const ObservationKind = z.enum(['schedule', 'access', 'service', 'condition']);
export type ObservationKind = z.infer<typeof ObservationKind>;

export const ObservationSourceKind = z.enum([
  'public_listing',
  'business_statement',
  'pending_local_check',
  'locally_confirmed',
]);
export type ObservationSourceKind = z.infer<typeof ObservationSourceKind>;

export const ObservationStatus = z.enum(['active', 'expired', 'superseded']);
export type ObservationStatus = z.infer<typeof ObservationStatus>;

export const PlaceObservationSchema = z.object({
  id: z.string().uuid(),
  placeId: z.string().uuid(),
  kind: ObservationKind,
  statementEn: z.string().min(1),
  statementEs: z.string().min(1),
  sourceKind: ObservationSourceKind,
  sourceLabel: z.string().min(1),
  observedAt: z.string().datetime(),
  validUntil: z.string().datetime().nullable(),
  status: ObservationStatus,
  evidencePhotoUrl: z.string().nullable(),
  createdBy: z.string().uuid().nullable(),
});
export type PlaceObservation = z.infer<typeof PlaceObservationSchema>;

/** A current fact is active and not past validUntil. */
export function observationIsCurrent(
  row: Pick<PlaceObservation, 'status' | 'validUntil'>,
  nowIso: string,
): boolean {
  if (row.status !== 'active') return false;
  if (row.validUntil === null) return true;
  return row.validUntil > nowIso;
}

export const TravelMode = z.enum(['walk', 'taxi', 'mixed']);
export type TravelMode = z.infer<typeof TravelMode>;

export const ActivityInterestTag = z.enum(['relax', 'adventure', 'culture', 'food']);
export type ActivityInterestTag = z.infer<typeof ActivityInterestTag>;

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  areaId: z.string().uuid(),
  slug: z.string().min(1),
  titleEn: z.string().min(1),
  titleEs: z.string().min(1),
  summaryEn: z.string().min(1),
  summaryEs: z.string().min(1),
  coverImage: z.union([LicensedImageSchema, UnverifiedDemoImageSchema]).optional(),
  placeIds: z.array(z.string().uuid()).min(1),
  category: PlaceCategory,
  estimatedDurationMin: z.number().int().positive(),
  travelMode: TravelMode,
  interestTags: z.array(ActivityInterestTag).min(1),
  suggestedWindow: z.enum(['morning', 'afternoon', 'sunset', 'evening']).nullable(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const StaySchema = z.object({
  id: z.string().uuid(),
  placeId: z.string().uuid(),
  merchantId: z.string().uuid().nullable(),
  roomTypeEn: z.string().min(1),
  roomTypeEs: z.string().min(1),
  amenities: z.array(z.string()),
  currency: z.string().length(3),
  nightlyPriceMinor: z.number().int().nonnegative(),
  guestsMax: z.number().int().positive(),
  timezone: z.string().min(1),
});
export type Stay = z.infer<typeof StaySchema>;

export const ReservationStatus = z.enum([
  'requested',
  'confirmed',
  'declined',
  'expired',
  'cancelled',
  'completed',
]);
export type ReservationStatus = z.infer<typeof ReservationStatus>;

export const ReservationSchema = z
  .object({
    id: z.string().uuid(),
    stayId: z.string().uuid(),
    merchantId: z.string().uuid(),
    touristId: z.string().uuid(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    guests: z.number().int().positive(),
    nightlyPriceMinor: z.number().int().nonnegative(),
    currency: z.string().length(3),
    status: ReservationStatus,
    referenceCode: z.string().min(1),
    holdExpiresAt: z.string().datetime().nullable(),
    note: z.string().nullable(),
  })
  .refine((r) => r.checkOut > r.checkIn, 'checkOut must be after checkIn (half-open nights)');
export type Reservation = z.infer<typeof ReservationSchema>;

export const CreateStayReservationRequestSchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(12),
  note: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).max(80),
});
export type CreateStayReservationRequest = z.infer<typeof CreateStayReservationRequestSchema>;

export const RewardCatalogItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  titleEn: z.string().min(1),
  titleEs: z.string().min(1),
  descriptionEn: z.string().min(1),
  descriptionEs: z.string().min(1),
  pointCost: z.number().int().positive(),
  kind: z.enum(['cap', 'bottle', 'voucher']),
});
export type RewardCatalogItem = z.infer<typeof RewardCatalogItemSchema>;

export const RewardLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  spotterId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().min(1),
  missionId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type RewardLedgerEntry = z.infer<typeof RewardLedgerEntrySchema>;

export const RedemptionSchema = z.object({
  id: z.string().uuid(),
  spotterId: z.string().uuid(),
  catalogId: z.string().uuid(),
  missionId: z.string().uuid().nullable(),
  pointsSpent: z.number().int().positive(),
  receiptCode: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Redemption = z.infer<typeof RedemptionSchema>;

export const TouristEntitlementSchema = z.object({
  touristId: z.string().uuid(),
  planCode: z.string().min(1),
  status: z.enum(['active', 'expired']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  source: z.string().min(1),
});
export type TouristEntitlement = z.infer<typeof TouristEntitlementSchema>;

export const MerchantMembershipSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  stayId: z.string().uuid(),
  placeId: z.string().uuid(),
  role: z.enum(['owner', 'staff']),
});
export type MerchantMembership = z.infer<typeof MerchantMembershipSchema>;
