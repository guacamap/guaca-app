import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../../src/migrate.js';
import { importFoursquare, categoryForFoursquare } from '../../src/seed/foursquareImport.js';
import { importOverture } from '../../src/seed/overtureImport.js';

const TEST_DB = 'guaca_fsq_import';
const base = process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca';
const url = (db: string) => base.replace(/\/guaca$/, '/' + db);
const pool = new pg.Pool({ connectionString: url(TEST_DB) });
const AREA_ID = '00000000-0000-4000-8000-00000000000a';

describe('Foursquare rows corroborate places other datasets already know', () => {
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
    c.release();
    // Overture knows one place; it is listed once.
    await importOverture(pool, AREA_ID, [
      { properties: { id: 'ovt-1', names: { primary: 'Arepera El Malecón' }, categories: { primary: 'restaurant' } }, geometry: { type: 'Point', coordinates: [-68.0056, 10.4716] } },
    ], { apply: true });
  });

  afterAll(async () => {
    await pool.end();
    const admin = new pg.Pool({ connectionString: url('postgres') });
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.end();
  });

  it('maps a Foursquare label path to our taxonomy and keeps the leaf as the subcategory', () => {
    expect(categoryForFoursquare(['Dining and Drinking > Restaurant > Seafood Restaurant'])).toEqual({ category: 'eat_drink', subcategory: 'Seafood Restaurant' });
    expect(categoryForFoursquare(['Landmarks and Outdoors > Beach'])).toEqual({ category: 'beach_water', subcategory: 'Beach' });
  });

  it('a matching row becomes a second source: corroboration goes to 2, nothing is duplicated', async () => {
    const r = await importFoursquare(pool, AREA_ID, [
      { fsq_place_id: 'fsq-1', name: 'Arepera el Malecon', latitude: 10.4717, longitude: -68.0057, tel: '+58 412 111', fsq_category_labels: ['Dining and Drinking > Restaurant > Venezuelan Restaurant'] },
      { fsq_place_id: 'fsq-2', name: 'Playa Blanca', latitude: 10.48, longitude: -68.0, fsq_category_labels: ['Landmarks and Outdoors > Beach'] },
    ], { apply: true });
    expect(r).toMatchObject({ linked: 1, inserted: 1 });
    const rows = await pool.query<{ name: string; corroboration: number; source: string; public_phone: string | null }>(
      `select name, corroboration, source, public_phone from places order by name`,
    );
    expect(rows.rows).toEqual([
      { name: 'Arepera El Malecón', corroboration: 2, source: 'overture_candidate', public_phone: '+58 412 111' },
      { name: 'Playa Blanca', corroboration: 1, source: 'foursquare_candidate', public_phone: null },
    ]);
  });

  it('a re-run changes nothing', async () => {
    const r = await importFoursquare(pool, AREA_ID, [
      { fsq_place_id: 'fsq-2', name: 'Playa Blanca', latitude: 10.48, longitude: -68.0, fsq_category_labels: ['Landmarks and Outdoors > Beach'] },
    ], { apply: true });
    expect(r.inserted + r.linked).toBe(1);
    const n = await pool.query<{ n: string }>(`select count(*)::text as n from places`);
    expect(n.rows[0]!.n).toBe('2');
    const c = await pool.query<{ corroboration: number }>(`select corroboration from places where name = 'Playa Blanca'`);
    expect(c.rows[0]!.corroboration).toBe(1);
  });
});
