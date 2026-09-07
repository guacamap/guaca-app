import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { migrate } from '../../src/migrate.js';
import { seedCartagena, CARTAGENA_PROFILES } from '../../src/seed/cartagena.js';
import { seedPuertoCabello } from '../../src/seed/puertoCabello.js';
import { seedDemoAccount, DEMO_TRAVELLER_EMAIL } from '../../src/seed/demoAccount.js';
import { listFavorites } from '../../src/posts.js';
import { listTrips } from '../../src/tripsDb.js';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.js';

const name = `guaca_cartagena_test_${process.pid}`;
let pool: Pool;

describe('Cartagena population', () => {
  beforeAll(async () => {
    pool = await createTempDb(name);
    const client = await pool.connect();
    try { await migrate(client); } finally { client.release(); }
  }, 30000);
  afterAll(async () => { await dropTempDb(name, pool); });

  it('fixes the area frame: Bogotá time and a boundary that holds the curated set', async () => {
    const result = await seedCartagena(pool);
    // The checked-in snapshot is a real Overpass answer over the researched
    // frame, not a token handful: a shrunken snapshot should fail loudly here.
    expect(result.inserted).toBeGreaterThanOrEqual(35);
    const area = await pool.query<{ timezone: string; country: string }>(
      `select timezone, country from areas where slug = 'cartagena'`,
    );
    expect(area.rows[0]!.timezone).toBe('America/Bogota');
    expect(area.rows[0]!.country).toBe('CO');
    // Every curated record sits inside the area (the importer drops points
    // outside it, so a curated escapee would lose its profile update).
    const strays = await pool.query(
      `select p.name from places p join areas a on a.id = p.area_id
        where a.slug = 'cartagena' and p.osm_id = any($1::bigint[])
          and not ST_Covers(a.geom, p.location)`,
      [CARTAGENA_PROFILES.map((p) => p.osmId)],
    );
    expect(strays.rows).toEqual([]);
  });

  it('imports the backdrop and attaches sourced profiles without fictional witnesses', async () => {
    const result = await seedCartagena(pool);
    expect(result.inserted).toBe(0); // idempotent re-run above
    expect(result.curated).toBe(0);
    expect(result.profiles).toBe(CARTAGENA_PROFILES.length);
    expect(CARTAGENA_PROFILES.length).toBeGreaterThanOrEqual(12);
    const people = await pool.query('select count(*)::int n from spotters');
    expect(people.rows[0].n).toBe(0);
    const rows = await pool.query<{ name: string; category: string; verification_status: string; witness_count: number; verified_at: string | null; corroboration: number }>(
      `select name, category, verification_status, witness_count, verified_at, corroboration
         from places where area_id = (select id from areas where slug = 'cartagena')
           and osm_id = any($1::bigint[])`,
      [CARTAGENA_PROFILES.map((p) => p.osmId)],
    );
    expect(rows.rows).toHaveLength(CARTAGENA_PROFILES.length);
    for (const place of rows.rows) {
      expect(place.verification_status).toBe('candidate');
      expect(place.witness_count).toBe(0);
      expect(place.verified_at).toBeNull();
      expect(place.corroboration).toBe(1);
    }
    const byName = new Map(rows.rows.map((r) => [r.name, r.category]));
    expect(byName.get('Las Bovedas')).toBe('market_shop');
    expect(byName.get('Las Murallas de Cartagena')).toBe('culture_history');
    expect(byName.get('Bocagrande')).toBe('beach_water');
    expect(byName.get('Bazurto Social Club')).toBe('nightlife_music');
    // Beach text is approximate public transport knowledge, never a timetable.
    const beaches = await pool.query<{ name: string; getting_there: unknown }>(
      `select name, public_profile->'gettingThere' as getting_there
         from places where area_id = (select id from areas where slug = 'cartagena')
           and category = 'beach_water' and osm_id = any($1::bigint[])`,
      [CARTAGENA_PROFILES.map((p) => p.osmId)],
    );
    expect(beaches.rows.length).toBeGreaterThanOrEqual(2);
    for (const beach of beaches.rows) {
      expect(beach.getting_there).toBeTruthy();
      expect(beach.getting_there).toHaveProperty('en');
      expect(beach.getting_there).toHaveProperty('es');
    }
  });

  it('can be repeated without duplicates or inflated corroboration', async () => {
    const before = await pool.query<{ n: number }>('select count(*)::int n from places');
    const result = await seedCartagena(pool);
    expect(result.inserted).toBe(0);
    expect(result.curated).toBe(0);
    expect(result.profiles).toBe(CARTAGENA_PROFILES.length); // rewritten in place, not duplicated
    const after = await pool.query<{ n: number }>('select count(*)::int n from places');
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const max = await pool.query<{ n: number }>(
      'select max(corroboration)::int n from places where area_id = (select id from areas where slug = $1)', ['cartagena'],
    );
    expect(max.rows[0].n).toBe(1);
    // No imported listing carries a local witness: only a Spotter creates one.
    const witnesses = await pool.query<{ n: number }>(
      'select count(*)::int n from places where area_id = (select id from areas where slug = $1) and witness_count > 0', ['cartagena'],
    );
    expect(witnesses.rows[0].n).toBe(0);
  });

  it('ships every referenced photograph locally with its source credit', async () => {
    const profiles = CARTAGENA_PROFILES.filter((p) => p.image);
    expect(profiles.length).toBeGreaterThanOrEqual(12);
    for (const p of profiles) {
      const file = await readFile(new URL(`../../../../apps/app/public${p.image!.url}`, import.meta.url));
      const isJpeg = file[0] === 0xff && file[1] === 0xd8;
      expect(isJpeg).toBe(true);
      expect(p.image!.credit.length).toBeGreaterThan(5);
      expect(p.image!.sourceUrl).toMatch(/^https:\/\//);
      expect(p.image!.url).toMatch(/^\/demo\/cartagena\/[a-z-]+\.jpg$/);
      if ('license' in p.image!) {
        expect(p.image!.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      } else {
        expect(p.image!.rights).toBe('unverified-demo-only');
      }
    }
  });

  it('coexists with Puerto Cabello and adds to the same demo account without touching it', async () => {
    await seedPuertoCabello(pool);
    const first = await seedDemoAccount(pool);
    expect(first.email).toBe(DEMO_TRAVELLER_EMAIL);
    expect(first.cartagenaSavedPlaces).toBe(7);
    expect(first.cartagenaTrips).toBe(2);
    // Re-running the Cartagena population changes nothing in Puerto Cabello:
    // same records, same photos, same account data.
    const pcBefore = await pool.query(
      `select id, name, public_profile::text as profile from places
        where area_id = '00000000-0000-4000-8000-00000000000a' order by id`,
    );
    await seedCartagena(pool);
    const pcAfter = await pool.query(
      `select id, name, public_profile::text as profile from places
        where area_id = '00000000-0000-4000-8000-00000000000a' order by id`,
    );
    expect(pcAfter.rows).toEqual(pcBefore.rows);
    // Account-wide: pilot favorites + Cartagena favorites on one traveller.
    const favorites = await listFavorites(pool, first.touristId);
    expect(favorites.length).toBeGreaterThan(7);
    // Three trips total: the pilot starter + two Cartagena itineraries.
    const trips = await listTrips(pool, first.touristId);
    expect(trips).toHaveLength(3);
    const twoDay = trips.find((t) => t.stops.some((s) => s.dayIndex === 1));
    expect(twoDay?.stops.filter((s) => s.dayIndex === 1).length).toBe(5);
    // No stop slips past midnight: every stop ends the day it starts.
    for (const t of trips) {
      for (const s of t.stops) {
        expect(s.startMin + s.durationMin).toBeLessThanOrEqual(24 * 60);
      }
    }
    // Re-running the account seed is a no-op for the Cartagena fixtures.
    const again = await seedDemoAccount(pool);
    expect(again.cartagenaSavedPlaces).toBe(first.cartagenaSavedPlaces);
    expect(again.cartagenaTrips).toBe(first.cartagenaTrips);
    expect(await listTrips(pool, first.touristId)).toHaveLength(3);
  });

  it('does not turn Colombia live: coverage stays a public-listing count', async () => {
    const colombia = await pool.query<{ verified: number; candidates: number }>(
      `select
         (select count(*)::int from places p join areas a on a.id = p.area_id
            where a.country = 'CO' and p.verification_status = 'verified' and p.witness_count >= 2) as verified,
         (select count(*)::int from places p join areas a on a.id = p.area_id
            where a.country = 'CO') as candidates`,
    );
    expect(colombia.rows[0].verified).toBe(0);
    expect(colombia.rows[0].candidates).toBeGreaterThan(0);
  });
});
