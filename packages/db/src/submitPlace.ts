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
