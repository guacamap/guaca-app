import type { Pool } from 'pg';

export interface MissionRow {
  id: string;
  gapId: string;
  spotterId: string;
  brief: string;
  status: string;
  rewardMinor: number;
  currency: string;
  createdBy: string;
  offeredAt: Date;
  expiresAt: Date;
}

/** `guaca missions` — list missions, newest first. */
export async function listMissions(pool: Pool, status?: string): Promise<MissionRow[]> {
  const res = await pool.query(
    `select id, gap_id, spotter_id, brief, status, reward_minor, currency,
            created_by, offered_at, expires_at
     from missions
     where ($1::text is null or status = $1)
     order by offered_at desc`,
    [status ?? null],
  );
  return res.rows as MissionRow[];
}

export interface CancelResult {
  ok: boolean;
  reason?: string;
}

/**
 * `guaca override <missionId> --cancel --reason` — audited operator cancel.
 * Writes an operator_actions row with before/after state.
 */
export async function cancelMission(
  pool: Pool,
  missionId: string,
  operator: string,
  reason: string,
): Promise<CancelResult> {
  const before = await pool.query<{ status: string }>(
    'select status from missions where id = $1',
    [missionId],
  );
  if (before.rows.length === 0) return { ok: false, reason: 'mission not found' };

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update missions set status = 'cancelled', cancel_reason = $1 where id = $2`,
      [reason, missionId],
    );
    await client.query(
      `insert into operator_actions (operator, action, target_type, target_id, reason, before_state, after_state)
       values ($1, 'mission.cancel', 'mission', $2, $3,
         jsonb_build_object('status', $4::text),
         jsonb_build_object('status', 'cancelled'))`,
      [operator, missionId, reason, before.rows[0]!.status],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  return { ok: true };
}
