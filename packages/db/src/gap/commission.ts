import type { Pool } from 'pg';

export interface CommissionInput {
  gapId: string;
  spotterId: string;
  brief: string;
  targetCategory: string;
  targetH3: string;
  rewardMinor: number;
  maxRewardMinor: number;
  dailyCap: number;
  missionsToday: number;
  currency?: string;
  expiresInHours?: number;
}

export type CommissionResult =
  | { status: 'offered'; missionId: string }
  | { status: 'needs_approval'; reason: string }
  | { status: 'blocked'; reason: string };

/**
 * T5.5 — commissioning with ALL three guards (§7.5):
 * 1. duplicate-mission partial unique index (missions_one_open_per_gap)
 * 2. daily cap
 * 3. reward cap → needs_approval (the operator interrupt seam)
 * `commission` uses ON CONFLICT DO NOTHING RETURNING id for idempotency.
 */
export async function commissionMission(
  pool: Pool,
  input: CommissionInput,
): Promise<CommissionResult> {
  if (input.missionsToday >= input.dailyCap) {
    return { status: 'blocked', reason: 'daily cap reached' };
  }
  if (input.rewardMinor > input.maxRewardMinor) {
    return {
      status: 'needs_approval',
      reason: `reward ${input.rewardMinor} > max ${input.maxRewardMinor}`,
    };
  }

  const expires = new Date(
    Date.now() + (input.expiresInHours ?? 48) * 3_600_000,
  );
  const res = await pool.query<{ id: string }>(
    `insert into missions
       (gap_id, spotter_id, brief, target_category, target_h3, reward_minor,
        currency, status, created_by, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, 'offered', 'agent', $8)
     on conflict (gap_id) where status in ('offered','accepted','submitted')
       do nothing
     returning id`,
    [
      input.gapId,
      input.spotterId,
      input.brief,
      input.targetCategory,
      input.targetH3,
      input.rewardMinor,
      input.currency ?? 'USD',
      expires,
    ],
  );
  if (res.rows.length === 0) {
    return { status: 'blocked', reason: 'gap already has an open mission' };
  }
  // Advance the gap's lifecycle — demand with an open mission is
  // `commissioned`, so the audit and the cluster cycle stop re-raising it.
  await pool.query(
    `update gaps set status = 'commissioned', updated_at = now()
     where id = $1 and status = 'open'`,
    [input.gapId],
  );
  return { status: 'offered', missionId: res.rows[0]!.id };
}
