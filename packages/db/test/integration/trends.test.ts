import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import { loadTrendSignals, writeTrends, trendsForPlaces } from '../../src/trends.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_trends';
const AREA = '00000000-0000-4000-8000-00000000000a';
const S1 = '00000000-0000-4000-8000-0000000000c1';
const S2 = '00000000-0000-4000-8000-0000000000c2';

function daysAgo(n: number): string {
  return `now() - interval '${n} days'`;
}

describe('trends — signal aggregation and the place_trends table', () => {
  let pool: pg.Pool;
  let placeId: string;
  let cell: string;

  beforeAll(async () => {
    pool = await createTempDb(DB);
    const c = await pool.connect();
    await migrate(c);
    await c.query(
      `insert into areas(id,name,slug,country,timezone,geom) values ($1,'PC','pc','VE','America/Caracas', ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
      [AREA],
    );
    const h = await c.query(
      `select h3_lat_lng_to_cell(point(-68.0056, 10.4716), 8)::text as c`,
    );
    cell = h.rows[0]!.c;
    await c.query(
      `insert into spotters(id,name,phone,area_id,home_h3) values ($1,'A','+58001',$2,$3), ($4,'B','+58002',$2,$3)`,
      [S1, AREA, cell, S2],
    );
    const place = await c.query(
      `insert into places
        (area_id, name, category, landmark_description, location, h3_8,
         source, verification_status, witness_count, verified_at,
         created_by_spotter_id, confirmed_by_spotter_id)
       values ($1, 'Arepera del Muelle', 'eat_drink', '50m past the church, blue door',
         ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography, $2,
         'spotter', 'verified', 2, now() - interval '10 days', $3, $4)
       returning id`,
      [AREA, cell, S1, S2],
    );
    placeId = place.rows[0]!.id;
    // An unverified place must never receive trend signals.
    await c.query(
      `insert into places
        (area_id, name, category, landmark_description, location, h3_8,
         source, verification_status, witness_count)
       values ($1, 'Candidate', 'eat_drink', 'somewhere', 
         ST_SetSRID(ST_MakePoint(-68.0057, 10.4717), 4326)::geography, $2,
         'osm_candidate', 'candidate', 0)`,
      [AREA, cell],
    );
    // A session + an answered question citing the place (interest).
    const sess = await c.query(
      `insert into sessions default values returning id`,
    );
    await c.query(
      `insert into questions(session_id, area_id, raw_text, language, intent, answered, answer_place_ids, created_at)
       values ($1, $2, 'where to eat arepas', 'en',
               jsonb_build_object('category','eat_drink','h3_8',$3::text),
               true, array[$4::uuid], ${daysAgo(2)})`,
      [sess.rows[0]!.id, AREA, cell, placeId],
    );
    // A re-check doubt in the same cell+category.
    await c.query(
      `insert into questions(session_id, area_id, raw_text, language, intent, answered, refusal_reason, created_at)
       values ($1, $2, '[recheck] Arepera', 'en',
               jsonb_build_object('category','eat_drink','h3_8',$3::text),
               false, 'RECHECK_REQUESTED', ${daysAgo(3)})`,
      [sess.rows[0]!.id, AREA, cell],
    );
    // A visible post with a rating and a social link.
    await c.query(
      `insert into place_posts(place_id, spotter_id, body, rating, media_url, status, created_at)
       values ($1, $2, 'best arepas', 5, 'https://www.tiktok.com/@x/video/1', 'visible', ${daysAgo(1)})`,
      [placeId, S1],
    );
    c.release();
  });
  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('aggregates only verified places, with every signal counted', async () => {
    const rows = await loadTrendSignals(pool, AREA);
    expect(rows).toHaveLength(1);
    const s = rows[0]!;
    expect(s.placeId).toBe(placeId);
    expect(s.category).toBe('eat_drink');
    expect(s.interestCount).toBe(1);
    expect(s.doubtCount).toBe(1);
    expect(s.postCount).toBe(1);
    expect(s.ratingCount).toBe(1);
    expect(s.socialCount).toBe(1);
    expect(s.avgRating).toBeCloseTo(5, 5);
    expect(s.ageDays).toBeGreaterThanOrEqual(10);
    expect(s.ageDays).toBeLessThan(11);
    expect(s.lastEngagementAgeDays).toBeGreaterThanOrEqual(1);
    expect(s.lastInterestAgeDays).toBeGreaterThanOrEqual(2);
    expect(s.favoriteCount).toBe(0); // nobody saved it yet
  });

  it('writes and rewrites trends, pruning rows whose place left the verified set', async () => {
    const n = await writeTrends(pool, [
      {
        placeId,
        score: 250,
        breakdown: { E: 1.2, I: 0.8, F: 0.9, W: 1, badge: 'trending' },
        weatherState: 'calm',
        trendVersion: '1',
      },
    ]);
    expect(n).toBe(1);
    let map = await trendsForPlaces(pool, [placeId]);
    expect(map.get(placeId)?.score).toBe(250);
    expect(map.get(placeId)?.badge).toBe('trending');

    // Next cycle recomputes lower and without the badge — the row is replaced.
    await writeTrends(pool, [
      {
        placeId,
        score: 90,
        breakdown: { E: 0.1, I: 0, F: 0.9, W: 1, badge: null },
        weatherState: null,
        trendVersion: '1',
      },
    ]);
    map = await trendsForPlaces(pool, [placeId]);
    expect(map.get(placeId)?.score).toBe(90);
    expect(map.get(placeId)?.badge).toBeNull();
  });

  it('writeTrends([]) clears the table — a badge can never outlive its evidence', async () => {
    await writeTrends(pool, []);
    const map = await trendsForPlaces(pool, [placeId]);
    expect(map.size).toBe(0);
  });
});
