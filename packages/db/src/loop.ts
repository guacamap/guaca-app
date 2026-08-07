import type { Pool } from 'pg';

export type LoopEventKind =
  | 'QUESTION_ASKED'
  | 'REFUSED'
  | 'GAP_SCORED'
  | 'MISSION_APPROVED'
  | 'SUBMITTED'
  | 'CHECKS_PASSED'
  | 'VISION_OK'
  | 'SECOND_LOCAL_CONFIRMED'
  | 'VERIFIED'
  | 'LOOP_CLOSED';

export interface RecordLoopEventInput {
  loopId: string;
  kind: LoopEventKind;
  agent?: string;
  payload?: Record<string, unknown>;
}

/** Mint a fresh loop id — the thread that ties question → gap → mission → verified. */
export async function mintLoopId(pool: Pool): Promise<string> {
  const res = await pool.query<{ id: string }>(
    'select gen_random_uuid()::text as id',
  );
  return res.rows[0]!.id;
}

/** Append one event to the loop thread. */
export async function recordLoopEvent(
  pool: Pool,
  input: RecordLoopEventInput,
): Promise<void> {
  await pool.query(
    `insert into loop_events (loop_id, kind, agent, payload)
     values ($1, $2, $3, $4)`,
    [input.loopId, input.kind, input.agent ?? null, input.payload ?? {}],
  );
}

export interface LoopTimelineEvent {
  kind: LoopEventKind;
  agent: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
  /** Milliseconds since the loop's first event — the wall-clock delta. */
  deltaMs: number;
}

/**
 * Render the entire loop chain with wall-clock deltas — the table that IS
 * the demo (§8). One query, ordered by creation time.
 */
export async function loopTimeline(
  pool: Pool,
  loopId: string,
): Promise<LoopTimelineEvent[]> {
  const res = await pool.query<{
    kind: LoopEventKind;
    agent: string | null;
    payload: Record<string, unknown>;
    created_at: Date;
    first_at: Date;
  }>(
    `select kind, agent, payload, created_at,
            min(created_at) over () as first_at
     from loop_events
     where loop_id = $1
     order by created_at asc`,
    [loopId],
  );
  return res.rows.map((r) => ({
    kind: r.kind,
    agent: r.agent,
    payload: r.payload,
    createdAt: r.created_at,
    deltaMs: Math.max(0, r.created_at.getTime() - r.first_at.getTime()),
  }));
}
