import type { Pool } from 'pg';

export interface SubmitPlaceInput {
  name: string;
  category: string;
  landmarkDescription: string;
  lat: number;
  lon: number;
  h3_8: string;
  spotterId: string;
  areaId: string;
  priceBand?: number;
  openHours?: Record<string, string>;
  /**
   * Promote this open-data candidate (OSM/Overture) instead of inserting a
   * new row. The public phone, website, socials and address already on it
   * — the reason it existed as a candidate — survive onto the record a
   * spotter now vouches for; nothing about them is treated as confirmed by
   * that alone (contact_confirmed_at is untouched). The UPDATE's WHERE
   * clause is the whole race guard: a candidate already claimed by another
   * spotter's submission matches zero rows, no separate existence check
   * needed.
   */
  candidateId?: string;
}

export interface SubmitPlaceResult {
  ok: boolean;
  placeId?: string;
  reason?: string;
}

/**
 * T7.4 — a spotter's place submission. Always lands `provisional` with the
 * spotter as creator (witness 1); the verification ladder + a DIFFERENT
 * spotter's confirmation are required before `verified`.
 */
export async function submitPlace(
  pool: Pool,
  input: SubmitPlaceInput,
): Promise<SubmitPlaceResult> {
  if (input.candidateId) {
    const promoted = await pool.query<{ id: string }>(
      `update places set
         name = $1, category = $2, landmark_description = $3,
         location = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, h3_8 = $6,
         source = 'spotter', verification_status = 'provisional', witness_count = 1,
         created_by_spotter_id = $7, confirmed_by_spotter_id = null, verified_at = null,
         price_band = coalesce($8, price_band), open_hours = coalesce($9, open_hours),
         updated_at = now()
       where id = $10 and area_id = $11
         and verification_status = 'candidate' and source in ('osm_candidate', 'overture_candidate')
       returning id`,
      [
        input.name, input.category, input.landmarkDescription, input.lon, input.lat, input.h3_8,
        input.spotterId, input.priceBand ?? null, input.openHours ?? null, input.candidateId, input.areaId,
      ],
    );
    if (promoted.rows.length === 0) return { ok: false, reason: 'candidate already claimed or not found' };
    return { ok: true, placeId: promoted.rows[0]!.id };
  }
  const res = await pool.query<{ id: string }>(
    `insert into places
       (area_id, name, category, landmark_description, location, h3_8,
        source, verification_status, witness_count, created_by_spotter_id,
        price_band, open_hours)
     values ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
        $7, 'spotter', 'provisional', 1, $8, $9, $10)
     returning id`,
    [
      input.areaId,
      input.name,
      input.category,
      input.landmarkDescription,
      input.lon,
      input.lat,
      input.h3_8,
      input.spotterId,
      input.priceBand ?? null,
      input.openHours ?? null,
    ],
  );
  return { ok: true, placeId: res.rows[0]!.id };
}
