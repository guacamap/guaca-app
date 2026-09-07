import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { migrate } from '@guaca/db';
import { FakeInference } from '@guaca/agents';
import { captureSender } from '../helpers/touristTestAuth.ts';
import { SHOWCASE_EMAIL, SHOWCASE_SPOTTER_ID } from '../../src/showcaseAccess.ts';

const TEST_DB = 'guaca_showcase_api';
const pool = new pg.Pool({
  connectionString: (
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
  ).replace(/\/guaca$/, '/' + TEST_DB),
});

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const S1 = '00000000-0000-4000-8000-0000000000c1';
const S2 = '00000000-0000-4000-8000-0000000000c2';
const PLACE_ID = '00000000-0000-4000-8000-000000000d01';
const CODE = '135790';
const SECRET = 'showcase-test-secret-0123456789abcdef';

const SHOWCASE_ENV = {
  SHOWCASE_ACCESS_ENABLED: 'true',
  SHOWCASE_ACCESS_CODE: CODE,
  SESSION_SECRET: SECRET,
};

function cookie(res: { cookies: Array<{ name: string; value: string }> }, name: string) {
  const c = res.cookies.find((entry) => entry.name === name);
  expect(c, `cookie ${name} set`).toBeTruthy();
  return `${name}=${c!.value}`;
}

