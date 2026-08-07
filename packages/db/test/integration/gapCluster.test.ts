import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { clusterUnanswered, type ClusterResult } from '../../src/gap/cluster.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_gap_cluster';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';

async function insertQuestion(sessionId: string, rawText: string, category: string, lat: number, lon: number) {
  await pool.query(
    `insert into questions (session_id, area_id, raw_text, language, intent, answered, created_at)
     values ($1, $2, $3, 'en', jsonb_build_object('category', $4::text, 'h3_8', h3_lat_lng_to_cell(point($6, $5), 8)::text), false, now())`,
    [sessionId, AREA_ID, rawText, category, lat, lon],
  );
}

describe('clusterUnanswered (T5.1)', () => {
  beforeAll(async () => {
    pool = await createTempDb(DB);
    const client = await pool.connect();
    try {
      await client.query('drop schema if exists public cascade');
      await client.query('create schema if not exists public');
      await migrate(client);
      await client.query(
        `insert into areas (id, name, slug, country, timezone, geom) values
          ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
           ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
        [AREA_ID],
      );
      await client.query(
        `insert into sessions (id, language) values
          ('00000000-0000-4000-8000-0000000000e1', 'en'),
          ('00000000-0000-4000-8000-0000000000e2', 'en')`,
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('two questions in the same cell and category merge into one gap with question_count = 2', async () => {
    // Same H3 cell (~10.4716, -68.0056), same category, two sessions.
    await insertQuestion('00000000-0000-4000-8000-0000000000e1', 'where can I eat arepas?', 'eat_drink', 10.4716, -68.0056);
    await insertQuestion('00000000-0000-4000-8000-0000000000e2', 'comida cerca del fuerte?', 'eat_drink', 10.4717, -68.0055);

    const result: ClusterResult = await clusterUnanswered(pool, AREA_ID);
    expect(result.gapsCreated).toBeGreaterThanOrEqual(1);

    const gap = await pool.query<{
      question_count: number;
      distinct_session_count: number;
    }>(
      `select question_count, distinct_session_count from gaps
       where area_id = $1 and category = 'eat_drink'`,
      [AREA_ID],
    );
    expect(gap.rows.length).toBe(1);
    expect(gap.rows[0]!.question_count).toBe(2);
    expect(gap.rows[0]!.distinct_session_count).toBe(2);
  });

  it('different categories create separate gaps', async () => {
    await insertQuestion('00000000-0000-4000-8000-0000000000e1', 'beach near town?', 'beach_water', 10.4716, -68.0056);
    const result = await clusterUnanswered(pool, AREA_ID);
    expect(result.gapsCreated).toBeGreaterThanOrEqual(1);
    const rows = await pool.query<{ category: string }>(
      `select category from gaps where area_id = $1 order by category`,
      [AREA_ID],
    );
    const cats = rows.rows.map((r) => r.category);
    expect(cats).toContain('eat_drink');
    expect(cats).toContain('beach_water');
  });

  it('is idempotent — re-running clusters nothing new', async () => {
    await pool.query(`update questions set answered = true`);
    const result = await clusterUnanswered(pool, AREA_ID);
    expect(result.gapsCreated).toBe(0);
  });
});
