import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { findNearDuplicatePlace } from '../../src/nearDuplicate.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_near_dup';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';

describe('findNearDuplicatePlace', () => {
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
        `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status)
         values ($1, $2, 'Arepera La Guacamaya', 'eat_drink', 'Casa amarilla',
           ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
           '8a0000000000000', 'spotter', 'pending')`,
        ['00000000-0000-4000-8000-0000000000d1', AREA_ID],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('flags a new place 20m from an existing same-name place', async () => {
    const near = await findNearDuplicatePlace(pool, 10.4716 + 20 / 111320, -68.0056, 'arepera la guacamaya');
    expect(near).not.toBeNull();
    expect(near!.distanceM).toBeLessThanOrEqual(20);
  });

  it('does not flag a different name at the same spot', async () => {
    const other = await findNearDuplicatePlace(pool, 10.4716, -68.0056, 'Farmacia Central');
    expect(other).toBeNull();
  });

  it('does not flag far away even with the same name', async () => {
    const far = await findNearDuplicatePlace(pool, 10.4716 + 500 / 111320, -68.0056, 'Arepera La Guacamaya');
    expect(far).toBeNull();
  });
});
