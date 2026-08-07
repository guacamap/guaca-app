import type { Pool } from 'pg';

export interface OperatorQueueItem {
  id: string;
  placeId: string;
  decision: 'needs_operator';
  checks: Record<string, unknown>;
  createdAt: Date;
  placeName: string | null;
}

/**
 * The operator queue — verification runs awaiting a human decision
 * (`needs_operator`). Consumed by `guaca queue` (Phase 6). Each action the
 * operator takes writes an operator_actions audit row.
 */
export async function pendingOperatorQueue(
  pool: Pool,
): Promise<OperatorQueueItem[]> {
  const res = await pool.query<{
    id: string;
    place_id: string;
    checks: Record<string, unknown>;
    created_at: Date;
    place_name: string | null;
  }>(
    `select v.id, v.place_id, v.checks, v.created_at, p.name as place_name
     from verification_runs v
     left join places p on p.id = v.place_id
     where v.decision = 'needs_operator'
       and v.decided_by = 'agent'
     order by v.created_at asc`,
  );
  return res.rows.map((r) => ({
    id: r.id,
    placeId: r.place_id,
    decision: 'needs_operator' as const,
    checks: r.checks,
    createdAt: r.created_at,
    placeName: r.place_name,
  }));
}
