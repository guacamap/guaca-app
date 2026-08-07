import type { Pool } from 'pg';

export interface EarningRow {
  missionId: string;
  brief: string;
  status: string;
  rewardMinor: number;
  currency: string;
  payoutStatus: string | null;
  paidAt: Date | null;
}

/** T7.6 — a spotter's mission history with payout status. */
export async function spotterEarnings(
  pool: Pool,
  spotterId: string,
): Promise<EarningRow[]> {
  const res = await pool.query(
    `select m.id as "missionId", m.brief, m.status, m.reward_minor as "rewardMinor",
            m.currency, p.status as "payoutStatus", p.created_at as "paidAt"
     from missions m
     left join payouts p on p.mission_id = m.id
     where m.spotter_id = $1
     order by m.offered_at desc`,
    [spotterId],
  );
  return res.rows as EarningRow[];
}
