import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import { recomputeZoneDemand, zoneDemand } from '../../src/zoneDemand.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_zone_demand';
const AREA = '00000000-0000-4000-8000-00000000000a';
const ZONE_A = 'zone-malecon';
const ZONE_B = 'zone-patanemo';

describe('zone_demand — people-per-zone, persisted and read back', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = await createTempDb(DB);
    const c = await pool.connect();
    await migrate(c);
    await c.query(
      `insert into areas(id,name,slug,country,timezone,geom) values ($1,'PC','pc','VE','America/Caracas', ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
      [AREA],
    );
    // Two disjoint zones: A around the pilot centre, B far away (Patanemo).
    await c.query(
      `insert into zones(id, area_id, name, geom) values
        ($1, $2, 'Malecón', ST_GeogFromText('POLYGON((-68.02 10.46,-67.99 10.46,-67.99 10.49,-68.02 10.49,-68.02 10.46))')),
        ($3, $2, 'Patanemo', ST_GeogFromText('POLYGON((-67.90 10.55,-67.88 10.55,-67.88 10.57,-67.90 10.57,-67.90 10.55))'))`,
      [ZONE_A, AREA, ZONE_B],
    );
    const h = await c.query(`select h3_lat_lng_to_cell(point(-68.0056, 10.4716), 8)::text as c`);
    const cell = h.rows[0]!.c;
    // Three sessions, four questions, all inside Zone A. One is old (>30d).
    for (let s = 1; s <= 3; s++) {
      await c.query(`insert into sessions default values`);
    }
    const sess = await c.query(`select id from sessions order by created_at asc`);
    const ids = sess.rows.map((r: { id: string }) => r.id);
    await c.query(
      `insert into questions(session_id, area_id, raw_text, language, intent, answered, created_at) values
        ($1, $3, 'q1', 'en', jsonb_build_object('category','eat_drink','h3_8',$4::text), false, now() - interval '2 days'),
        ($2, $3, 'q2', 'en', jsonb_build_object('category','eat_drink','h3_8',$4::text), false, now() - interval '3 days'),
        ($2, $3, 'q3', 'en', jsonb_build_object('category','beach_water','h3_8',$4::text), false, now() - interval '4 days'),
        ($1, $3, 'old', 'en', jsonb_build_object('category','eat_drink','h3_8',$4::text), false, now() - interval '60 days')`,
      [ids[0], ids[1], AREA, cell],
    );
    // An open gap in Zone A and one in Zone B (outside any question).
    await c.query(
      `insert into gaps(area_id, category, h3_8, question_count, distinct_session_count) values
        ($1, 'eat_drink', $2, 3, 2)`,
      [AREA, cell],
    );
    c.release();
  });
  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('counts DISTINCT people (sessions), not asks, within the 30d window', async () => {
    await recomputeZoneDemand(pool, AREA);
    const rows = await zoneDemand(pool, AREA);
    const a = rows.find((r) => r.zoneId === ZONE_A);
    expect(a).toBeDefined();
    expect(a!.peopleCount).toBe(2); // sessions 1 and 2 — the 60-day-old ask is out
    expect(a!.askCount).toBe(3); // three asks in-window
    expect(a!.openGaps).toBe(1);
    expect(a!.lastAskedAt).not.toBeNull();
  });

  it('zero-demand zones keep a row with zeros — silence is data too', async () => {
    const rows = await zoneDemand(pool, AREA);
    const b = rows.find((r) => r.zoneId === ZONE_B);
    expect(b).toBeDefined();
    expect(b!.peopleCount).toBe(0);
  });

  it('recompute is idempotent and refreshes on new demand', async () => {
    const before = await zoneDemand(pool, AREA);
    const n = await recomputeZoneDemand(pool, AREA);
    expect(n).toBe(2);
    const after = await zoneDemand(pool, AREA);
    expect(after.map((r) => r.zoneId)).toEqual(before.map((r) => r.zoneId));
    expect(after[0]!.peopleCount).toBe(before[0]!.peopleCount);
  });
});
