import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { migrate } from '@guaca/db';
import { FakeInference } from '@guaca/agents';
import { authTourist, captureSender } from '../helpers/touristTestAuth.ts';

const TEST_DB = 'guaca_trips_api';
const pool = new pg.Pool({
  connectionString: (
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
  ).replace(/\/guaca$/, '/' + TEST_DB),
});

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const S1 = '00000000-0000-4000-8000-0000000000c1';
const S2 = '00000000-0000-4000-8000-0000000000c2';

function place(i: number, name: string): string {
  return `('00000000-0000-4000-8000-${String(0xd00 + i).padStart(12, '0')}', '${AREA_ID}', '${name}', 'eat_drink', 'landmark ${i}',
    ST_SetSRID(ST_MakePoint(-68.005, ${10.47 + i * 0.001}), 4326)::geography, '8a0000000000000', 'spotter', 'verified', 2, '${S1}', '${S2}')`;
}

/** Scripted provider: a valid multi-day plan over catalog refs 1..4. */
const scriptedMultiDay = {
  async json<T>(): Promise<{ raw: T; usage: { tokensIn: number; tokensOut: number }; model: string }> {
    return {
      raw: {
        stops: [
          { ref: 1, dayIndex: 0, startMin: 540, durationMin: 60, reasonCode: 'MATCHES_TOPIC' },
          { ref: 2, dayIndex: 0, startMin: 700, durationMin: 90, reasonCode: 'NEAREST' },
          { ref: 3, dayIndex: 0, startMin: 900, durationMin: 60, reasonCode: 'OPEN_NOW' },
          { ref: 4, dayIndex: 1, startMin: 600, durationMin: 90, reasonCode: 'SEQUENCE_FIT' },
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

describe('trips — POST /api/plan, /api/trips, /api/t/:slug', () => {
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
        `insert into spotters (id, name, phone, area_id) values ('${S1}', 'Yorman', '+58 412 000 0001', $1), ('${S2}', 'María', '+58 412 000 0002', $1)`,
        [AREA_ID],
      );
      await client.query(
        `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id)
         values ${place(1, 'Arepera La Guacamaya')}, ${place(2, 'Café El Puerto')}, ${place(3, 'Heladería El Malecón')}, ${place(4, 'Muelle de los Pescadores')}`,
      );
    } finally {
      client.release();
    }
  });
  afterAll(async () => {
    await pool.end();
  });

  it('creates, saves and shares a 2-day trip', async () => {
    const cap = captureSender();
    const app = buildApp({ pool, inference: scriptedMultiDay, minCandidates: 1, emailSender: cap.sender });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST',
      url: '/api/plan',
      headers,
      payload: {
        text: 'plan two days of eating arepas',
        language: 'en',
        lat: 10.4716,
        lon: -68.0056,
        days: 2,
        pace: 'balanced',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      kind: string;
      text: string;
      placeIds: string[];
      trip?: { id: string; shareSlug: string; stops: Array<{ dayIndex: number }> };
    };
    expect(body.kind).toBe('trip');
    expect(body.text).toContain('Day 1');
    expect(body.text).toContain('Day 2');
    expect(body.trip).toBeTruthy();
    expect(body.trip!.stops).toHaveLength(4);

    // The owner sees it in their list.
    const list = await app.inject({ method: 'GET', url: '/api/trips', headers });
    expect(list.statusCode).toBe(200);
    expect(((list.json() as { trips: unknown[] }).trips)).toHaveLength(1);

    // The public share link needs no account.
    const share = await app.inject({ method: 'GET', url: `/api/t/${body.trip!.shareSlug}` });
    expect(share.statusCode).toBe(200);
    expect((share.json() as { trip: { question: string } }).trip.question).toContain('arepas');

    // Delete removes it for the owner AND kills the public link.
    const del = await app.inject({ method: 'DELETE', url: `/api/trips/${body.trip!.id}`, headers });
    expect(del.statusCode).toBe(200);
    const shareAfter = await app.inject({ method: 'GET', url: `/api/t/${body.trip!.shareSlug}` });
    expect(shareAfter.statusCode).toBe(404);
    await app.close();
  });

  it('pace=relaxed trims a packed day to 3 stops, earliest kept', async () => {
    const packed: typeof scriptedMultiDay = {
      async json<T>() {
        return {
          raw: {
            stops: [
              { ref: 1, dayIndex: 0, startMin: 540, durationMin: 60, reasonCode: 'MATCHES_TOPIC' },
              { ref: 2, dayIndex: 0, startMin: 660, durationMin: 60, reasonCode: 'NEAREST' },
              { ref: 3, dayIndex: 0, startMin: 800, durationMin: 60, reasonCode: 'OPEN_NOW' },
              { ref: 4, dayIndex: 0, startMin: 950, durationMin: 60, reasonCode: 'SEQUENCE_FIT' },
            ],
            languageCode: 'en',
          } as unknown as T,
          usage: { tokensIn: 10, tokensOut: 10 },
          model: 'packed',
        };
      },
      async vision<T>(): Promise<never> {
        throw new Error('not used');
      },
    };
    const cap = captureSender();
    const app = buildApp({ pool, inference: packed, minCandidates: 1, emailSender: cap.sender });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST',
      url: '/api/plan',
      headers,
      payload: { text: 'one relaxed day of eating arepas', language: 'en', lat: 10.4716, lon: -68.0056, days: 1, pace: 'relaxed' },
    });
    const body = res.json() as { kind: string; trip?: { stops: unknown[] }; placeIds: string[] };
    expect(body.kind).toBe('trip');
    expect(body.trip!.stops).toHaveLength(3); // 4 offered, relaxed keeps 3
    expect(body.placeIds).toHaveLength(3);
    await app.close();
  });

  it('refuses when coverage is thin, and records the demand', async () => {
    const cap = captureSender();
    const app = buildApp({ pool, inference: new FakeInference({}), minCandidates: 99, emailSender: cap.sender });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST',
      url: '/api/plan',
      headers,
      payload: { text: 'plan a week of eating arepas', language: 'en', lat: 10.4716, lon: -68.0056, days: 7, pace: 'balanced' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { kind: string; text: string; placeIds: string[]; questionId?: string };
    expect(body.kind).toBe('refusal');
    expect(body.text).toContain('No one has verified');
    expect(body.questionId).toBeTruthy();
    await app.close();
  });

  it('rejects an invalid trip request (contract-enforced)', async () => {
    const cap = captureSender();
    const app = buildApp({ pool, inference: new FakeInference({}), emailSender: cap.sender });
    const headers = await authTourist(app, cap.codes);
    const res = await app.inject({
      method: 'POST',
      url: '/api/plan',
      headers,
      payload: { text: 'x', language: 'en', lat: 10.47, lon: -68.0, days: 9, pace: 'warp' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
