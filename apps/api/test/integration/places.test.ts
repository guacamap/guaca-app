import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { migrate } from '@guaca/db';

const TEST_DB = 'guaca_api';
const pool = new pg.Pool({
  connectionString: (
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
  ).replace(/\/guaca$/, '/' + TEST_DB),
});

const AREA_ID = '00000000-0000-4000-8000-00000000000a';

describe('GET /api/places', () => {
  beforeAll(async () => {
    const admin = new pg.Pool({
      connectionString:
        process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca',
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
      await client.query(
        `insert into areas (id, name, slug, country, timezone, geom) values
          ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
           ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
        [AREA_ID],
      );
      await client.query(
        `insert into spotters (id, name, phone, area_id) values
          ($1, 'Yorman', '+58 412 000 0001', $2),
          ($3, 'María', '+58 412 000 0002', $2)`,
        [
          '00000000-0000-4000-8000-0000000000c1',
          AREA_ID,
          '00000000-0000-4000-8000-0000000000c2',
        ],
      );
      const insert = (name: string, status: string) =>
        client.query(
          `insert into places
            (area_id, name, category, landmark_description, location, h3_8,
             source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id)
           values ($1, $2, 'eat_drink', 'Casa amarilla',
             ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
             '8a0000000000000', 'spotter', $3, $4, $5, $6)`,
          [
            AREA_ID,
            name,
            status,
            status === 'verified' ? 2 : 0,
            status === 'verified' ? '00000000-0000-4000-8000-0000000000c1' : null,
            status === 'verified' ? '00000000-0000-4000-8000-0000000000c2' : null,
          ],
        );
      await insert('Arepera Verificada', 'verified');
      await insert('Candidata OSM', 'candidate');
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns verified places only and never candidates', async () => {
    const app = buildApp({ pool });
    const res = await app.inject({
      method: 'GET',
      url: '/api/places?bbox=-68.03,10.44,-67.98,10.52&category=eat_drink',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { places: { name: string }[] };
    const names = body.places.map((p) => p.name);
    expect(names).toContain('Arepera Verificada');
    expect(names).not.toContain('Candidata OSM');
    await app.close();
  });

  it('returns a single place by id', async () => {
    const found = await pool.query(
      `select id from places where name = 'Arepera Verificada'`,
    );
    const app = buildApp({ pool });
    const res = await app.inject({
      method: 'GET',
      url: `/api/places/${found.rows[0]!.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string };
    expect(body.name).toBe('Arepera Verificada');
    await app.close();
  });
});
