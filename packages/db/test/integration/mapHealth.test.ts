import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { migrate } from '../../src/migrate.js';
import { loadMapHealthStats } from '../../src/mapHealth.js';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.js';

const DB_NAME = 'guaca_test_maphealth';
const AREA_ID = '00000000-0000-4000-8000-00000000000a';
let pool: Pool;

beforeAll(async () => {
  pool = await createTempDb(DB_NAME);
  const client = await pool.connect();
  try {
    await migrate(client);
    await client.query(
      `insert into areas (id, name, slug, country, timezone, geom) values
        ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
         ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
      [AREA_ID],
    );
    await client.query(
      `insert into zones (id, area_id, name, geom) values
        ('centro', $1, 'Centro',
         ST_GeogFromText('POLYGON((-68.01 10.46,-68.00 10.46,-68.00 10.48,-68.01 10.48,-68.01 10.46))')),
        ('rancho-chico', $1, 'Rancho Chico',
         ST_GeogFromText('POLYGON((-67.99 10.44,-67.98 10.44,-67.98 10.45,-67.99 10.45,-67.99 10.44))'))`,
      [AREA_ID],
    );
    await client.query(
      `insert into spotters (id, name, phone, area_id) values
        ('00000000-0000-4000-8000-0000000000c1', 'Yorman', '+58 412 000 0001', $1),
        ('00000000-0000-4000-8000-0000000000c2', 'María', '+58 412 000 0002', $1)`,
      [AREA_ID],
    );
    // One verified place inside 'centro': stale (old verified_at) AND a thin
    // landmark description. A candidate row must never count.
    await client.query(
      `insert into places (area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id, verified_at) values
        ($1, 'Arepera Vieja', 'eat_drink', 'centro',
         ST_SetSRID(ST_MakePoint(-68.005, 10.47), 4326)::geography, '8a0', 'spotter', 'verified', 2,
         '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2', now() - interval '90 days'),
        ($1, 'Candidata OSM', 'eat_drink', 'punto OSM sin verificar aún',
         ST_SetSRID(ST_MakePoint(-68.004, 10.471), 4326)::geography, '8a0', 'osm_candidate', 'candidate', 0, null, null, null)`,
      [AREA_ID],
    );
    const session = await client.query(
      `insert into sessions (language) values ('es') returning id`,
    );
    await client.query(
      `insert into questions (session_id, area_id, raw_text, language, intent, answered, refusal_reason) values
        ($2, $1, '¿dónde puedo nadar?', 'es', '{"category":"beach_water"}', false, 'NO_COVERAGE'),
        ($2, $1, '¿otra playa?', 'es', '{"category":"beach_water"}', false, 'NO_COVERAGE')`,
      [AREA_ID, session.rows[0]!.id],
    );
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await dropTempDb(DB_NAME, pool);
});

describe('map-health aggregates (read-only, zero inference)', () => {
  it('reports coverage, demand, staleness, weak landmarks and zone gaps', async () => {
    const stats = await loadMapHealthStats(pool, AREA_ID, 60);

    const eat = stats.categories.find((c) => c.category === 'eat_drink');
    expect(eat).toMatchObject({ verified: 1, refusedAsks: 0 });
    const beach = stats.categories.find((c) => c.category === 'beach_water');
    expect(beach).toMatchObject({ verified: 0, refusedAsks: 2 });

    expect(stats.stalePlaces.map((p) => p.name)).toContain('Arepera Vieja');
    expect(stats.weakLandmarks.map((p) => p.name)).toContain('Arepera Vieja');
    // candidates never appear anywhere in the health report
    const everywhere = JSON.stringify(stats);
    expect(everywhere).not.toContain('Candidata OSM');

    const centro = stats.zones.find((z) => z.zoneId === 'centro');
    const rancho = stats.zones.find((z) => z.zoneId === 'rancho-chico');
    expect(centro?.verified).toBe(1);
    expect(rancho?.verified).toBe(0);
  });
});
