import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { payMission, type PayInput } from '../../src/payout/payouts.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_payouts';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER_ID = '00000000-0000-4000-8000-0000000000c1';
const GAP_ID = '00000000-0000-4000-8000-0000000000f1';
const MISSION_ID = '00000000-0000-4000-8000-0000000000f2';

describe('payMission (T5.8)', () => {
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
        `insert into gaps (id, area_id, category, h3_8) values
          ($1, $2, 'eat_drink', '8a0000000000000')`,
        [GAP_ID, AREA_ID],
      );
      await client.query(
        `insert into missions (id, gap_id, spotter_id, brief, target_category, target_h3, reward_minor, status, created_by, expires_at)
         values ($1, $2, $3, 'brief', 'eat_drink', '8a0000000000000', 300, 'verified', 'agent', now() + interval '48 hours')`,
        [MISSION_ID, GAP_ID, SPOTTER_ID],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  const payInput: PayInput = {
    missionId: MISSION_ID,
    spotterId: SPOTTER_ID,
    amountMinor: 300,
    currency: 'USD',
  };

  it('pays a mission through the mock provider (idempotency key = mission_id)', async () => {
    const r = await payMission(pool, payInput);
    expect(r.status).toBe('sent');
    expect(r.idempotencyKey).toBe(MISSION_ID);

    const rows = await pool.query(
      'select count(*)::int as n from payouts where mission_id = $1',
      [MISSION_ID],
    );
    expect(rows.rows[0]!.n).toBe(1);

    // The lifecycle closes: a sent payment moves the mission to 'paid'.
    const mission = await pool.query<{ status: string; paid_at: string | null }>(
      'select status, paid_at from missions where id = $1',
      [MISSION_ID],
    );
    expect(mission.rows[0]!.status).toBe('paid');
    expect(mission.rows[0]!.paid_at).not.toBeNull();
  });

  it('paying the same mission twice produces exactly one payout row', async () => {
    await payMission(pool, payInput);
    await payMission(pool, payInput);
    const rows = await pool.query(
      'select count(*)::int as n from payouts where mission_id = $1',
      [MISSION_ID],
    );
    expect(rows.rows[0]!.n).toBe(1);
  });
});
