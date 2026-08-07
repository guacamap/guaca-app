import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../../src/migrate.ts';

const TEST_DB = 'guaca_test1';
const pool = new pg.Pool({
  connectionString: (process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca').replace(/\/guaca$/, '/' + TEST_DB),
});
import { q } from '../../src/queries.js';

// Puerto Cabello waterfront: ~10.4716 N, -68.0056 E
const AREA_GEOM =
  'POLYGON((-68.03 10.44, -67.98 10.44, -67.98 10.52, -68.03 10.52, -68.03 10.44))';

describe('q.places.findVerifiedNear', () => {
  beforeAll(async () => {
    // Create the dedicated test database if missing.
    const admin = new pg.Pool({
      connectionString:
        (process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca').replace(/\/guaca$/, '/postgres'),
    });
    const res = await admin.query(
      `select 1 from pg_database where datname = $1`,
      [TEST_DB],
    );
    if (res.rows.length === 0) {
      await admin.query(`create database ${TEST_DB}`);
    }
    await admin.end();

    const client = await pool.connect();
    try {
      await client.query('drop schema if exists public cascade');
      await client.query('create schema if not exists public');
      await migrate(client);
      // migrate()'s first-run reset drops/recreates public; re-run the area
      // insert AFTER the reset so the row survives. If another suite already
      // migrated this DB, public exists and the insert just works.
      await client.query(
        `insert into areas (id, name, slug, country, timezone, geom) values
          ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
           ST_GeogFromText($2))`,
        ['00000000-0000-4000-8000-00000000000a', AREA_GEOM],
      );
      await client.query(
        `insert into spotters (id, name, phone, area_id) values
          ($1, 'Yorman', '+58 000 000 0001', '00000000-0000-4000-8000-00000000000a'),
          ($2, 'María', '+58 000 000 0002', '00000000-0000-4000-8000-00000000000a')`,
        [
          '00000000-0000-4000-8000-0000000000c1',
          '00000000-0000-4000-8000-0000000000c2',
        ],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  async function insertPlace(
    overrides: { status?: string; witnessCount?: number; category?: string } = {},
  ) {
    const status = overrides.status ?? 'pending';
    const witness = overrides.witnessCount ?? 0;
    const res = await pool.query(
      `insert into places
        (area_id, name, category, landmark_description, location, h3_8,
         source, verification_status, witness_count,
         created_by_spotter_id, confirmed_by_spotter_id)
       values ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
         '8a0000000000000', 'spotter', $5, $6,
         '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2')
       returning id`,
      [
        '00000000-0000-4000-8000-00000000000a',
        'Arepera La Guacamaya',
        overrides.category ?? 'eat_drink',
        'Casa amarilla al lado del puente',
        status,
        witness,
      ],
    );
    return res.rows[0]!.id as string;
  }

  it('returns a verified place within radius and category', async () => {
    const id = await insertPlace({ status: 'verified', witnessCount: 2 });
    const rows = await q.places.findVerifiedNear(
      pool,
      10.4716,
      -68.0056,
      500,
      'eat_drink',
    );
    expect(rows.map((r) => r.id)).toContain(id);
  });

  it('does not return a pending place', async () => {
    const id = await insertPlace({ status: 'pending' });
    const rows = await q.places.findVerifiedNear(
      pool,
      10.4716,
      -68.0056,
      500,
      'eat_drink',
    );
    expect(rows.map((r) => r.id)).not.toContain(id);
  });

  it('does not return a candidate place', async () => {
    const id = await insertPlace({ status: 'candidate' });
    const rows = await q.places.findVerifiedNear(
      pool,
      10.4716,
      -68.0056,
      500,
      'eat_drink',
    );
    expect(rows.map((r) => r.id)).not.toContain(id);
  });

  it('respects the category filter', async () => {
    const id = await insertPlace({ status: 'verified', witnessCount: 2, category: 'services' });
    const rows = await q.places.findVerifiedNear(
      pool,
      10.4716,
      -68.0056,
      500,
      'eat_drink',
    );
    expect(rows.map((r) => r.id)).not.toContain(id);
  });

  it('orders by distance ascending (T4.2)', async () => {
    const near = await insertPlace({ status: 'verified', witnessCount: 2 });
    // A second verified place ~200m further north.
    await pool.query(
      `update places set location = ST_SetSRID(ST_MakePoint(-68.0056, 10.4735), 4326)::geography
       where name = 'Arepera La Guacamaya' and id <> $1`,
      [near],
    );
    const rows = await q.places.findVerifiedNear(
      pool,
      10.4716,
      -68.0056,
      2000,
      'eat_drink',
    );
    const distances = rows.map((r) =>
      Math.hypot(r.lat - 10.4716, (r.lon - -68.0056) * 111320),
    );
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });
});
