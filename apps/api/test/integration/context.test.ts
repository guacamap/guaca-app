import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { authTourist, captureSender } from '../helpers/touristTestAuth.ts';
import { migrate } from '@guaca/db';
import { FakeInference } from '@guaca/agents';
import type { AreaContext, ContextProvider } from '../../src/context.ts';

const TEST_DB = 'guaca_context';
const base = process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca';
const url = (db: string) => base.replace(/\/guaca$/, '/' + db);
const pool = new pg.Pool({ connectionString: url(TEST_DB) });
const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER = '00000000-0000-4000-8000-0000000000c1';
const WITNESS = '00000000-0000-4000-8000-0000000000c2';

const calm: AreaContext = {
  localTime: '2026-09-08T15:10',
  weather: { tempC: 31, rainPct: 10, windKmh: 12, uv: 9, summary: 'clear' },
  sea: { waveM: 0.4, swellM: 0.3, seaTempC: 29, state: 'calm' },
  sun: { sunrise: '06:22', sunset: '18:41' },
  holiday: { name: 'Feast of Our Lady of the Valley', localName: 'Día del Virgen del Valle' },
  rates: { currency: 'VES', official: 791.67, parallel: 911.73, asOf: '2026-08-28' },
  alert: null,
};
let current: AreaContext = calm;
const stub: ContextProvider = { forArea: async () => current };

/**
 * The day's facts shape the answer without ever supplying a place: rough
 * sea drops beaches from the catalog and says so, a holiday is a note, and
 * an alert nearby is the one thing that outranks the map.
 */
describe('area context in the ask path', () => {
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
    await c.query(`insert into spotters (id, name, phone, area_id, home_h3, level) values ($1,'Yorman Salazar','+58 412 000 0001',$2,$3,2)`, [SPOTTER, AREA_ID, cell.rows[0]!.c]);
    await c.query(`insert into spotters (id, name, phone, area_id, home_h3, level) values ($1,'María Fernanda','+58 412 000 0002',$2,$3,1)`, [WITNESS, AREA_ID, cell.rows[0]!.c]);
    const rows: Array<[string, string, number]> = [
      ['Playa Delfín', 'beach_water', 0], ['Balneario Quizandal', 'beach_water', 0.002], ['Playa Blanca', 'beach_water', 0.004],
      ['Arepera El Malecón', 'eat_drink', 0.001], ['Café Colonial', 'eat_drink', 0.003], ['Panadería La Espiga', 'eat_drink', 0.005],
    ];
    for (const [name, category, dx] of rows) {
      await c.query(
        `insert into places (area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id, verified_at)
         values ($1, $2, $3, 'frente al malecón', ST_SetSRID(ST_MakePoint(-68.0056 + $4, 10.4716), 4326)::geography, $5, 'spotter', 'verified', 2, $6, $7, now())`,
        [AREA_ID, name, category, dx, cell.rows[0]!.c, SPOTTER, WITNESS],
      );
    }
    c.release();
    app = buildApp({ pool, inference: new FakeInference(new Map()), minCandidates: 3, emailSender: capture.sender, contextProvider: stub });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    const admin = new pg.Pool({ connectionString: url('postgres') });
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.end();
  });

  it('GET /api/context resolves the area and returns the day', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/context?lat=10.4716&lon=-68.0056' });
    expect(res.statusCode).toBe(200);
    expect(res.json().area.slug).toBe('puerto-cabello');
    expect(res.json().context.sun.sunset).toBe('18:41');
  });

  it('a calm day answers a beach ask, with the holiday as a note', async () => {
    current = calm;
    const headers = await authTourist(app, capture.codes, 'guest@test.guaca.live');
    const res = await app.inject({ method: 'POST', url: '/api/ask', headers, payload: { text: 'a beach nearby', language: 'en', lat: 10.4716, lon: -68.0056 } });
    expect(res.json().kind).toBe('answer');
    expect(res.json().notes.join(' ')).toMatch(/public holiday/);
    expect(res.json().context.sea.state).toBe('calm');
  });

  it('a rough sea drops beaches from the catalog and says so', async () => {
    current = { ...calm, sea: { waveM: 1.8, swellM: 1.4, seaTempC: 28, state: 'rough' } };
    const headers = await authTourist(app, capture.codes, 'guest@test.guaca.live');
    const res = await app.inject({ method: 'POST', url: '/api/ask', headers, payload: { text: 'a beach nearby', language: 'en', lat: 10.4716, lon: -68.0056 } });
    expect(res.json().kind).toBe('refusal');
    expect(res.json().notes.join(' ')).toMatch(/Rough sea today \(1\.8 m waves\): beaches left out/);
    // Food is untouched by the sea.
    const food = await app.inject({ method: 'POST', url: '/api/ask', headers, payload: { text: 'where can I eat nearby', language: 'en', lat: 10.4716, lon: -68.0056 } });
    expect(food.json().kind).toBe('answer');
  });

  it('an alert within reach puts Guaca in storm mode: no places, official sources', async () => {
    current = { ...calm, alert: { kind: 'tropical_cyclone', name: 'Beryl', level: 'HU', distanceKm: 140, source: 'NHC' } };
    const headers = await authTourist(app, capture.codes, 'guest@test.guaca.live');
    const res = await app.inject({ method: 'POST', url: '/api/ask', headers, payload: { text: 'where can I eat nearby', language: 'es', lat: 10.4716, lon: -68.0056 } });
    expect(res.json().kind).toBe('chat');
    expect(res.json().text).toMatch(/Beryl/);
    expect(res.json().text).toMatch(/nhc\.noaa\.gov/);
    expect(res.json().placeIds).toEqual([]);
    current = calm;
  });
});
