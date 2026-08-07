import type { Pool } from 'pg';

export interface NearDuplicatePlace {
  id: string;
  name: string;
  distanceM: number;
}

/**
 * Near-duplicate place check (rung L3's companion): a new place within 20m
 * of an existing same-name place flags near-duplicate. PostGIS distance +
 * name similarity are both computed in SQL so no rows cross the wire.
 */
export async function findNearDuplicatePlace(
  pool: Pool,
  lat: number,
  lon: number,
  name: string,
  radiusM = 20,
): Promise<NearDuplicatePlace | null> {
  const res = await pool.query<NearDuplicatePlace>(
    `select p.id, p.name,
            ST_Distance(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)::float8 as "distanceM"
     from places p
     where p.verification_status in ('verified', 'pending', 'provisional')
       and ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       and lower(p.name) = lower($4)
     order by "distanceM" asc
     limit 1`,
    [lat, lon, radiusM, name],
  );
  return res.rows[0] ?? null;
}
