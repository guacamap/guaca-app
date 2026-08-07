import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { pendingProvisionalNear } from '../../src/secondLocal.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_pending_local';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const S1 = '00000000-0000-4000-8000-0000000000c1';
const PLACE_ID = '00000000-0000-4000-8000-0000000000d1';

describe('pendingProvisionalNear (T7.5)', () => {
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
        [S1, AREA_ID],
      );
      await client.query(
        `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id)
         values ($1, $2, 'Arepera La Guacamaya', 'eat_drink', 'Casa amarilla',
           ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
           '8a0000000000000', 'spotter', 'provisional', 1, $3)`,
        [PLACE_ID, AREA_ID, S1],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('lists provisional places near a point that a different spotter can confirm', async () => {
    const rows = await pendingProvisionalNear(pool, 10.4716, -68.0056, 500);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Arepera La Guacamaya');
  });
});