describe('showcase access — optional deployed presentation login', () => {
  let saved: Record<string, string | undefined>;

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
         values ('${PLACE_ID}', '${AREA_ID}', 'Arepera La Guacamaya', 'eat_drink', 'by the port',
           ST_SetSRID(ST_MakePoint(-68.005, 10.471), 4326)::geography, '8a0000000000000', 'spotter', 'verified', 2, '${S1}', '${S2}')`,
      );
    } finally {
      client.release();
    }

    saved = {};
    for (const key of Object.keys(SHOWCASE_ENV)) {
      saved[key] = process.env[key];
      process.env[key] = SHOWCASE_ENV[key as keyof typeof SHOWCASE_ENV];
    }
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pool.end();
  });

  function build() {
    const cap = captureSender();
    const app = buildApp({ pool, inference: new FakeInference({}), minCandidates: 1, emailSender: cap.sender });
    return { app, cap };
  }

  it('is inert when disabled: the showcase email uses the ordinary email-code flow', async () => {
    process.env.SHOWCASE_ACCESS_ENABLED = 'false';
    try {
      const { app, cap } = build();
      const reqRes = await app.inject({
        method: 'POST',
        url: '/api/tourist/auth/request-code',
        payload: { email: SHOWCASE_EMAIL },
      });
      expect(reqRes.statusCode).toBe(200);
      expect((reqRes.json() as { delivery?: string }).delivery).toBeUndefined();
      expect(cap.codes[SHOWCASE_EMAIL]).toBeTruthy();

      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/tourist/auth/verify',
        payload: { email: SHOWCASE_EMAIL, code: cap.codes[SHOWCASE_EMAIL] },
      });
      expect(verifyRes.statusCode).toBe(200);
      const token = (verifyRes.json() as { token: string }).token;

      // An ordinary session carries no showcase restrictions.
      const doubt = await app.inject({
        method: 'POST',
        url: `/api/places/${PLACE_ID}/doubt`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: 'closed' },
      });
      expect(doubt.statusCode).not.toBe(403);
      await app.close();
    } finally {
      process.env.SHOWCASE_ACCESS_ENABLED = 'true';
    }
  });

  it('advertises access-code delivery instead of sending an email', async () => {
    const { app, cap } = build();
    const res = await app.inject({
      method: 'POST',
      url: '/api/tourist/auth/request-code',
      payload: { email: SHOWCASE_EMAIL },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, delivery: 'access-code' });
    expect(cap.codes[SHOWCASE_EMAIL]).toBeUndefined();
    await app.close();
  });

  it('rejects a wrong access code and rate-limits shared guesses', async () => {
    const { app } = build();
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tourist/auth/verify',
        payload: { email: SHOWCASE_EMAIL, code: '000000' },
      });
      expect(res.statusCode).toBe(401);
      expect((res.json() as { error: string }).error).toBe('Invalid access code.');
    }
    const sixth = await app.inject({
      method: 'POST',
      url: '/api/spotter/login', // the budget is shared across both roles
      payload: { email: SHOWCASE_EMAIL, code: '999999' },
    });
    expect(sixth.statusCode).toBe(429);
    await app.close();
  });

  it('logs the showcase tourist in and scopes writes to the presentation path', async () => {
    // Exercise account creation (demo:prepare normally seeds it); the upsert
    // must keep an existing account's stored language untouched.
    await pool.query('delete from tourists where email = $1', [SHOWCASE_EMAIL]);
    const { app } = build();
    const login = await app.inject({
      method: 'POST',
      url: '/api/tourist/auth/verify',
      payload: { email: SHOWCASE_EMAIL, code: CODE },
    });
    expect(login.statusCode).toBe(200);
    expect((login.json() as { language: string }).language).toBe('es');
    const touristCookie = cookie(login, 'guaca_tourist');

    const row = await pool.query('select id from tourists where email = $1', [SHOWCASE_EMAIL]);
    expect(row.rows.length).toBe(1);

    // Reads and presentation writes pass through.
    const me = await app.inject({ method: 'GET', url: '/api/tourist/me', headers: { cookie: touristCookie } });
    expect(me.statusCode).toBe(200);

    const ask = await app.inject({
      method: 'POST',
      url: '/api/ask',
      headers: { cookie: touristCookie },
      payload: { text: 'where can I eat arepas now?', language: 'en', lat: 10.4716, lon: -68.0056 },
    });
    expect(ask.statusCode).toBe(200);

    const favorite = await app.inject({
      method: 'POST',
      url: `/api/places/${PLACE_ID}/favorite`,
      headers: { cookie: touristCookie },
    });
    expect(favorite.statusCode).toBe(201);

    // Anything outside the safe list is refused.
    const doubt = await app.inject({
      method: 'POST',
      url: `/api/places/${PLACE_ID}/doubt`,
      headers: { cookie: touristCookie },
      payload: { reason: 'closed' },
    });
    expect(doubt.statusCode).toBe(403);
    expect((doubt.json() as { error: string }).error).toBe('This action is not available for this account.');

    // Commissioning a check from a question the account asked is part of the
    // presentation path.
    const mission = await app.inject({
      method: 'POST',
      url: '/api/questions/00000000-0000-4000-8000-0000000000e1/mission',
      headers: { cookie: touristCookie },
    });
    expect(mission.statusCode).not.toBe(403);

    const stayRequest = await app.inject({
      method: 'POST',
      url: '/api/stays/00000000-0000-4000-8000-00000000ab03/reservations',
      headers: { cookie: touristCookie },
      payload: {
        checkIn: '2026-09-12',
        checkOut: '2026-09-14',
        guests: 2,
        idempotencyKey: 'showcase-stay-request',
      },
    });
    expect(stayRequest.statusCode).not.toBe(403);

    const requestCheck = await app.inject({
      method: 'POST',
      url: `/api/places/${PLACE_ID}/observations/request-check`,
      headers: { cookie: touristCookie },
    });
    expect(requestCheck.statusCode).not.toBe(403);
    await app.close();
  });

  it('gives the spotter role a synthesized read-only profile with no roster row', async () => {
    const { app } = build();
    const login = await app.inject({
      method: 'POST',
      url: '/api/spotter/login',
      payload: { email: SHOWCASE_EMAIL, code: CODE },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({ ok: true, readOnly: true });
    const spotterCookie = cookie(login, 'guaca_spotter');

    const me = await app.inject({ method: 'GET', url: '/api/spotter/me', headers: { cookie: spotterCookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ id: SHOWCASE_SPOTTER_ID, readOnly: true });

    const write = await app.inject({
      method: 'POST',
      url: `/api/spotter/places/${PLACE_ID}/confirm`,
      headers: { cookie: spotterCookie },
      payload: { lat: 10.471, lon: -68.005 },
    });
    expect(write.statusCode).toBe(403);

    const roster = await pool.query('select id from spotters where id = $1', [SHOWCASE_SPOTTER_ID]);
    expect(roster.rows.length).toBe(0);
    await app.close();
  });

  it('expires showcase sessions when the code is rotated or the mechanism is switched off', async () => {
    const { app } = build();
    const login = await app.inject({
      method: 'POST',
      url: '/api/tourist/auth/verify',
      payload: { email: SHOWCASE_EMAIL, code: CODE },
    });
    expect(login.statusCode).toBe(200);
    const touristCookie = cookie(login, 'guaca_tourist');

    process.env.SHOWCASE_ACCESS_CODE = '246802';
    const rotated = await app.inject({ method: 'GET', url: '/api/tourist/me', headers: { cookie: touristCookie } });
    expect(rotated.statusCode).toBe(401);
    expect((rotated.json() as { error: string }).error).toBe('Access has expired. Sign in again.');

    process.env.SHOWCASE_ACCESS_ENABLED = 'false';
    const disabled = await app.inject({ method: 'GET', url: '/api/tourist/me', headers: { cookie: touristCookie } });
    expect(disabled.statusCode).toBe(401);

    process.env.SHOWCASE_ACCESS_CODE = CODE;
    process.env.SHOWCASE_ACCESS_ENABLED = 'true';
    await app.close();
  });
});
