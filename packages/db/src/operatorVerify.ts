import type { Pool } from 'pg';

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
}

/**
 * T6.2 — operator verification decision. Every action writes an
 * operator_actions row with before/after state (human oversight is scored;
 * an unaudited state change is a defect).
 */
export async function operatorVerify(
  pool: Pool,
  verificationRunId: string,
  decision: 'APPROVE' | 'REJECT',
  operator: string,
  note?: string,
): Promise<VerifyResult> {
  const before = await pool.query<{
    decision: string;
    decided_by: string;
    place_id: string;
  }>(
    `select decision, decided_by, place_id from verification_runs where id = $1`,
    [verificationRunId],
  );
  if (before.rows.length === 0) return { ok: false, reason: 'not found' };

  const row = before.rows[0]!;
  const placeId = row.place_id;

  // An operator overrides the PROCESS, never the two-witness rule. The run
  // flips to verified, but the place may only become `verified` when two
  // distinct locals have confirmed (verified_needs_two_locals is the
  // backstop); otherwise it stays provisional and waits for the second local.
  const twoLocal = await pool.query<{ n: number }>(
    `select count(*)::int as n from places
     where id = $1 and created_by_spotter_id is not null
       and confirmed_by_spotter_id is not null
       and confirmed_by_spotter_id <> created_by_spotter_id`,
    [placeId],
  );
  const placeStatus =
    decision === 'APPROVE' && (twoLocal.rows[0]?.n ?? 0) > 0
      ? 'verified'
      : decision === 'APPROVE'
        ? 'provisional'
        : 'rejected';

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update verification_runs set decision = $1, decided_by = 'operator', operator_note = $2
       where id = $3`,
      [decision === 'APPROVE' ? 'verified' : 'rejected', note ?? null, verificationRunId],
    );
    // The place follows the operator decision.
    await client.query(
      `update places set verification_status = $1, rejection_reason = $2
       where id = $3`,
      [placeStatus, decision === 'REJECT' ? (note ?? 'rejected by operator') : null, placeId],
    );
    await client.query(
      `insert into operator_actions (operator, action, target_type, target_id, reason, before_state, after_state)
       values ($1, 'verify.' || $2, 'verification_run', $3, $4,
         jsonb_build_object('decision', $5::text, 'decided_by', $6::text),
         jsonb_build_object('decision', $7::text, 'decided_by', 'operator'))`,
      [
        operator,
        decision.toLowerCase(),
        verificationRunId,
        note ?? null,
        row.decision,
        row.decided_by,
        placeStatus,
      ],
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
