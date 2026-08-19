import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { migrate } from '@guaca/db';
import { FakeInference } from '@guaca/agents';
import { authTourist, captureSender } from '../helpers/touristTestAuth.ts';

const TEST_DB = 'guaca_ask_api';
const pool = new pg.Pool({
  connectionString: (
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
  ).replace(/\/guaca$/, '/' + TEST_DB),
});

const AREA_ID = '00000000-0000-4000-8000-00000000000a';

describe('POST /api/ask', () => {
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
        `insert into spotters (id, name, phone, area_id) values
          ($1, 'Yorman', '+58 412 000 0001', $2),
          ($3, 'María', '+58 412 000 0002', $2)`,
        [
          '00000000-0000-4000-8000-0000000000c1',
          AREA_ID,
          '00000000-0000-4000-8000-0000000000c2',
        ],
      );
      // One verified place (covered area) and one candidate (uncovered).
      await client.query(
        `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id)
         values
          ('00000000-0000-4000-8000-0000000000d1', $1, 'Arepera La Guacamaya', 'eat_drink', 'Casa amarilla',
            ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography, '8a0000000000000', 'spotter', 'verified', 2, '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2'),
          ('00000000-0000-4000-8000-0000000000d2', $1, 'Candidata OSM', 'eat_drink', 'Punto en OSM',
            ST_SetSRID(ST_MakePoint(-68.0056, 10.4720), 4326)::geography, '8a0000000000000', 'osm_candidate', 'candidate', 0, null, null)`,
        [AREA_ID],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects an unauthenticated ask — §4.1: demand signals belong to accounts', async () => {
    const app = buildApp({ pool, inference: new FakeInference({}), minCandidates: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/ask',
      payload: { text: 'where can I eat arepas now?', language: 'en' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('answers a covered question from verified data (fast path, zero model calls)', async () => {
    const fake = new FakeInference({});
    const cap = captureSender();
    const app = buildApp({ pool, inference: fake, minCandidates: 1, emailSender: cap.sender });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST',
      url: '/api/ask',
      headers,
      payload: { text: 'where can I eat arepas now?', language: 'en', lat: 10.4716, lon: -68.0056 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { kind: string; text: string; placeIds: string[] };
    expect(body.kind).toBe('answer');
    expect(body.text).toContain('Arepera La Guacamaya');
    expect(body.placeIds).toContain('00000000-0000-4000-8000-0000000000d1');
    // The fast path served the answer without touching the model.
    expect(fake.calls).toHaveLength(0);
    await app.close();
  });

  it('refuses an uncovered question as a first-class result, never an error', async () => {
    const cap = captureSender();
    const app = buildApp({
      pool,
      inference: new FakeInference({}),
      minCandidates: 5, // forces the refusal path even with 1 verified place
      emailSender: cap.sender,
    });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST',
      url: '/api/ask',
      headers,
      payload: { text: 'is there anywhere to snorkel at Isla Larga?', language: 'en' },
    });
    expect(res.statusCode).toBe(200); // not an error status
    const body = res.json() as { kind: string; text: string; placeIds: string[] };
    expect(body.kind).toBe('refusal');
    expect(body.text).toContain('No one has verified');
    expect(body.placeIds).toHaveLength(0);
    await app.close();
  });
  it('answers a day-plan question through runGroundedPlanner with the model\'s own schedule', async () => {
    // The fast path deliberately declines day-plan questions (/plan|day|…/),
    // so this question can only be served by the guarded model path — the
    // path that used to be a stub returning [] (a guaranteed refusal).
    const scripted = {
      async json<T>(): Promise<{ raw: T; usage: { tokensIn: number; tokensOut: number }; model: string }> {
        return {
          raw: {
            stops: [
              { ref: 1, dayIndex: 0, startMin: 600, durationMin: 90, reasonCode: 'MATCHES_TOPIC' },
            ],
            languageCode: 'en',
          } as unknown as T,
          usage: { tokensIn: 10, tokensOut: 10 },
          model: 'scripted',
        };
      },
      async vision<T>(): Promise<never> {
        throw new Error('not used');
      },
    };
    const cap = captureSender();
    const app = buildApp({ pool, inference: scripted, minCandidates: 1, emailSender: cap.sender });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST',
      url: '/api/ask',
      headers,
      payload: { text: 'plan my whole day of eating arepas', language: 'en', lat: 10.4716, lon: -68.0056 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { kind: string; text: string; placeIds: string[]; questionId?: string };
    expect(body.kind).toBe('answer');
    expect(body.text).toContain('Arepera La Guacamaya');
    // 10:00 is the MODEL's chosen time — proof the schedule survived the
    // guard (the old stub synthesized 09:00 + i*75 regardless).
    expect(body.text).toContain('10:00');
    expect(body.placeIds).toEqual(['00000000-0000-4000-8000-0000000000d1']);
    expect(body.questionId).toBeTruthy(); // the demand record exists
    await app.close();
  });
});
