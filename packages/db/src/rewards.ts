import type { Pool } from 'pg';

/** Sum of append-only point deltas. Points are not money. */
export async function rewardBalance(pool: Pool, spotterId: string): Promise<number> {
  const res = await pool.query<{ balance: string | number }>(
    `select coalesce(sum(delta), 0) as balance from reward_ledger where spotter_id = $1`,
    [spotterId],
  );
  return Number(res.rows[0]?.balance ?? 0);
}
