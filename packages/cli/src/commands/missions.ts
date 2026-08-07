import type { Pool } from 'pg';
import { listMissions, cancelMission, payMission } from '@guaca/db';
import type { MissionRow, CancelResult, PayResult } from '@guaca/db';

export interface MissionsDb {
  listMissions(pool: Pool, status?: string): Promise<MissionRow[]>;
  cancelMission(pool: Pool, missionId: string, operator: string, reason: string): Promise<CancelResult>;
  payMission(
    pool: Pool,
    input: { missionId: string; spotterId: string; amountMinor: number; currency: string },
  ): Promise<PayResult>;
}

/** `guaca missions` — list missions. */
export async function missionsCommand(
  db: MissionsDb,
  pool: Pool,
  status?: string,
): Promise<MissionRow[]> {
  return db.listMissions(pool, status);
}

export interface OverrideInput {
  missionId: string;
  cancel: boolean;
  reason?: string;
  db: MissionsDb;
  pool: Pool;
}

/** `guaca override <missionId> --cancel --reason "…"` — audited. */
export async function overrideCommand(
  input: OverrideInput,
): Promise<CancelResult> {
  if (!input.cancel) return { ok: false, reason: 'no override action given' };
  return input.db.cancelMission(
    input.pool,
    input.missionId,
    process.env.OPERATOR_TOKEN ?? 'operator',
    input.reason ?? 'cancelled by operator',
  );
}

export interface PayCommandInput {
  missionId: string;
  db: MissionsDb;
  pool: Pool;
}

/** `guaca pay <missionId>` — mock provider, idempotency key = mission_id. */
export async function payCommand(input: PayCommandInput): Promise<PayResult> {
  const missions = await input.db.listMissions(input.pool, 'verified');
  const mission = missions.find((m) => m.id === input.missionId);
  if (!mission) {
    return { status: 'failed', idempotencyKey: input.missionId };
  }
  return input.db.payMission(input.pool, {
    missionId: input.missionId,
    spotterId: mission.spotterId,
    amountMinor: mission.rewardMinor,
    currency: mission.currency,
  });
}
