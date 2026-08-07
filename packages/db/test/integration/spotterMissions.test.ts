import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { missionsForSpotter, acceptMission } from '../../src/spotterMissions.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_spotter_missions';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER_ID = '00000000-0000-4000-8000-0000000000c1';
const GAP_ID = '00000000-0000-4000-8000-0000000000f1';
const MISSION_ID = '00000000-0000-4000-8000-0000000000f2';

describe('spotter missions (T7.2)', () => {
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
        `insert into spotters (id, name, phone, area_id, language) values
          ($1, 'Yorman', '+58 412 000 0001', $2, 'es')`,
        [SPOTTER_ID, AREA_ID],
      );
      await client.query(
        `insert into gaps (id, area_id, category, h3_8) values
          ($1, $2, 'eat_drink', '8a0000000000000')`,
        [GAP_ID, AREA_ID],
      );
      await client.query(
        `insert into missions (id, gap_id, spotter_id, brief, target_category, target_h3, reward_minor, status, created_by, expires_at)
         values ($1, $2, $3, 'Encuentra una arepera', 'eat_drink', '8a0000000000000', 300, 'offered', 'agent', now() + interval '48 hours')`,
        [MISSION_ID, GAP_ID, SPOTTER_ID],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('lists the spotter\'s offered missions', async () => {
    const rows = await missionsForSpotter(pool, SPOTTER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.brief).toContain('arepera');
    expect(rows[0]!.status).toBe('offered');
  });

  it('acceptMission flips status to accepted', async () => {
    const r = await acceptMission(pool, MISSION_ID, SPOTTER_ID);
    expect(r.ok).toBe(true);
    const row = await pool.query('select status from missions where id = $1', [MISSION_ID]);
    expect(row.rows[0]!.status).toBe('accepted');
  });

  it('a different spotter cannot accept someone else\'s mission', async () => {
    const r = await acceptMission(pool, MISSION_ID, '00000000-0000-4000-8000-0000000000c2');
    expect(r.ok).toBe(false);
  });
});
