import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { confirmSecondLocal } from '../../src/secondLocal.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_second_local';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const S1 = '00000000-0000-4000-8000-0000000000c1';
const S2 = '00000000-0000-4000-8000-0000000000c2';
const PLACE_ID = '00000000-0000-4000-8000-0000000000d1';

describe('confirmSecondLocal', () => {
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
          ($1, 'Yorman', '+58 412 000 0001', $3),
          ($2, 'María', '+58 412 000 0002', $3)`,
        [S1, S2, AREA_ID],
      );
      const insertPlace = (status: string, creator: string | null) =>
        client.query(
          `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id)
           values ($1, $2, 'Arepera La Guacamaya', 'eat_drink', 'Casa amarilla',
             ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
             '8a0000000000000', 'spotter', $3, $4, $5, $6)`,
          [PLACE_ID, AREA_ID, status, status === 'provisional' ? 1 : 0, creator, null],
        );
      await insertPlace('provisional', S1);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('self-confirmation is rejected', async () => {
    const r = await confirmSecondLocal(pool, PLACE_ID, S1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('SELF_CONFIRMATION');
  });

  it('another spotter confirmation sets verified and witness_count = 2', async () => {
    const r = await confirmSecondLocal(pool, PLACE_ID, S2);
    expect(r.ok).toBe(true);
    const row = await pool.query(
      'select verification_status, witness_count, confirmed_by_spotter_id from places where id = $1',
      [PLACE_ID],
    );
    expect(row.rows[0]!.verification_status).toBe('verified');
    expect(row.rows[0]!.witness_count).toBe(2);
    expect(row.rows[0]!.confirmed_by_spotter_id).toBe(S2);
  });

  it('a second confirmation is a no-op (already verified)', async () => {
    const r = await confirmSecondLocal(pool, PLACE_ID, S1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NOT_PROVISIONAL');
  });
});
