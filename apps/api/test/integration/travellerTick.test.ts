import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { authTourist, captureSender } from '../helpers/touristTestAuth.ts';
import { migrate, getTravellerState, setActivePlan } from '@guaca/db';
import type { Inference, JsonRequest, JsonResult } from '@guaca/agents';
import type { AreaContext, ContextProvider } from '../../src/context.ts';
import { runTravellerTick } from '../../src/travellerTick.ts';

const TEST_DB = 'guaca_traveller_tick';
const base = process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca';
const url = (db: string) => base.replace(/\/guaca$/, '/' + db);
const pool = new pg.Pool({ connectionString: url(TEST_DB) });
const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER = '00000000-0000-4000-8000-0000000000c1';
const WITNESS = '00000000-0000-4000-8000-0000000000c2';

const dry = Array(24).fill(5);
const wetAfternoon = dry.map((_, h) => (h >= 14 && h < 17 ? 85 : 5));
const base_ctx: AreaContext = {
  localTime: '2026-09-08T09:10',
  weather: { tempC: 30, rainPct: 10, windKmh: 8, uv: 7, summary: 'clear', rainByHour: dry, rainByHourTomorrow: dry },
  sea: { waveM: 0.3, swellM: 0.2, seaTempC: 29, state: 'calm' },
  sun: { sunrise: '06:20', sunset: '18:40' },
  holiday: null, rates: null, alert: null,
};
let current: AreaContext = base_ctx;
const stub: ContextProvider = { forArea: async () => current };

/** The concierge remembers one thing and chats; nothing else is ever asked of it. */
class Concierge implements Inference {
  async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
    const ok = (raw: unknown) => ({ raw: raw as T, usage: { tokensIn: 1, tokensOut: 1 }, model: 'x' });
    if (req.purpose === 'concierge-guard') return ok({ pointsAtSomething: false, cleaned: req.user });
    if (req.purpose === 'concierge' && req.system.includes('messaging the traveller first')) return ok({ text: `Guaca first: ${req.user.slice(8, 60)}` });
    if (req.purpose === 'concierge') {
      const partner = /girlfriend|partner/i.test(req.user);
      if (/plan my day/i.test(req.user)) return ok({ mode: 'ask', reply: 'On it.', askText: 'plan my day: a beach and some history', category: 'beach_water' });
      return ok({ mode: 'chat', reply: 'Nice. What are you in the mood for?', learned: partner ? ['travelling with partner'] : [] });
    }
    if (req.purpose === 'intent.classify') return ok({ category: 'beach_water' });
    if (req.purpose === 'plan') return ok({ stops: [{ ref: 1, dayIndex: 0, startMin: 600, durationMin: 90, reasonCode: 'MATCHES_TOPIC' }, { ref: 2, dayIndex: 0, startMin: 780, durationMin: 60, reasonCode: 'MATCHES_TOPIC' }], languageCode: 'en' });
    throw new Error(`unexpected ${req.purpose}`);
  }
  async vision<T>(): Promise<JsonResult<T>> { throw new Error('unused'); }
}

