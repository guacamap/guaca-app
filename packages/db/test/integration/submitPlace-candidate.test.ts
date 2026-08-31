import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../../src/migrate.js';
import { submitPlace } from '../../src/submitPlace.js';

const TEST_DB = 'guaca_submit_candidate';
const base = process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca';
const url = (db: string) => base.replace(/\/guaca$/, '/' + db);
const pool = new pg.Pool({ connectionString: url(TEST_DB) });
const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER_A = '00000000-0000-4000-8000-0000000000c1';
const SPOTTER_B = '00000000-0000-4000-8000-0000000000c2';
let candidateId = '';

describe('submitPlace promotes a candidate instead of duplicating it', () => {
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
    await c.query(`insert into spotters (id, name, phone, area_id, home_h3, level) values ($1,'Yorman','+58 412 000 0001',$2,$3,2),($4,'María','+58 412 000 0002',$2,$3,1)`, [SPOTTER_A, AREA_ID, cell.rows[0]!.c, SPOTTER_B]);
    const cand = await c.query<{ id: string }>(
      `insert into places (area_id, name, category, landmark_description, location, h3_8, source, verification_status, public_phone, public_website, public_source, overture_id)
       values ($1, 'El Merendero de Azafran', 'eat_drink', 'Listado público (Overture Maps)',
               ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography, $2, 'overture_candidate', 'candidate',
               '+584144325599', 'http://www.azafran.com.ve', 'overture', 'ovt-123')
       returning id`,
      [AREA_ID, cell.rows[0]!.c],
    );
    candidateId = cand.rows[0]!.id;
    c.release();
  });

  afterAll(async () => {
    await pool.end();
    const admin = new pg.Pool({ connectionString: url('postgres') });
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.end();
  });

  it('promotes the candidate in place: same id, public info kept, source becomes spotter', async () => {
    const before = await pool.query<{ n: number }>(`select count(*)::int as n from places`);
    const result = await submitPlace(pool, {
      name: 'El Merendero de Azafrán', category: 'eat_drink', landmarkDescription: 'Frente a la iglesia de Borburata',
      lat: 10.4716, lon: -68.0056, h3_8: 'x', spotterId: SPOTTER_A, areaId: AREA_ID, candidateId,
    });
    expect(result.ok).toBe(true);
    expect(result.placeId).toBe(candidateId);
    const after = await pool.query<{ n: number }>(`select count(*)::int as n from places`);
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n); // no new row

    const row = await pool.query(`select * from places where id = $1`, [candidateId]);
    const r = row.rows[0];
    expect(r.source).toBe('spotter');
    expect(r.verification_status).toBe('provisional');
    expect(r.witness_count).toBe(1);
    expect(r.created_by_spotter_id).toBe(SPOTTER_A);
    // The reason it was worth promoting: the public info survives.
    expect(r.public_phone).toBe('+584144325599');
    expect(r.public_website).toBe('http://www.azafran.com.ve');
    expect(r.contact_confirmed_at).toBeNull(); // prefill is not the same as a human confirming it
  });

  it('a second attempt on the same candidate fails cleanly: it is no longer a candidate', async () => {
    const result = await submitPlace(pool, {
      name: 'Duplicate attempt', category: 'eat_drink', landmarkDescription: 'x',
      lat: 10.4716, lon: -68.0056, h3_8: 'x', spotterId: SPOTTER_B, areaId: AREA_ID, candidateId,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already claimed|not found/);
  });

  it('with no candidateId, submission still inserts a fresh row as before', async () => {
    const before = await pool.query<{ n: number }>(`select count(*)::int as n from places`);
    const result = await submitPlace(pool, {
      name: 'Kiosko Nuevo', category: 'eat_drink', landmarkDescription: 'Junto al parque',
      lat: 10.472, lon: -68.006, h3_8: 'y', spotterId: SPOTTER_A, areaId: AREA_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.placeId).not.toBe(candidateId);
    const after = await pool.query<{ n: number }>(`select count(*)::int as n from places`);
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n + 1);
  });
});
