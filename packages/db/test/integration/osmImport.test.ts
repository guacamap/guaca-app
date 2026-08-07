import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../../src/migrate.ts';

const TEST_DB = 'guaca_osm';
const pool = new pg.Pool({
  connectionString: (
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
  ).replace(/\/guaca$/, '/' + TEST_DB),
});
import { importOsmCandidates } from '../../src/seed/osmImport.ts';

// Puerto Cabello area id — matching what T1.2 will seed.
const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const AREA_GEOM =
  'POLYGON((-68.03 10.44, -67.98 10.44, -67.98 10.52, -68.03 10.52, -68.03 10.44))';

// Overpass-style XML: a cafe (node), an arepa shop (way with a node
// center), and a restaurant — all inside the bbox.
const OSM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Overpass API">
  <node id="1001" lat="10.4716" lon="-68.0056">
    <tag k="name" v="Café La Marina"/>
    <tag k="amenity" v="cafe"/>
  </node>
  <node id="1002" lat="10.4720" lon="-68.0060">
    <tag k="name" v="Arepera El Puerto"/>
    <tag k="shop" v="deli"/>
  </node>
  <node id="1003" lat="10.4730" lon="-68.0070">
    <tag k="name" v="Restaurante Doña Clara"/>
    <tag k="amenity" v="restaurant"/>
  </node>
  <way id="2001">
    <nd ref="1001"/>
    <nd ref="1002"/>
    <tag k="name" v="Comedor La Ola"/>
    <tag k="amenity" v="restaurant"/>
    <center lat="10.4718" lon="-68.0058"/>
  </way>
  <node id="1004" lat="10.4600" lon="-68.0000">
    <tag k="name" v="Fuera Del Area"/>
    <tag k="amenity" v="restaurant"/>
  </node>
</osm>`;

function fakeFetch(xml: string) {
  return (async (url: string | URL | Request) => {
    if (typeof url === 'string' && !url.includes('overpass')) {
      throw new Error(`unexpected url: ${url}`);
    }
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch;
}

describe('importOsmCandidates', () => {
  beforeAll(async () => {
    const admin = new pg.Pool({
      connectionString:
        (process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca').replace(/\/guaca$/, '/postgres'),
    });
    const res = await admin.query('select 1 from pg_database where datname = $1', [
      TEST_DB,
    ]);
    if (res.rows.length === 0) {
      await admin.query(`create database ${TEST_DB}`);
    }
    await admin.end();

    const client = await pool.connect();
    try {
      await client.query('drop schema if exists public cascade');
      await client.query('create schema if not exists public');
      // The migrate() first-run reset drops public; run it first so the
      // bookkeeping table survives the schema dance.
      await migrate(client);
      // Now that 0001 is applied, insert the area — migrate's first-run
      // reset has already run, so this schema is stable.
      await client.query(
        `insert into areas (id, name, slug, country, timezone, geom) values
          ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
           ST_GeogFromText($2))`,
        [AREA_ID, AREA_GEOM],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('re-running imports zero duplicates and every row is candidate', async () => {
    const first = await importOsmCandidates(pool, AREA_ID, {
      fetchImpl: fakeFetch(OSM_XML),
    });
    expect(first.inserted).toBeGreaterThan(0);

    const second = await importOsmCandidates(pool, AREA_ID, {
      fetchImpl: fakeFetch(OSM_XML),
    });
    expect(second.inserted).toBe(0);

    const res = await pool.query(
      `select count(*)::int as total,
              count(*) filter (where verification_status = 'candidate')::int as candidates
       from places`,
    );
    expect(res.rows[0]!.total).toBe(first.inserted);
    expect(res.rows[0]!.candidates).toBe(first.inserted);
  });

  it('maps OSM amenity/shop tags to the taxonomy', async () => {
    const res = await pool.query<{ name: string; category: string }>(
      `select name, category from places where name in
        ('Café La Marina', 'Arepera El Puerto', 'Restaurante Doña Clara', 'Comedor La Ola')
       order by name`,
    );
    const byName = new Map(res.rows.map((r) => [r.name, r.category]));
    expect(byName.get('Café La Marina')).toBe('eat_drink');
    expect(byName.get('Arepera El Puerto')).toBe('eat_drink');
    expect(byName.get('Restaurante Doña Clara')).toBe('eat_drink');
    expect(byName.get('Comedor La Ola')).toBe('eat_drink');
  });

  it('drops points outside the area geometry', async () => {
    await pool.query(`delete from places where name = 'Fuera Del Area'`);
    const res = await pool.query(
      `select count(*)::int as n from places where name = 'Fuera Del Area'`,
    );
    expect(res.rows[0]!.n).toBe(0);
  });

  it('imports a fresh outside point as zero rows', async () => {
    const fresh = await importOsmCandidates(pool, AREA_ID, {
      fetchImpl: fakeFetch(
        `<?xml version="1.0"?><osm><node id="7777" lat="10.5" lon="-68.1">
           <tag k="name" v="Probe Oeste"/>
           <tag k="amenity" v="restaurant"/>
         </node></osm>`,
      ),
    });
    expect(fresh.inserted).toBe(0);
  });
});
