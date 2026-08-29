import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { authTourist, captureSender } from '../helpers/touristTestAuth.ts';
import { migrate } from '@guaca/db';
import { FakeInference } from '@guaca/agents';

const TEST_DB = 'guaca_ask_mission';
const base = process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca';
const url = (db: string) => base.replace(/\/guaca$/, '/' + db);
const pool = new pg.Pool({ connectionString: url(TEST_DB) });
const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER = '00000000-0000-4000-8000-0000000000c1';
const WITNESS = '00000000-0000-4000-8000-0000000000c2';

/**
 * A refusal is not a dead end. The traveller sees what IS verified nearby,
 * gets chips that re-ask through the same grounded path, and, as the last
 * option, can send a local: the real gap agent, scoped to their question's
 * gap, with every guard but the score floor.
 */
describe('a refused question can be turned into a mission by the traveller', () => {
  let app: ReturnType<typeof buildApp>;
  const capture = captureSender();

  beforeAll(async () => {
    const admin = new pg.Pool({ connectionString: url('postgres') });
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.query(`create database ${TEST_DB} template template_postgis`);
    await admin.end();
    const c = await pool.connect();
    await migrate(c);
    await c.query(
      `insert into areas (id, name, slug, country, timezone, geom) values
        ($1,'Puerto Cabello','puerto-cabello','VE','America/Caracas',
         ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
      [AREA_ID],
    );
    const cell = await c.query<{ c: string }>(`select h3_lat_lng_to_cell(point(-68.0056, 10.4716), 8)::text as c`);
    await c.query(
      `insert into spotters (id, name, phone, area_id, home_h3, level) values ($1,'Yorman Salazar','+58 412 000 0001',$2,$3,2)`,
      [SPOTTER, AREA_ID, cell.rows[0]!.c],
    );
    await c.query(
      `insert into spotters (id, name, phone, area_id, home_h3, level) values ($1,'María Fernanda','+58 412 000 0002',$2,$3,1)`,
      [WITNESS, AREA_ID, cell.rows[0]!.c],
    );
    // Three verified places to eat (two witnesses each, as the schema
    // demands), so the refusal can offer them as a chip.
    for (const [name, dx] of [['Arepera El Malecón', 0], ['Café Colonial', 0.001], ['Panadería La Espiga', 0.002]] as const) {
      await c.query(
        `insert into places (area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id, verified_at)
         values ($1, $2, 'eat_drink', 'frente al malecón', ST_SetSRID(ST_MakePoint(-68.0056 + $3, 10.4716), 4326)::geography, $4, 'spotter', 'verified', 2, $5, $6, now())`,
        [AREA_ID, name, dx, cell.rows[0]!.c, SPOTTER, WITNESS],
      );
    }
    c.release();
    app = buildApp({ pool, inference: new FakeInference(new Map()), minCandidates: 3, emailSender: capture.sender });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    const admin = new pg.Pool({ connectionString: url('postgres') });
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.end();
  });

  let questionId = '';

  it('the refusal says what is verified nearby and ends with the mission option', async () => {
    const headers = await authTourist(app, capture.codes, 'guest@test.guaca.live');
    const res = await app.inject({
      method: 'POST', url: '/api/ask', headers,
      payload: { text: 'is there anywhere to snorkel near Isla Larga?', language: 'en', lat: 10.4716, lon: -68.0056 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe('refusal');
    expect(body.refusal.coverage.verifiedNearby).toBe(3);
    expect(body.refusal.category).toBe('beach_water');
    expect(body.refusal.coverage.inCategory).toBe(0);
    const kinds = body.refusal.options.map((o: { kind: string }) => o.kind);
    // What exists nearby is offered as a chip; the watch and the mission close the list.
    expect(kinds).toContain('refine');
    expect(kinds.slice(-2)).toEqual(['notify', 'mission']);
    const refine = body.refusal.options.find((o: { kind: string }) => o.kind === 'refine');
    expect(refine.category).toBe('eat_drink');
    expect(refine.label).toMatch(/\(3\)$/);
    questionId = body.questionId;
    expect(questionId).toBeTruthy();
  });

  it('a chip re-asks through the grounded path and gets a real answer', async () => {
    const headers = await authTourist(app, capture.codes, 'guest@test.guaca.live');
    const res = await app.inject({
      method: 'POST', url: '/api/ask', headers,
      payload: { text: 'where can I eat nearby', language: 'en', lat: 10.4716, lon: -68.0056 },
    });
    expect(res.json().kind).toBe('answer');
    expect(res.json().placeIds.length).toBeGreaterThan(0);
  });

  it('sending a local commissions ONE mission to the zone spotter and watches the question', async () => {
    const headers = await authTourist(app, capture.codes, 'guest@test.guaca.live');
    const res = await app.inject({ method: 'POST', url: `/api/questions/${questionId}/mission`, headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('commissioned');
    expect(body.spotterName).toBe('Yorman S.');
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const m = await pool.query<{ n: number }>(`select count(*)::int as n from missions where status = 'offered' and target_category = 'beach_water'`);
    expect(m.rows[0]!.n).toBe(1);
    const w = await pool.query<{ n: number }>(`select count(*)::int as n from question_notifications where question_id = $1`, [questionId]);
    expect(w.rows[0]!.n).toBe(1);
  });

  it('asking again does not commission twice', async () => {
    const headers = await authTourist(app, capture.codes, 'guest@test.guaca.live');
    const res = await app.inject({ method: 'POST', url: `/api/questions/${questionId}/mission`, headers });
    expect(res.json().status).toBe('already_open');
    const m = await pool.query<{ n: number }>(`select count(*)::int as n from missions where status in ('offered','accepted','submitted')`);
    expect(m.rows[0]!.n).toBe(1);
  });

  it('a stranger cannot do it', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/questions/${questionId}/mission` });
    expect(res.statusCode).toBe(401);
  });
});