describe('Guaca remembers, and speaks first', () => {
  let app: ReturnType<typeof buildApp>;
  const capture = captureSender();
  let headers: Record<string, string>;
  let touristId = '';
  const placeIds: string[] = [];

  beforeAll(async () => {
    const admin = new pg.Pool({ connectionString: url('postgres') });
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.query(`create database ${TEST_DB} template template_postgis`);
    await admin.end();
    const c = await pool.connect();
    await migrate(c);
    await c.query(`insert into areas (id, name, slug, country, timezone, geom) values ($1,'Puerto Cabello','puerto-cabello','VE','America/Caracas', ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`, [AREA_ID]);
    const cell = await c.query<{ c: string }>(`select h3_lat_lng_to_cell(point(-68.0056, 10.4716), 8)::text as c`);
    await c.query(`insert into spotters (id, name, phone, area_id, home_h3, level) values ($1,'Yorman','+58 412 000 0001',$2,$3,2),($4,'María','+58 412 000 0002',$2,$3,1)`, [SPOTTER, AREA_ID, cell.rows[0]!.c, WITNESS]);
    for (const [name, category, dx] of [['Playa Delfín', 'beach_water', 0], ['Museo del Puerto', 'culture_history', 0.002], ['Café Colonial', 'eat_drink', 0.003]] as const) {
      const r = await c.query<{ id: string }>(
        `insert into places (area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id, verified_at)
         values ($1, $2, $3, 'frente al malecón', ST_SetSRID(ST_MakePoint(-68.0056 + $4, 10.4716), 4326)::geography, $5, 'spotter', 'verified', 2, $6, $7, now()) returning id`,
        [AREA_ID, name, category, dx, cell.rows[0]!.c, SPOTTER, WITNESS],
      );
      placeIds.push(r.rows[0]!.id);
    }
    c.release();
    app = buildApp({ pool, inference: new Concierge(), minCandidates: 1, emailSender: capture.sender, contextProvider: stub });
    await app.ready();
    headers = await authTourist(app, capture.codes);
    const me = await pool.query<{ id: string }>(`select id from tourists order by created_at desc limit 1`);
    touristId = me.rows[0]!.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    const admin = new pg.Pool({ connectionString: url('postgres') });
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.end();
  });

  it('what a turn teaches is kept, and the next turn is told', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/ask', headers, payload: { text: 'hey, me and my girlfriend just got in', language: 'en', lat: 10.4716, lon: -68.0056 } });
    expect(r.json()).toMatchObject({ kind: 'chat' });
    await new Promise((res) => setTimeout(res, 50));
    const s = await getTravellerState(pool, touristId);
    expect(s?.notes).toEqual(['travelling with partner']);
    expect(s?.lastLat).toBeCloseTo(10.4716, 3);
  });

  it('a plan of two stops becomes the plan Guaca keeps for the day', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/ask', headers, payload: { text: 'plan my day: a beach and some history', language: 'en', lat: 10.4716, lon: -68.0056 } });
    expect(r.json()).toMatchObject({ kind: 'answer' });
    await new Promise((res) => setTimeout(res, 50));
    const s = await getTravellerState(pool, touristId);
    expect(s?.activePlanDate).toBe('2026-09-08');
    expect(s?.activePlan?.stops.map((x) => x.name)).toEqual(['Playa Delfín', 'Museo del Puerto']);
  });

  it('rain moving onto the beach in the next two hours makes Guaca replan and speak first', async () => {
    current = { ...base_ctx, localTime: '2026-09-08T08:30', weather: { ...base_ctx.weather!, rainByHour: dry.map((_, h) => (h === 10 ? 80 : 5)) } };
    const tick = await runTravellerTick({ pool, inference: new Concierge(), contextProvider: stub, minCandidates: 1 });
    expect(tick.spoke).toEqual([{ touristId, trigger: 'rain_replan' }]);
    const inbox = await app.inject({ method: 'GET', url: '/api/tourist/inbox', headers });
    const msgs = (inbox.json() as { messages: Array<{ trigger: string; text: string; payload: { plan: string } }> }).messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.trigger).toBe('rain_replan');
    expect(msgs[0]!.text).toMatch(/Guaca first: Rain is now likely around 10:00/);
    expect(msgs[0]!.payload.plan).toMatch(/Here is your plan/);
    // Handed over once.
    const again = await app.inject({ method: 'GET', url: '/api/tourist/inbox', headers });
    expect((again.json() as { messages: unknown[] }).messages).toHaveLength(0);
  });

  it('the same trigger does not fire twice in a day, and nothing fires at night', async () => {
    current = { ...current, localTime: '2026-09-08T08:45' };
    const same = await runTravellerTick({ pool, inference: new Concierge(), contextProvider: stub, minCandidates: 1 });
    expect(same.spoke).toEqual([]);
    current = { ...current, localTime: '2026-09-08T23:10' };
    const night = await runTravellerTick({ pool, inference: new Concierge(), contextProvider: stub, minCandidates: 1 });
    expect(night.spoke).toEqual([]);
  });

  it('after the last stop, Guaca asks how the day went; "not there" files a doubt for a local', async () => {
    current = { ...base_ctx, localTime: '2026-09-08T19:00' };
    const tick = await runTravellerTick({ pool, inference: new Concierge(), contextProvider: stub, minCandidates: 1 });
    expect(tick.spoke).toEqual([{ touristId, trigger: 'evening_checkin' }]);
    const inbox = await app.inject({ method: 'GET', url: '/api/tourist/inbox', headers });
    const msg = (inbox.json() as { messages: Array<{ payload: { stops: Array<{ placeId: string }> } }> }).messages[0]!;
    const fb = await app.inject({ method: 'POST', url: '/api/tourist/feedback', headers, payload: { verdicts: [{ placeId: msg.payload.stops[0]!.placeId, verdict: 'good' }, { placeId: msg.payload.stops[1]!.placeId, verdict: 'not_there' }] } });
    expect(fb.statusCode).toBe(201);
    const q = await pool.query<{ raw_text: string }>(`select raw_text from questions where refusal_reason = 'TRAVELLER_SAYS_NOT_THERE'`);
    expect(q.rows.map((r) => r.raw_text)).toEqual(['[not there] Museo del Puerto']);
  });

  it('a morning with no plan gets one offer', async () => {
    await setActivePlan(pool, touristId, null, null);
    current = { ...base_ctx, localTime: '2026-09-09T08:40' };
    const tick = await runTravellerTick({ pool, inference: new Concierge(), contextProvider: stub, minCandidates: 1 });
    expect(tick.spoke).toEqual([{ touristId, trigger: 'morning_plan' }]);
  });
});
