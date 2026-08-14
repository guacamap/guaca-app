import type { Pool } from 'pg';

export interface RankedGap {
  id: string;
  category: string;
  h3_8: string;
  questionCount: number;
  distinctSessionCount: number;
  score: number;
  status: string;
}

/** `guaca gaps` — ranked open gaps with their current score. */
export async function rankedGaps(pool: Pool, areaId?: string): Promise<RankedGap[]> {
  const res = await pool.query(
    `select id, category, h3_8, question_count, distinct_session_count,
            score::float8 as score, status
     from gaps
     where status = 'open'
       and ($1::uuid is null or area_id = $1)
     order by score desc, question_count desc`,
    [areaId ?? null],
  );
  return res.rows as RankedGap[];
}

export interface OperatorCommissionInput {
  gapId: string;
  spotterId: string;
  brief: string;
  targetCategory: string;
  targetH3: string;
  rewardMinor: number;
  expiresInHours?: number;
}

/** Operator commission — created_by = 'operator', bypasses the agent's approval gate. */
export async function operatorCommission(
  pool: Pool,
  input: OperatorCommissionInput,
): Promise<{ status: 'offered' | 'blocked'; missionId?: string; reason?: string }> {
  const expires = new Date(Date.now() + (input.expiresInHours ?? 48) * 3_600_000);
  const res = await pool.query<{ id: string }>(
    `insert into missions
       (gap_id, spotter_id, brief, target_category, target_h3, reward_minor,
        currency, status, created_by, expires_at)
     values ($1, $2, $3, $4, $5, $6, 'USD', 'offered', 'operator', $7)
     on conflict (gap_id) where status in ('offered','accepted','submitted')
       do nothing
     returning id`,
    [input.gapId, input.spotterId, input.brief, input.targetCategory, input.targetH3, input.rewardMinor, expires],
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
