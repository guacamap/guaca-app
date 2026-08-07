import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import { recordQuestion } from '../../src/questions.ts';
import { clusterUnanswered } from '../../src/gap/cluster.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_record_question';
const AREA = '00000000-0000-4000-8000-00000000000a';
// Inside the Puerto Cabello polygon below.
const LAT = 10.4716;
const LON = -68.0056;

describe('recordQuestion — the refusal → gap link', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = await createTempDb(DB);
    const c = await pool.connect();
    await migrate(c);
    await c.query(
      `insert into areas(id,name,slug,country,timezone,geom) values
        ($1,'Puerto Cabello','puerto-cabello','VE','America/Caracas',
         ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
      [AREA],
    );
    c.release();
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('writes an unanswered question with a category and an h3 cell', async () => {
    const rec = await recordQuestion(pool, {
      rawText: 'is there anywhere to snorkel at Isla Larga?',
      language: 'en',
      category: 'beach_water',
      lat: LAT,
      lon: LON,
      answered: false,
      refusalReason: 'INSUFFICIENT_COVERAGE',
    });

    expect(rec.areaId).toBe(AREA);
    expect(rec.h3_8).toMatch(/^8/); // an h3 res-8 cell index

    const row = await pool.query<{
      answered: boolean;
      category: string;
      h3_8: string;
      refusal_reason: string;
    }>(
      `select answered, intent->>'category' as category, intent->>'h3_8' as h3_8, refusal_reason
         from questions where id = $1`,
      [rec.questionId],
    );
    expect(row.rows[0]!.answered).toBe(false);
    expect(row.rows[0]!.category).toBe('beach_water');
    expect(row.rows[0]!.h3_8).toBe(rec.h3_8);
    expect(row.rows[0]!.refusal_reason).toBe('INSUFFICIENT_COVERAGE');
  });

  it('creates an anonymous session when none is supplied', async () => {
    const rec = await recordQuestion(pool, {
      rawText: 'donde comer arepas?',
      language: 'es',
      category: 'eat_drink',
      lat: LAT,
      lon: LON,
      answered: true,
      answerPlaceIds: [],
    });
    const s = await pool.query('select id from sessions where id = $1', [rec.sessionId]);
    expect(s.rowCount).toBe(1);
  });

  it('an answered question is NOT clustered into a gap', async () => {
    const before = await pool.query('select count(*)::int as n from gaps');
    await recordQuestion(pool, {
      rawText: 'coffee near the fort',
      language: 'en',
      category: 'culture_history',
      lat: LAT,
      lon: LON,
      answered: true,
      answerPlaceIds: [],
    });
    await clusterUnanswered(pool, AREA);
    const after = await pool.query<{ n: number }>(
      `select count(*)::int as n from gaps where category = 'culture_history'`,
    );
    expect(after.rows[0]!.n).toBe(0);
    expect(before.rowCount).toBe(1);
  });

  it('CLOSES THE LOOP: a refusal becomes a scored, clusterable gap', async () => {
    // Three distinct sessions ask about the same uncovered thing.
    for (let i = 0; i < 3; i++) {
      await recordQuestion(pool, {
        rawText: 'snorkelling?',
        language: 'en',
        category: 'beach_water',
        lat: LAT,
        lon: LON,
        answered: false,
        refusalReason: 'INSUFFICIENT_COVERAGE',
      });
    }

    const result = await clusterUnanswered(pool, AREA);
    expect(result.questionsClustered).toBeGreaterThan(0);

    const gap = await pool.query<{
      category: string;
      question_count: number;
      distinct_session_count: number;
    }>(
      `select category, question_count, distinct_session_count
         from gaps where area_id = $1 and category = 'beach_water'`,
      [AREA],
    );
    expect(gap.rowCount).toBe(1);
    // The first test's refusal plus these three.
    expect(gap.rows[0]!.question_count).toBeGreaterThanOrEqual(3);
    expect(gap.rows[0]!.distinct_session_count).toBeGreaterThanOrEqual(3);
  });
});
