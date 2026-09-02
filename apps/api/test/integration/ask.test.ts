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

  it('answers a covered question from verified data (fast path, no planner call)', async () => {
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
    // Guaca takes the turn (one concierge call), then the fast path serves
    // the answer itself without a planner call: the places came from the map.
    expect(fake.calls.map((c) => c.purpose)).toEqual(['concierge']);
    await app.close();
  });

  it('a single-topic question is answered from its CATEGORY only — live music never cites arepas', async () => {
    // The DB holds one verified eat_drink place; the question is nightlife.
    // The old model path offered the whole catalog and answered with an
    // arepera. Now: catalog filtered to nightlife = empty → honest refusal,
    // no planner call, demand recorded for the gap agent.
    const fake = new FakeInference({});
    const cap = captureSender();
    const app = buildApp({ pool, inference: fake, minCandidates: 1, emailSender: cap.sender });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST',
      url: '/api/ask',
      headers,
      payload: { text: 'where can I hear live music tonight?', language: 'en', lat: 10.4716, lon: -68.0056 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { kind: string; placeIds: string[]; questionId?: string };
    expect(body.kind).toBe('refusal');
    expect(body.placeIds).toHaveLength(0);
    expect(body.questionId).toBeTruthy();
    // The concierge takes the turn and then says the refusal in its own
    // words; no planner call was ever made, so nothing could cite the arepera.
    expect(fake.calls.map((c) => c.purpose)).toEqual(['concierge', 'concierge']);
    await app.close();
  });

  it('a corroborated beach is planned with its tier said out loud; the single listing is not preferred', async () => {
    // Nobody verified a beach. Two open datasets agree one exists, one
    // dataset lists another. Tiered honesty: the plan may use them and must
    // say so, corroborated first.
    await pool.query(
      `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, corroboration)
       values
        ('00000000-0000-4000-8000-0000000000e1', $1, 'Playa Blanca', 'beach_water', 'Listado público', ST_SetSRID(ST_MakePoint(-68.0100, 10.4800), 4326)::geography, '8a0000000000000', 'overture_candidate', 'candidate', 0, 2),
        ('00000000-0000-4000-8000-0000000000e2', $1, 'Playa Escondida', 'beach_water', 'Listado público', ST_SetSRID(ST_MakePoint(-68.0060, 10.4730), 4326)::geography, '8a0000000000000', 'foursquare_candidate', 'candidate', 0, 1)`,
      [AREA_ID],
    );
    const fake = new FakeInference({});
    const cap = captureSender();
    const app = buildApp({ pool, inference: fake, minCandidates: 1, emailSender: cap.sender });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST', url: '/api/ask', headers,
      payload: { text: 'a beach nearby', language: 'en', lat: 10.4716, lon: -68.0056 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { kind: string; placeIds: string[]; text: string };
    expect(body.kind).toBe('answer');
    expect(body.placeIds[0]).toBe('00000000-0000-4000-8000-0000000000e1');
    expect(body.text).toMatch(/2 open maps agree it exists/);
    expect(body.text).toMatch(/Unverified stops come from open maps/);
    // The used open-data stops are now demand: unanswered questions at their
    // own points, which is what the gap agent clusters into missions.
    const demand = await pool.query<{ raw_text: string; refusal_reason: string }>(
      `select raw_text, refusal_reason from questions where refusal_reason = 'UNVERIFIED_STOP_USED' order by raw_text`,
    );
    expect(demand.rows.map((r) => r.raw_text)).toEqual(['Confirm: Playa Blanca (2 open maps)', 'Confirm: Playa Escondida (1 open maps)']);
    await pool.query(`delete from places where id in ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000e2')`);
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
    expect(body.text).toMatch(/Nobody has stood in front/);
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
