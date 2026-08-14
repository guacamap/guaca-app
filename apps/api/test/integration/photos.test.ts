import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { memoryObjectStore } from '../../src/objectStore.ts';
import { SignJWT } from 'jose';
import { migrate } from '@guaca/db';

const TEST_DB = 'guaca_photos_api';
const pool = new pg.Pool({
  connectionString: (
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
  ).replace(/\/guaca$/, '/' + TEST_DB),
});

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER_ID = '00000000-0000-4000-8000-0000000000c1';
const SECRET = new TextEncoder().encode('changeme-32-bytes-min!');
async function auth(): Promise<{ authorization: string }> {
  const token = await new SignJWT({ sub: SPOTTER_ID, role: 'spotter' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
  return { authorization: `Bearer ${token}` };
}
const PLACE_ID = '00000000-0000-4000-8000-0000000000d1';

function tinyPng(): string {
  // 1x1 red PNG (base64) — deterministic, tiny, decodable by sharp.
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

describe('POST /api/photos', () => {
  beforeAll(async () => {
    const admin = new pg.Pool({
      connectionString: (
        process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
      ).replace(/\/guaca$/, '/postgres'),
    });
    const res = await admin.query('select 1 from pg_database where datname = $1', [TEST_DB]);
    if (res.rows.length === 0) await admin.query(`create database ${TEST_DB}`);
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
        `insert into spotters (id, name, phone, area_id) values ($1, 'Yorman', '+58 412 000 0001', $2)`,
        [SPOTTER_ID, AREA_ID],
      );
      await client.query(
        `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status)
         values ($1, $2, 'Arepera La Guacamaya', 'eat_drink', 'Casa amarilla',
           ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
           '8a0000000000000', 'spotter', 'pending')`,
        [PLACE_ID, AREA_ID],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('stores the photo and returns sha256 + phash', async () => {
    const app = buildApp({ pool, objectStore: memoryObjectStore() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: await auth(),
      payload: {
        placeId: PLACE_ID,
        imageBase64: tinyPng(),
        captureLat: 10.4716,
        captureLon: -68.0056,
        captureAccuracyM: 5,
        capturedAt: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { sha256: string; phash: string; id: string };
    expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(body.phash).toMatch(/^[0-9a-f]{16}$/);

    const row = await pool.query(
      'select sha256, phash, capture_lat, received_at from place_photos where id = $1',
      [body.id],
    );
    expect(row.rows[0]!.sha256).toBe(body.sha256);
    expect(row.rows[0]!.capture_lat).toBeCloseTo(10.4716, 4);
    expect(row.rows[0]!.received_at).toBeInstanceOf(Date);
    await app.close();
  });

  it('identical images produce identical phash', async () => {
    const app = buildApp({ pool, objectStore: memoryObjectStore() });
    const a = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: await auth(), payload: { placeId: PLACE_ID, imageBase64: tinyPng() },
    });
    const b = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: await auth(), payload: { placeId: PLACE_ID, imageBase64: tinyPng() },
    });
    expect((a.json() as { phash: string }).phash).toBe(
      (b.json() as { phash: string }).phash,
    );
    await app.close();
  });
});
