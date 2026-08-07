import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import {
  commissionMission,
  CommissionInput,
  CommissionResult,
} from '../../src/gap/commission.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_commission';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER_ID = '00000000-0000-4000-8000-0000000000c1';
const GAP_ID = '00000000-0000-4000-8000-0000000000f1';

function input(overrides: Partial<CommissionInput> = {}): CommissionInput {
  return {
    gapId: GAP_ID,
    spotterId: SPOTTER_ID,
    brief: 'Encuentra una arepera en el Malecón y toma 3 fotos.',
    targetCategory: 'eat_drink',
    targetH3: '8a0000000000000',
    rewardMinor: 300,
    maxRewardMinor: 500,
    dailyCap: 5,
    missionsToday: 0,
    ...overrides,
  };
}

describe('commissionMission (T5.5)', () => {
  beforeAll(async () => {
    pool = await createTempDb(DB);
    const client = await pool.connect();
    try {
      await client.query('drop schema if exists public cascade');
      await client.query('create schema if not exists public');
      await migrate(client);
      await client.query(
        `insert into areas (id, name, slug, country, timezone, geom) values
          ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
           ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
        [AREA_ID],
      );
      await client.query(
        `insert into spotters (id, name, phone, area_id) values
          ($1, 'Yorman', '+58 412 000 0001', $2)`,
        [SPOTTER_ID, AREA_ID],
      );
      await client.query(
        `insert into gaps (id, area_id, category, h3_8, question_count, distinct_session_count)
         values ($1, $2, 'eat_drink', '8a0000000000000', 7, 6)`,
        [GAP_ID, AREA_ID],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('commissions a mission for an open gap', async () => {
    const r: CommissionResult = await commissionMission(pool, input());
    expect(r.status).toBe('offered');
    expect(r.missionId).toBeTruthy();
  });

  it('a second commission for the same gap fails (partial unique index)', async () => {
    const r: CommissionResult = await commissionMission(pool, input());
    expect(r.status).toBe('blocked');
    expect(r.reason).toMatch(/open mission|already/i);
  });

  it('exceeding the daily cap stops commissioning', async () => {
    // Close the first mission so the unique index allows a new one, then
    // hit the cap.
    await pool.query(
      `update missions set status = 'cancelled' where gap_id = $1`,
      [GAP_ID],
    );
    const r: CommissionResult = await commissionMission(
      pool,
      input({ missionsToday: 5, dailyCap: 5 }),
    );
    expect(r.status).toBe('blocked');
    expect(r.reason).toMatch(/daily cap/i);
  });

  it('a reward over GAP_AGENT_MAX_REWARD_MINOR pauses for operator approval', async () => {
    await pool.query(
      `update missions set status = 'cancelled' where gap_id = $1`,
      [GAP_ID],
    );
    const r: CommissionResult = await commissionMission(
      pool,
      input({ rewardMinor: 800, maxRewardMinor: 500 }),
    );
    expect(r.status).toBe('needs_approval');
  });
});
