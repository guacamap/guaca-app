import type { Pool } from 'pg';
import { pendingOperatorQueue } from '@guaca/db';
import type { OperatorQueueItem } from '@guaca/db';

export interface VerifyDb {
  pendingOperatorQueue(pool: Pool): Promise<OperatorQueueItem[]>;
  operatorVerify(
    runId: string,
    decision: 'APPROVE' | 'REJECT',
    operator: string,
    note?: string,
  ): Promise<{ ok: boolean; reason?: string }>;
}

/** `guaca queue` — the verification escalations awaiting a human. */
export async function queueCommand(db: VerifyDb, pool: Pool): Promise<OperatorQueueItem[]> {
  return db.pendingOperatorQueue(pool);
}

export interface VerifyInput {
  id: string;
  action: 'APPROVE' | 'REJECT';
  operator: string;
  reason?: string;
  db: VerifyDb;
}

/** `guaca verify <id> --approve|--reject --reason "…"` — audited. */
export async function verifyCommand(input: VerifyInput): Promise<{ ok: boolean; reason?: string }> {
  return input.db.operatorVerify(
    input.id,
    input.action,
    input.operator,
    input.reason,
  );
}
