import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { migrate } from '../../src/migrate.js';
import { seed } from '../../src/seed/index.js';
import { seedPuertoCabello, PUERTO_CABELLO_PROFILES } from '../../src/seed/puertoCabello.js';
import {
  seedDemoAccount, DEMO_TRAVELLER_EMAIL, DEMO_AREA_ID, CASA_ROSADA_OPERATOR_EMAIL,
} from '../../src/seed/demoAccount.js';
import { postsForPlace, listFavorites } from '../../src/posts.js';
import { operatorByEmail } from '../../src/operatorAuth.js';
import { listTrips } from '../../src/tripsDb.js';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.js';

/**
 * The demo cast and demo-authored content, exactly as demo:prepare builds
 * them. The scenario starts from the messiest real state we know: legacy
 * '[DEV]' place names, a 'Carlos Test [DEV]' spotter, and roster emails from
 * the older demo seed domain. One seedDemoAccount run must leave a cast a
 * visitor can read aloud, with the invention hidden in the email domain.
 */
const name = `guaca_demo_cast_test_${process.pid}`;
let pool: Pool;

const dirtyPlaces = async () =>
  pool.query<{ id: string; name: string }>(
    `select id, name from places where area_id = $1 and name ilike '%dev%'`, [DEMO_AREA_ID],
  );

