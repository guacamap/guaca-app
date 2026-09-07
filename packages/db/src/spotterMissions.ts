import type { Pool } from 'pg';

export interface SpotterMission {
  id: string;
  brief: string;
  targetCategory: string;
  targetH3: string;
  rewardMinor: number;
  currency: string;
  status: string;
  expiresAt: Date;
  taskKind: 'hours' | 'access' | 'evidence' | null;
  placeId: string | null;
  placeName: string | null;
  photoUrl: string | null;
  lat: number | null;
  lon: number | null;
  expectedEvidenceEn: string | null;
  expectedEvidenceEs: string | null;
  mine: boolean;
}

/** T7.2 — the missions offered to one spotter, newest first. */
export async function missionsForSpotter(
  pool: Pool,
  spotterId: string,
): Promise<SpotterMission[]> {
  const res = await pool.query(
    `select m.id, m.brief, m.target_category, m.target_h3, m.reward_minor, m.currency,
            m.status, m.expires_at, m.task_kind, m.result_place_id,
            p.name as place_name,
            p.public_profile->'image'->>'url' as photo_url,
            ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon
       from missions m
       left join places p on p.id = m.result_place_id
      where m.spotter_id = $1
      order by m.offered_at desc`,
    [spotterId],
  );
  return res.rows.map((r) => mapMission(r, true));
}

/** Area missions a Spotter can see: their own, plus submitted work waiting on a second local. */
export async function missionsOnSpotterMap(
  pool: Pool,
  spotterId: string,
): Promise<SpotterMission[]> {
  const area = await pool.query<{ area_id: string }>(
    `select area_id from spotters where id = $1`,
    [spotterId],
  );
  const areaId = area.rows[0]?.area_id;
  if (!areaId) return missionsForSpotter(pool, spotterId);
  const res = await pool.query(
    `select m.id, m.brief, m.target_category, m.target_h3, m.reward_minor, m.currency,
            m.status, m.expires_at, m.task_kind, m.result_place_id, m.spotter_id,
            p.name as place_name,
            p.public_profile->'image'->>'url' as photo_url,
            ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon
       from missions m
       left join places p on p.id = m.result_place_id
      where (m.spotter_id = $1)
         or (m.status = 'submitted' and m.spotter_id <> $1 and p.area_id = $2)
      order by m.offered_at desc`,
    [spotterId, areaId],
  );
  return res.rows.map((r) => mapMission(r, r.spotter_id === spotterId));
}

function mapMission(r: Record<string, unknown>, mine: boolean): SpotterMission {
  const kind = r.task_kind;
  return {
    id: r.id as string,
    brief: r.brief as string,
    targetCategory: r.target_category as string,
    targetH3: r.target_h3 as string,
    rewardMinor: r.reward_minor as number,
    currency: r.currency as string,
    status: r.status as string,
    expiresAt: r.expires_at as Date,
    taskKind: kind === 'hours' || kind === 'access' || kind === 'evidence' ? kind : null,
    placeId: (r.result_place_id as string | null) ?? null,
    placeName: (r.place_name as string | null) ?? null,
    photoUrl: (r.photo_url as string | null) ?? null,
    lat: r.lat == null ? null : Number(r.lat),
    lon: r.lon == null ? null : Number(r.lon),
    expectedEvidenceEn: null,
    expectedEvidenceEs: null,
    mine,
  };
}

export interface AcceptResult {
  ok: boolean;
  reason?: string;
}

/** T7.2 — a spotter accepts their own offered mission. */
export async function acceptMission(
  pool: Pool,
  missionId: string,
  spotterId: string,
): Promise<AcceptResult> {
  const res = await pool.query(
    `update missions
       set status = 'accepted', accepted_at = now()
     where id = $1 and spotter_id = $2 and status = 'offered'
     returning id`,
    [missionId, spotterId],
  );
  if (res.rows.length > 0) return { ok: true };
  return { ok: false, reason: 'mission not offered to this spotter' };
}
