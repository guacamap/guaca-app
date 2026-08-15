import type { Pool, PoolClient } from 'pg';

/** Pool or a transaction client — the confirm flow runs atomically. */
export type Queryable = Pool | PoolClient;

export interface SecondLocalResult {
  ok: boolean;
  reason?: 'SELF_CONFIRMATION' | 'NOT_PROVISIONAL' | 'NOT_FOUND';
}

export interface PendingProvisional {
  id: string;
  name: string;
  landmarkDescription: string;
  category: string;
  distanceM: number;
  createdBySpotterId: string;
  lat: number;
  lon: number;
}

/**
 * T7.5 — provisional places near a point that a DIFFERENT spotter can see
 * and confirm. The confirmation itself uses confirmSecondLocal, which the
 * DB constraint backs up.
 */
export async function pendingProvisionalNear(
  pool: Pool,
  lat: number,
  lon: number,
  radiusM: number,
  excludeSpotterId?: string,
): Promise<PendingProvisional[]> {
  const res = await pool.query(
    `select p.id, p.name, p.landmark_description, p.category,
            ST_Distance(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)::float8 as "distanceM",
            p.created_by_spotter_id,
            ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon
     from places p
     where p.verification_status = 'provisional'
       and p.witness_count = 1
       and ($4::uuid is null or p.created_by_spotter_id <> $4)
       and exists (
         select 1 from verification_runs vr
         where vr.place_id = p.id
           and vr.decision in ('needs_second_local', 'verified')
       )
       and ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
     order by "distanceM" asc
     limit 20`,
    [lat, lon, radiusM, excludeSpotterId ?? null],
  );
  return res.rows as PendingProvisional[];
}

/**
 * Second-local confirmation (rung L6, plan §7.4). The place sits
 * `provisional` until a DIFFERENT spotter confirms; the DB constraint
 * verified_needs_two_locals is the backstop. Only this function may set
 * verification_status='verified'.
 */
export async function confirmSecondLocal(
  pool: Queryable,
  placeId: string,
  confirmingSpotterId: string,
): Promise<SecondLocalResult> {
  const res = await pool.query(
    `update places
       set verification_status = 'verified',
           witness_count = 2,
           confirmed_by_spotter_id = $2,
           verified_at = now()
     where id = $1
       and verification_status = 'provisional'
       and created_by_spotter_id is not null
       and confirmed_by_spotter_id is null
       and created_by_spotter_id <> $2
     returning id`,
    [placeId, confirmingSpotterId],
  );
  if (res.rows.length > 0) return { ok: true };

  const current = await pool.query<{
    verification_status: string;
    created_by_spotter_id: string | null;
    confirmed_by_spotter_id: string | null;
  }>(
    `select verification_status, created_by_spotter_id, confirmed_by_spotter_id
     from places where id = $1`,
    [placeId],
  );
  const row = current.rows[0];
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.verification_status !== 'provisional') {
    return { ok: false, reason: 'NOT_PROVISIONAL' };
  }
  if (row.created_by_spotter_id === confirmingSpotterId) {
    return { ok: false, reason: 'SELF_CONFIRMATION' };
  }
  return { ok: false, reason: 'NOT_PROVISIONAL' };
}
