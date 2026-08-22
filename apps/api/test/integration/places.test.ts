import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { captureSender } from '../helpers/touristTestAuth.ts';
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
    if (res.statusCode !== 200) console.log('PAYLOAD:', res.payload);
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
    if (res.statusCode !== 200) console.log('PAYLOAD:', res.payload);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string };
    expect(body.name).toBe('Arepera Verificada');
    await app.close();
  });
  it('admin panel routes: token-gated overview and spotters', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-token';
    const app = buildApp({ pool });
    const auth = { authorization: 'Bearer test-operator-token' };

    const anon = await app.inject({ method: 'GET', url: '/api/operator/overview' });
    expect(anon.statusCode).toBe(401);

    const ok = await app.inject({ method: 'GET', url: '/api/operator/overview', headers: auth });
    expect(ok.statusCode).toBe(200);
    const body = ok.json() as { verifiedPlaces: number; activeSpotters: number };
    expect(typeof body.verifiedPlaces).toBe('number');
    expect(typeof body.activeSpotters).toBe('number');

    const roster = await app.inject({ method: 'GET', url: '/api/operator/spotters', headers: auth });
    expect(roster.statusCode).toBe(200);

    delete process.env.OPERATOR_TOKEN;
    await app.close();
  });

  it('GET /api/areas lists areas with honest stats and a bbox', async () => {
    const app = buildApp({ pool });
    const res = await app.inject({ method: 'GET', url: '/api/areas' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      areas: Array<{ slug: string; country: string; bbox: number[]; verifiedCount: number; candidateCount: number }>;
    };
    expect(body.areas.length).toBeGreaterThan(0);
    for (const a of body.areas) {
      expect(a.bbox).toHaveLength(4);
      expect(a.bbox[0]!).toBeLessThanOrEqual(a.bbox[2]!); // lonMin <= lonMax
      expect(a.bbox[1]!).toBeLessThanOrEqual(a.bbox[3]!); // latMin <= latMax
    }
    await app.close();
  });

  it('steward routes: operator-token gated, and approval enriches only a candidate', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-token';
    const scripted = {
      async json<T>(): Promise<{ raw: T; usage: { tokensIn: number; tokensOut: number }; model: string }> {
        return {
          raw: {
            category: 'eat_drink',
            landmarkHint: 'Calle Bolívar, puerta azul',
            whyLikely: 'OSM amenity=restaurant',
            photoChecklist: ['fachada', 'letrero'],
            suggestedTags: ['arepas'],
          } as unknown as T,
          usage: { tokensIn: 10, tokensOut: 10 },
          model: 'scripted',
        };
      },
      async vision<T>(): Promise<never> { throw new Error('not used'); },
    };
    const cap = captureSender();
    const app = buildApp({ pool, inference: scripted, emailSender: cap.sender });

    // No token → 401. Wrong token → 401.
    const anon = await app.inject({ method: 'GET', url: '/api/operator/steward/drafts' });
    expect(anon.statusCode).toBe(401);
    const wrong = await app.inject({
      method: 'GET', url: '/api/operator/steward/drafts',
      headers: { authorization: 'Bearer nope' },
    });
    expect(wrong.statusCode).toBe(401);

    const auth = { authorization: 'Bearer test-operator-token' };

    // Seed one OSM candidate for the steward to draft.
    await pool.query(
      `insert into places (area_id, name, category, landmark_description, location, h3_8,
         source, verification_status, witness_count, tags, osm_type, osm_id)
       values ($1, 'Cantina El Puerto', 'eat_drink', 'Punto en OpenStreetMap',
         ST_SetSRID(ST_MakePoint(-68.0060, 10.4720), 4326)::geography, '8a0000000000000',
         'osm_candidate', 'candidate', 0, '{restaurant}', 'node', 424242)`,
      [AREA_ID],
    );

    const enrich = await app.inject({
      method: 'POST', url: '/api/operator/steward/enrich',
      headers: auth, payload: { limit: 5 },
    });
    expect(enrich.statusCode).toBe(200);
    expect((enrich.json() as { drafted: number }).drafted).toBe(1);

    const list = await app.inject({
      method: 'GET', url: '/api/operator/steward/drafts', headers: auth,
    });
    const drafts = (list.json() as { drafts: Array<{ id: string; candidateName: string }> }).drafts;
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.candidateName).toBe('Cantina El Puerto');

    const approve = await app.inject({
      method: 'POST', url: `/api/operator/steward/drafts/${drafts[0]!.id}/approve`,
      headers: auth, payload: { note: 'test' },
    });
    expect(approve.statusCode).toBe(200);

    // The candidate got enriched — and STAYS a candidate (never tourist-visible).
    const place = await pool.query<{ landmark_description: string; verification_status: string }>(
      `select landmark_description, verification_status from places where osm_id = 424242`,
    );
    expect(place.rows[0]!.landmark_description).toBe('Calle Bolívar, puerta azul');
    expect(place.rows[0]!.verification_status).toBe('candidate');

    delete process.env.OPERATOR_TOKEN;
    await app.close();
  });

  it('GET /healthz reports readiness, and fails closed when the DB dies', async () => {
    const app = buildApp({ pool });
    const ok = await app.inject({ method: 'GET', url: '/healthz' });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { ok: boolean; db: boolean }).db).toBe(true);
    await app.close();

    // A dead database must surface as 503, not a hang — that is what the
    // container healthcheck and any uptime monitor rely on.
    const dead = new pg.Pool({ connectionString: 'postgres://guaca:guaca@localhost:5432/does_not_exist' });
    const sick = buildApp({ pool: dead });
    const res = await sick.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(503);
    await dead.end();
    await sick.close();
  });

  it('exposes the persisted people-per-zone snapshot publicly', async () => {
    const app = buildApp({ pool });
    const res = await app.inject({ method: 'GET', url: '/api/zones/demand' });
    if (res.statusCode !== 200) console.log('PAYLOAD:', res.payload);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { zones: Array<{ zoneName: string; peopleCount: number }> };
    expect(Array.isArray(body.zones)).toBe(true);
    await app.close();
  });
});
