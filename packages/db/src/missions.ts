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
  // Map explicitly — a bare cast left camelCase fields undefined and once
  // fed a NULL spotter_id into payouts.
  return res.rows.map((r) => ({
    id: r.id as string,
    gapId: r.gap_id as string,
    spotterId: r.spotter_id as string,
    brief: r.brief as string,
    status: r.status as string,
    rewardMinor: r.reward_minor as number,
    currency: r.currency as string,
    createdBy: r.created_by as string,
    offeredAt: r.offered_at as Date,
    expiresAt: r.expires_at as Date,
  }));
}

export interface CancelResult {
  ok: boolean;
  reason?: string;
}

export interface ExpireResult {
  expired: number;
  gapsReopened: number;
}

/**
 * Expire offered missions past their deadline and reopen their gaps, so the
 * demand a mission failed to serve recycles into the next cycle instead of
 * dying inside a row nobody looks at. Only `offered` transitions: an
 * accepted or submitted mission means a spotter is actively working it, and
 * taking that away is an operator decision (`guaca override --cancel`),
 * not a sweep's.
 *
 * Transactional: a mission must never expire without its gap reopening.
 */
export async function expireMissions(pool: Pool): Promise<ExpireResult> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const expired = await client.query<{ id: string; gap_id: string }>(
      `update missions set status = 'expired'
        where status = 'offered' and expires_at < now()
        returning id, gap_id`,
    );
    let gapsReopened = 0;
    if (expired.rows.length > 0) {
      const reopened = await client.query(
        `update gaps set status = 'open', updated_at = now()
          where id = any($1::uuid[]) and status = 'commissioned'`,
        [expired.rows.map((r) => r.gap_id)],
      );
      gapsReopened = reopened.rowCount ?? 0;
    }
    await client.query('commit');
    return { expired: expired.rowCount ?? 0, gapsReopened };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
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
