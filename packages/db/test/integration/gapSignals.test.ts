import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import { loadGapSignals, listSpotterCandidates } from '../../src/gap/signals.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_gap_signals';
const AREA = '00000000-0000-4000-8000-00000000000a';

describe('loadGapSignals — real scoring inputs', () => {
  let pool: pg.Pool;
  let cell: string;
  beforeAll(async () => {
    pool = await createTempDb(DB);
    const c = await pool.connect();
    await migrate(c);
    await c.query(`insert into areas(id,name,slug,country,timezone,geom) values ($1,'PC','pc','VE','America/Caracas', ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`, [AREA]);
    const h = await c.query(`select h3_lat_lng_to_cell(point(-68.0056, 10.4716), 8)::text as c`);
    cell = h.rows[0].c;
    await c.query(`insert into spotters(id,name,phone,area_id,home_h3) values ('00000000-0000-4000-8000-0000000000c1','Yorman','+58001',$1,$2)`, [AREA, cell]);
    await c.query(`insert into properties(name,area_id,location,qr_token,plan,subscription_minor) values ('Villa',$1, ST_SetSRID(ST_MakePoint(-68.0056,10.4716),4326)::geography,'tok','paid',2000)`, [AREA]);
    c.release();
  });
  afterAll(async () => { await dropTempDb(DB, pool); });

  it('finds the paying property near the gap cell', async () => {
    const s = await loadGapSignals(pool, { id: 'x', category: 'eat_drink', h3_8: cell });
    expect(s.properties.length).toBeGreaterThan(0);
    expect(s.properties[0]!.tier).toBe('PARTNER');
    expect(s.properties[0]!.distanceKm).toBeLessThan(1);
  });

  it('reports spotter capacity for the zone', async () => {
    const s = await loadGapSignals(pool, { id: 'x', category: 'eat_drink', h3_8: cell });
    expect(s.spotterCapacityInZone).toBeGreaterThan(0);
  });

  it('lists spotter candidates with their open-mission load', async () => {
    const c = await listSpotterCandidates(pool, cell);
    expect(c).toHaveLength(1);
    expect(c[0]!.name).toBe('Yorman');
    expect(c[0]!.openMissions).toBe(0);
  });
});
