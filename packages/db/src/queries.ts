import type { Pool } from 'pg';
import { PlaceRowSchema } from './rows.js';

/**
 * Verified-only place retrieval, ordered by distance from the given point.
 * Candidates/provisional/pending never reach a tourist-facing path from here.
 */
export async function findVerifiedNear(
  pool: Pool,
  lat: number,
  lon: number,
  radiusM: number,
  category?: string,
) {
  const res = await pool.query(
    `select
       p.id, p.area_id, p.name, p.category, p.description,
       p.landmark_description,
       ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon,
       p.h3_8, p.open_hours, p.price_band, p.tags, p.source,
       p.verification_status, p.witness_count,
       p.created_by_spotter_id, p.confirmed_by_spotter_id,
       p.verified_at, p.rejection_reason,
       ST_Distance(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as dist_m
     from places p
     where p.verification_status = 'verified'
       and p.witness_count >= 2
       and ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       and ($4::text is null or p.category = $4)
     order by dist_m asc
     limit 100`,
    [lat, lon, radiusM, category ?? null],
  );
  return res.rows.map((r) => PlaceRowSchema.parse(r));
}

export const q = {
  places: {
    findVerifiedNear,
  },
};