describe('Demo cast provisioning', () => {
  beforeAll(async () => {
    pool = await createTempDb(name);
    const client = await pool.connect();
    try {
      await migrate(client);
    } finally {
      client.release();
    }
    await seedPuertoCabello(pool);
    // Recreate the legacy dirty state this seed has to clean up in place.
    await seed(pool, { demo: true }); // ten roster spotters on @spotters.guaca.dev
    await pool.query(
      `insert into spotters (name, phone, area_id, language)
       values ('Carlos Test [DEV]', '+58 412 999 0001', $1, 'es')`, [DEMO_AREA_ID],
    );
    await pool.query(
      `update places set name = name || ' [DEV]'
        where area_id = $1 and name in ('Plaza Flores', 'Fortín Solano', 'Teatro Municipal de Puerto Cabello')`,
      [DEMO_AREA_ID],
    );
  }, 30000);
  afterAll(async () => { await dropTempDb(name, pool); });

  it('starts from a dirty state, or the cleaning below proves nothing', async () => {
    expect((await dirtyPlaces()).rows.length).toBe(3);
    const carlos = await pool.query(`select id from spotters where name = 'Carlos Test [DEV]'`);
    expect(carlos.rows.length).toBe(1);
    const roster = await pool.query(`select email from spotters`);
    expect(roster.rows.some((r) => (r.email ?? '').endsWith('@spotters.guaca.dev'))).toBe(true);
  });

  it('leaves clean names and a hidden demo designation on every cast row', async () => {
    const placeCount = await pool.query<{ n: number }>('select count(*)::int as n from places');
    const result = await seedDemoAccount(pool);

    // No visible DEV marker anywhere in the demo area, and no row deleted.
    expect((await dirtyPlaces()).rows).toEqual([]);
    expect((await pool.query(
      `select name from spotters where name ilike '%dev%'`,
    )).rows).toEqual([]);
    expect((await pool.query('select count(*)::int as n from places')).rows[0].n)
      .toBe(placeCount.rows[0].n + 8); // the eight cast venues are created where missing

    // Eleven cast members, distinct phones, emails all on the demo domain.
    const cast = await pool.query<{ name: string; email: string; phone: string }>(
      'select name, email, phone from spotters where area_id = $1 order by name', [DEMO_AREA_ID],
    );
    expect(cast.rows.length).toBe(11);
    expect(new Set(cast.rows.map((s) => s.phone)).size).toBe(11);
    for (const s of cast.rows) expect(s.email).toMatch(/@demo\.guaca\.live$/);
    expect(result.castSpotters).toBe(11);

    // The verifier the fixtures cite logs in with the documented email, and
    // the old test row answers to a clean Venezuelan name instead.
    const yorman = cast.rows.find((s) => s.name === 'Yorman Salazar');
    expect(yorman?.email).toBe('yorman@demo.guaca.live');
    expect(cast.rows.map((s) => s.name)).toContain('Rafael Rondón');
    expect(cast.rows.map((s) => s.name)).not.toContain('Carlos Test');
  });

  it('gives every cast venue a photo-backed demo profile with honest captions', async () => {
    const result = await seedDemoAccount(pool);
    expect(result.castProfiles).toBe(8);

    const rows = await pool.query<{ name: string; image: { url: string; license?: string; rights?: string; caption?: unknown } | null }>(
      `select name, public_profile->'image' as image from places
        where area_id = $1 and source = 'spotter' and public_profile is not null`,
      [DEMO_AREA_ID],
    );
    expect(rows.rows.length).toBe(8);
    for (const row of rows.rows) {
      expect(row.image?.url).toMatch(/^\/demo\/puerto-cabello\/[a-z-]+\.(jpg|webp)$/);
      expect(Boolean(row.image?.license) !== Boolean(row.image?.rights)).toBe(true); // exactly one of the two
      // An invented venue never claims its photo is of itself.
      if (row.name !== 'Playa Quizandal') expect(row.image?.caption).toBeTruthy();
    }
    // The real beach keeps the only venue-true photo, without a caption.
    const quizandal = rows.rows.find((r) => r.name === 'Playa Quizandal');
    expect(quizandal?.image?.license).toBe('CC BY-SA 3.0');
    expect(quizandal?.image?.caption).toBeUndefined();

    // Every referenced file exists beside the app's public assets.
    const { readFile } = await import('node:fs/promises');
    for (const row of rows.rows) {
      const file = await readFile(new URL(`../../../../apps/app/public${row.image!.url}`, import.meta.url));
      expect(file.length).toBeGreaterThan(10000);
    }

    // Idempotent, and a genuine local profile would never be overwritten.
    await seedDemoAccount(pool);
    const after = await pool.query(
      `select count(*)::int as n from places
        where area_id = $1 and source = 'spotter' and public_profile->'image'->>'url' = '/demo/puerto-cabello/playa-quizandal.jpg'`,
      [DEMO_AREA_ID],
    );
    expect(after.rows[0].n).toBe(1);
  });

  it('publishes three business posts through the real posts mechanism, never as verified facts', async () => {
    // 'signature' is how the business signs the post body, its own short
    // name, which need not equal the map listing's name.
    const businesses: { osmId: number; name: string; signature: string; account: string }[] = [
      { osmId: 13588404601, name: 'Casa Rosada', signature: 'Casa Rosada', account: CASA_ROSADA_OPERATOR_EMAIL },
      { osmId: 5718270282, name: 'Blue Marine Restaurant', signature: 'Blue Marine', account: 'bluemarine@demo.guaca.live' },
      { osmId: 13588404801, name: 'Da Franco', signature: 'Da Franco', account: 'dafranco@demo.guaca.live' },
    ];
    for (const b of businesses) {
      const place = await pool.query<{ id: string; name: string }>(
        'select id, name from places where area_id = $1 and osm_id = $2', [DEMO_AREA_ID, b.osmId],
      );
      expect(place.rows[0]?.name).toBe(b.name);
      const posts = await postsForPlace(pool, place.rows[0]!.id);
      const business = posts.filter((p) => p.body.startsWith(`Publicado por ${b.signature} (`));
      expect(business.length).toBe(1);
      const post = business[0]!;
      // Real shape, honest tier: an anonymous author, no witness badge, no
      // presence claim, no stars, and the body labels itself business words
      // that no Spotter has checked.
      expect(post.author).toEqual({ kind: 'traveler', name: null, level: 0, photoUrl: null });
      expect(post.visited).toBe(false);
      expect(post.rating).toBeNull();
      expect(post.body).toContain('información del negocio');
      expect(post.body).toContain('Not yet checked by a Spotter');
      const owner = await pool.query<{ email: string }>(
        `select t.email from place_posts pp join tourists t on t.id = pp.tourist_id where pp.id = $1`, [post.id],
      );
      expect(owner.rows[0]!.email).toBe(b.account);
    }
    expect((await pool.query(
      `select count(*)::int as n from place_posts pp
         join places p on p.id = pp.place_id
        where p.area_id = $1 and pp.spotter_id is not null`, [DEMO_AREA_ID],
    )).rows[0].n).toBe(0);
  });

  it('provisions the Casa Rosada operator through the real registration and allowlist flow', async () => {
    const registration = await pool.query<{ role: string; handled_at: Date | null; note: string | null }>(
      `select role, handled_at, operator_note as note from registrations
        where role = 'owner' and lower(contact) = $1`, [CASA_ROSADA_OPERATOR_EMAIL],
    );
    expect(registration.rows.length).toBe(1);
    expect(registration.rows[0].handled_at).not.toBeNull();
    expect(registration.rows[0].note).toBeTruthy();

    const operator = await operatorByEmail(pool, CASA_ROSADA_OPERATOR_EMAIL);
    expect(operator).toMatchObject({ email: CASA_ROSADA_OPERATOR_EMAIL, role: 'operator', active: true });
    expect(operator!.name).toMatch(/Casa Rosada/);
  });

  it('is idempotent: a second run recreates nothing', async () => {
    const snapshot = async () => JSON.stringify([
      (await pool.query(`select id, name, email, phone from spotters where area_id = $1 order by phone`, [DEMO_AREA_ID])).rows,
      (await pool.query(`select p.osm_id, pp.tourist_id, pp.body, pp.status from place_posts pp join places p on p.id = pp.place_id where p.area_id = $1 order by p.osm_id, pp.created_at`, [DEMO_AREA_ID])).rows,
      (await pool.query(`select id from operators where email = $1`, [CASA_ROSADA_OPERATOR_EMAIL])).rows,
      (await pool.query(`select id, handled_at is not null as handled from registrations where lower(contact) = $1`, [CASA_ROSADA_OPERATOR_EMAIL])).rows,
      (await pool.query(`select id from trips`)).rows,
    ]);
    const before = await snapshot();
    const first = await seedDemoAccount(pool);
    const after = await snapshot();
    expect(after).toBe(before);
    const second = await seedDemoAccount(pool);
    expect(second).toEqual(first);
    expect(await snapshot()).toBe(before);
  });

  it('keeps the traveller account with its saved places and trip', async () => {
    const tourist = await pool.query<{ id: string }>(
      'select id from tourists where email = $1', [DEMO_TRAVELLER_EMAIL],
    );
    expect(tourist.rows.length).toBe(1);
    const favorites = await listFavorites(pool, tourist.rows[0]!.id);
    expect(favorites.length).toBe(PUERTO_CABELLO_PROFILES.length);
    expect(favorites.every((f) => !/dev/i.test(f.name))).toBe(true);
    const trips = await listTrips(pool, tourist.rows[0]!.id);
    expect(trips.length).toBe(1);
    expect(trips[0]!.stops.length).toBe(4);
  });
});
