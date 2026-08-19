import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { expireMissions } from '../../src/missions.ts';
import { commissionMission } from '../../src/gap/commission.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_expire';
const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER_ID = '00000000-0000-4000-8000-0000000000c1';
const GAP_ID = '00000000-0000-4000-8000-0000000000f1';
const GAP2_ID = '00000000-0000-4000-8000-0000000000f3';

describe('expireMissions — demand recycles when an offer dies', () => {
  let pool: import('pg').Pool;

  beforeAll(async () => {
    pool = await createTempDb(DB);
    const client = await pool.connect();
    try {
      await migrate(client);
      await client.query(
        `insert into areas (id, name, slug, country, timezone, geom) values
          ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
           ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
        [AREA_ID],
      );
      await client.query(
        `insert into spotters (id, name, phone, area_id) values ($1, 'Yorman', '+58 412 000 0001', $2)`,
        [SPOTTER_ID, AREA_ID],
      );
      await client.query(
        `insert into gaps (id, area_id, category, h3_8) values
          ($1, $2, 'eat_drink', '8a0000000000000'),
          ($3, $2, 'beach_water', '8a0000000000001')`,
        [GAP_ID, AREA_ID, GAP2_ID],
      );
      // An offer already past its deadline, and one still alive.
      await commissionMission(pool, {
        gapId: GAP_ID,
        spotterId: SPOTTER_ID,
        brief: 'dead offer',
        targetCategory: 'eat_drink',
        targetH3: '8a0000000000000',
        rewardMinor: 300,
        maxRewardMinor: 500,
        dailyCap: 5,
        missionsToday: 0,
        expiresInHours: -1, // already expired
      });
      await commissionMission(pool, {
        gapId: GAP2_ID,
        spotterId: SPOTTER_ID,
        brief: 'live offer',
        targetCategory: 'beach_water',
        targetH3: '8a0000000000001',
        rewardMinor: 300,
        maxRewardMinor: 500,
        dailyCap: 5,
        missionsToday: 1,
        expiresInHours: 48,
      });
      // A third mission, accepted by the spotter but past its deadline —
      // the sweep must NOT take work in progress away from a spotter.
      const accepted = await commissionMission(pool, {
        gapId: GAP2_ID,
        spotterId: SPOTTER_ID,
        brief: 'duplicate-guard probe',
        targetCategory: 'beach_water',
        targetH3: '8a0000000000001',
        rewardMinor: 300,
        maxRewardMinor: 500,
        dailyCap: 5,
        missionsToday: 2,
        expiresInHours: 48,
      });
      expect(accepted.status).toBe('blocked'); // one open mission per gap
    } finally {
      client.release();
    }
  });
  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('expires dead offers, reopens their gaps, leaves live offers alone', async () => {
    const r = await expireMissions(pool);
    expect(r.expired).toBe(1);
    expect(r.gapsReopened).toBe(1);

    const dead = await pool.query<{ status: string }>(
      `select status from missions where brief = 'dead offer'`,
    );
    expect(dead.rows[0]!.status).toBe('expired');

    const gap = await pool.query<{ status: string }>(
      `select status from gaps where id = $1`,
      [GAP_ID],
    );
    expect(gap.rows[0]!.status).toBe('open');

    const live = await pool.query<{ n: number }>(
      `select count(*)::int as n from missions where status = 'offered'`,
    );
    expect(live.rows[0]!.n).toBe(1);
  });

  it('is idempotent — a second sweep finds nothing to do', async () => {
    const r = await expireMissions(pool);
    expect(r.expired).toBe(0);
    expect(r.gapsReopened).toBe(0);
  });

  it('an accepted mission past its deadline survives the sweep', async () => {
    await pool.query(
      `update missions set status = 'accepted', expires_at = now() - interval '1 hour'
        where brief = 'live offer'`,
    );
    const r = await expireMissions(pool);
    expect(r.expired).toBe(0);
    const m = await pool.query<{ status: string }>(
      `select status from missions where brief = 'live offer'`,
    );
    expect(m.rows[0]!.status).toBe('accepted'); // operator territory, not the sweep's
  });
});
