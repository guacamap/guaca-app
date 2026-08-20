import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import { seed } from '../../src/seed/index.ts';
import { CARIBBEAN_CITIES } from '@guaca/shared';

const TEST_DB = 'guaca_seed';
const pool = new pg.Pool({
  connectionString: (
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
  ).replace(/\/guaca$/, '/' + TEST_DB),
});

describe('seed', () => {
  beforeAll(async () => {
    const admin = new pg.Pool({
      connectionString:
        (process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca').replace(/\/guaca$/, '/postgres'),
    });
    const res = await admin.query('select 1 from pg_database where datname = $1', [
      TEST_DB,
    ]);
    if (res.rows.length === 0) {
      await admin.query(`create database ${TEST_DB}`);
    }
    await admin.end();

    const client = await pool.connect();
    try {
      await client.query('drop schema if exists public cascade');
      await client.query('create schema if not exists public');
      await migrate(client);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates the pilot area, 10 spotters, 3 properties with QR tokens', async () => {
    await seed(pool);

    const areas = await pool.query('select count(*)::int as n from areas');
    // Pilot + the Caribbean expansion cities (reference geography).
    expect(areas.rows[0]!.n).toBe(1 + CARIBBEAN_CITIES.length);

    const spotters = await pool.query(
      'select count(*)::int as n from spotters where active',
    );
    expect(spotters.rows[0]!.n).toBe(10);

    const props = await pool.query(
      'select count(*)::int as n, count(*) filter (where plan = \'paid\')::int as paid, count(*) filter (where plan = \'free\')::int as free from properties',
    );
    expect(props.rows[0]!.n).toBe(3);
    expect(props.rows[0]!.paid).toBe(2);
    expect(props.rows[0]!.free).toBe(1);

    const qr = await pool.query(
      'select count(distinct qr_token)::int as n from properties',
    );
    expect(qr.rows[0]!.n).toBe(3);

    const zones = await pool.query('select count(*)::int as n from zones');
    expect(zones.rows[0]!.n).toBeGreaterThan(0);
  });

  it('is idempotent: re-running creates no duplicates', async () => {
    await seed(pool);
    const areas = await pool.query('select count(*)::int as n from areas');
    // Pilot + the Caribbean expansion cities (reference geography).
    expect(areas.rows[0]!.n).toBe(1 + CARIBBEAN_CITIES.length);
    const spotters = await pool.query('select count(*)::int as n from spotters');
    expect(spotters.rows[0]!.n).toBe(10);
    const props = await pool.query('select count(*)::int as n from properties');
    expect(props.rows[0]!.n).toBe(3);
  });

  it('creates the area and zones but no invented people or villas', async () => {
    await pool.query('truncate properties, spotters, zones, areas cascade');
    await seed(pool, { demo: false });

    const areas = await pool.query('select count(*)::int as n from areas');
    const zones = await pool.query('select count(*)::int as n from zones');
    const spotters = await pool.query('select count(*)::int as n from spotters');
    const properties = await pool.query('select count(*)::int as n from properties');

    expect(areas.rows[0].n).toBeGreaterThan(0);
    expect(zones.rows[0].n).toBeGreaterThan(0);
    // The demo roster is invented people with fake phone numbers — a
    // production deploy must never create them.
    expect(spotters.rows[0].n).toBe(0);
    expect(properties.rows[0].n).toBe(0);
  });
});
