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
}

/** T7.2 — the missions offered to one spotter, newest first. */
export async function missionsForSpotter(
  pool: Pool,
  spotterId: string,
): Promise<SpotterMission[]> {
  const res = await pool.query(
    `select id, brief, target_category, target_h3, reward_minor, currency, status, expires_at
     from missions
     where spotter_id = $1
     order by offered_at desc`,
    [spotterId],
  );
  // Explicit mapping — the same lying-cast that fed NULLs into payouts.
  return res.rows.map((r) => ({
    id: r.id as string,
    brief: r.brief as string,
    targetCategory: r.target_category as string,
    targetH3: r.target_h3 as string,
    rewardMinor: r.reward_minor as number,
    currency: r.currency as string,
    status: r.status as string,
    expiresAt: r.expires_at as Date,
  }));
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
