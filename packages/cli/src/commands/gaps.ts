import type { Pool } from 'pg';
import { rankedGaps, operatorCommission } from '@guaca/db';
import type { RankedGap } from '@guaca/db';

export interface GapsDb {
  rankedGaps(pool: Pool, areaId?: string): Promise<RankedGap[]>;
  operatorCommission(
    pool: Pool,
    input: {
      gapId: string;
      spotterId: string;
      brief: string;
      targetCategory: string;
      targetH3: string;
      rewardMinor: number;
    },
  ): Promise<{ status: 'offered' | 'blocked'; missionId?: string; reason?: string }>;
}

/** `guaca gaps` — ranked, with score breakdown. */
export async function gapsCommand(
  db: GapsDb,
  pool: Pool,
  areaId?: string,
): Promise<RankedGap[]> {
  return db.rankedGaps(pool, areaId);
}

export interface CommissionCommandInput {
  gapId: string;
  spotterId: string;
  rewardMinor: number;
  approve: boolean;
  db: GapsDb;
  pool: Pool;
}

/** `guaca commission <gapId> [--spotter] [--reward] [--approve]` — operator path. */
export async function commissionCommand(
  input: CommissionCommandInput,
): Promise<{ status: string; missionId?: string; reason?: string }> {
  if (!input.approve) {
    return { status: 'blocked', reason: 'refusing to commission without --approve' };
  }
  return input.db.operatorCommission(input.pool, {
    gapId: input.gapId,
    spotterId: input.spotterId,
    brief: `Mission commissioned by operator for gap ${input.gapId}`,
    targetCategory: 'eat_drink',
    targetH3: '',
    rewardMinor: input.rewardMinor,
  });
}
