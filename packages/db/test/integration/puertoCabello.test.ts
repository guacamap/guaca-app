import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { migrate } from '../../src/migrate.js';
import { seed } from '../../src/seed/index.js';
import { seedPuertoCabello, PUERTO_CABELLO_PROFILES } from '../../src/seed/puertoCabello.js';
import { findPlannableNear } from '../../src/queries.js';
import { addFavorite, listFavorites } from '../../src/posts.js';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.js';
import { seedDemoAccount, DEMO_TRAVELLER_EMAIL } from '../../src/seed/demoAccount.js';
import { listTrips, tripBySlug } from '../../src/tripsDb.js';
import { submitPlace } from '../../src/submitPlace.js';

const name = `guaca_demo_profiles_test_${process.pid}`;
let pool: Pool;

describe('Puerto Cabello demo preparation', () => {
  beforeAll(async () => {
    pool = await createTempDb(name);
    const client = await pool.connect();
    try { await migrate(client); } finally { client.release(); }
  }, 30000);
  afterAll(async () => { await dropTempDb(name, pool); });

  it('loads the bundled map and the sourced profiles without fictional witnesses', async () => {
    const result = await seedPuertoCabello(pool);
    expect(result.inserted).toBeGreaterThanOrEqual(40);
    expect(result.profiles).toBe(PUERTO_CABELLO_PROFILES.length);
    expect(PUERTO_CABELLO_PROFILES.length).toBeGreaterThanOrEqual(13);
    const people = await pool.query('select count(*)::int n from spotters');
    expect(people.rows[0].n).toBe(0);
    const places = await pool.query('select verification_status, witness_count, verified_at, corroboration from places');
    for (const p of places.rows) {
      expect(p.verification_status).toBe('candidate');
      expect(p.witness_count).toBe(0);
      expect(p.verified_at).toBeNull();
      expect(p.corroboration).toBe(1);
    }
    const catalog = await findPlannableNear(pool, 10.477, -68.01, 6000);
    for (const name of ['Fortín Solano', 'Teatro Municipal de Puerto Cabello', 'Catedral de San José',
      'Iglesia Nuestra Señora del Rosario', 'Monumento a Simón Bolívar', 'Picua Seafood & Bar', 'La Cueva del Mar']) {
      expect(catalog.map((p) => p.name)).toContain(name);
    }
    expect(catalog.find((p) => p.name === 'Casa Rosada')?.public_profile?.demo).toBe(true);
  });

  it('can be repeated without duplicates or inflated corroboration', async () => {
    const before = await pool.query('select count(*)::int n from places');
    const result = await seedPuertoCabello(pool);
    expect(result.inserted).toBe(0);
    expect((await pool.query('select count(*)::int n from places')).rows).toEqual(before.rows);
    expect((await pool.query('select max(corroboration)::int n from places')).rows[0].n).toBe(1);
  });

  it('persists saved public places and hides them if subsequently rejected', async () => {
    const tourist = await pool.query("insert into tourists(email) values ('demo-test@example.com') returning id");
    const place = await pool.query("select id from places where name='Da Franco'");
    const touristId = tourist.rows[0].id;
    const placeId = place.rows[0].id;
    await addFavorite(pool, touristId, placeId);
    expect((await listFavorites(pool, touristId)).map((p) => p.name)).toContain('Da Franco');
    await pool.query("update places set verification_status='rejected' where id=$1", [placeId]);
    expect(await listFavorites(pool, touristId)).toHaveLength(0);
    await pool.query("update places set verification_status='candidate' where id=$1", [placeId]);
  });

  it('creates a real reusable account with saved places and a grounded shareable trip', async () => {
    const first = await seedDemoAccount(pool);
    expect(first.email).toBe(DEMO_TRAVELLER_EMAIL);
    expect(await listFavorites(pool, first.touristId)).toHaveLength(PUERTO_CABELLO_PROFILES.length);
    const trips = await listTrips(pool, first.touristId);
    expect(trips).toHaveLength(1);
    expect(trips[0]!.stops).toHaveLength(4);
    const eligible = await findPlannableNear(pool, 10.477, -68.01, 6000);
    for (const stop of trips[0]!.stops) expect(eligible.map((p) => p.id)).toContain(stop.placeId);
    expect(await tripBySlug(pool, first.shareSlug)).toEqual(trips[0]);
    await pool.query("update tourists set language='en' where id=$1", [first.touristId]);
    expect(await seedDemoAccount(pool)).toEqual(first);
    expect(await listTrips(pool, first.touristId)).toHaveLength(1);
    const row = (await pool.query('select language, login_code_hash, last_login_at from tourists where id=$1', [first.touristId])).rows[0];
    expect(row).toEqual({ language: 'en', login_code_hash: null, last_login_at: null });
    // The demo account seed now also provisions the demo cast (see
    // demoCast.test.ts): every spotter row it creates carries the hidden
    // @demo.guaca.live designation and a clean name.
    const cast = await pool.query(`select name, email from spotters`);
    expect(cast.rows.length).toBeGreaterThan(0);
    for (const s of cast.rows) {
      expect(s.name).not.toMatch(/dev/i);
      expect(s.email).toMatch(/@demo\.guaca\.live$/);
    }
  });

  it('does not overwrite an existing local verification or confirmed details', async () => {
    await seed(pool, { demo: true });
    const people = await pool.query('select id from spotters order by id limit 2');
    await pool.query(`update places set verification_status='verified', witness_count=2,
      created_by_spotter_id=$1, confirmed_by_spotter_id=$2, verified_at=now(),
      public_phone='+58 242 1234567', contact_confirmed_at=now(), public_subcategory='Confirmed by local'
      where osm_id=13588404601`, [people.rows[0].id, people.rows[1].id]);
    const before = await pool.query('select verification_status, witness_count, verified_at, public_profile, public_phone, public_subcategory, contact_confirmed_at from places where osm_id=13588404601');
    await seedPuertoCabello(pool);
    const after = await pool.query('select verification_status, witness_count, verified_at, public_profile, public_phone, public_subcategory, contact_confirmed_at from places where osm_id=13588404601');
    expect(after.rows).toEqual(before.rows);
  });

  it('ships every referenced photograph locally with its original source credit', async () => {
    const profiles = PUERTO_CABELLO_PROFILES.filter((p) => p.image);
    expect(profiles.length).toBeGreaterThanOrEqual(10);
    for (const p of profiles) {
      const file = await readFile(new URL(`../../../../apps/app/public${p.image!.url}`, import.meta.url));
      const isJpeg = file[0] === 0xff && file[1] === 0xd8;
      const isWebp = file.toString('ascii', 0, 4) === 'RIFF' && file.toString('ascii', 8, 12) === 'WEBP';
      expect(isJpeg || isWebp).toBe(true);
      expect(p.image!.credit.length).toBeGreaterThan(5);
      expect(p.image!.sourceUrl).toMatch(/^https:\/\//);
      expect(p.image!.url).toMatch(/^\/demo\/[a-z-]+\/[a-z-]+\.(jpg|webp)$/);
      if ('license' in p.image!) {
        expect(p.image!.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      } else {
        expect(p.image!.rights).toBe('unverified-demo-only');
      }
    }
  });

  it('preserves local submission support and clears the superseded editorial profile', async () => {
    const person = (await pool.query('select id from spotters limit 1')).rows[0];
    const place = (await pool.query("select id, area_id, h3_8 from places where name='Blue Marine Restaurant'")).rows[0];
    const result = await submitPlace(pool, {
      name: 'Blue Marine Restaurant', category: 'eat_drink', landmarkDescription: 'Local submission landmark',
      lat: 10.480, lon: -68.01, h3_8: place.h3_8, spotterId: person.id,
      areaId: place.area_id, candidateId: place.id,
    });
    expect(result.ok).toBe(true);
    expect((await pool.query('select public_profile, verification_status, witness_count from places where id=$1', [place.id])).rows[0])
      .toEqual({ public_profile: null, verification_status: 'provisional', witness_count: 1 });
  });
});
