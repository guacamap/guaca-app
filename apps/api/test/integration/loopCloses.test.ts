import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { authTourist, captureSender } from '../helpers/touristTestAuth.ts';
import { runGapCycle } from '../../src/scheduler.ts';
import {
  migrate,
  clusterUnanswered,
  rankedGaps,
  commissionMission,
  loadGapSignals,
  listSpotterCandidates,
} from '@guaca/db';
import {
  FakeInference,
  runGapAgent,
  scoreGap,
  selectSpotter,
  composeBrief,
} from '@guaca/agents';

const TEST_DB = 'guaca_loop_closes';
const base =
  process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca';
const url = (db: string) => base.replace(/\/guaca$/, '/' + db);

const pool = new pg.Pool({ connectionString: url(TEST_DB) });
const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const SPOTTER = '00000000-0000-4000-8000-0000000000c1';

/**
 * The whole product, end to end, in one test:
 *
 *   tourist asks about something uncovered
 *     → the AI REFUSES
 *     → the refusal is recorded as demand
 *     → the gap agent aggregates it into a scored coverage hole
 *     → and commissions ONE paid mission to ONE named local
 *
 * This is the demo. Every piece of it was individually tested and green while
 * the chain itself was broken, so this test asserts the *links*, not the parts.
 */
describe('THE CORE LOOP closes end to end', () => {
  let app: ReturnType<typeof buildApp>;
  const capture = captureSender();

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
    const cell = await c.query<{ c: string }>(
      `select h3_lat_lng_to_cell(point(-68.0056, 10.4716), 8)::text as c`,
    );
    await c.query(
      `insert into spotters (id, name, phone, area_id, home_h3, level)
       values ($1,'Yorman','+58 412 000 0001',$2,$3,2)`,
      [SPOTTER, AREA_ID, cell.rows[0]!.c],
    );
    // A paying villa in the zone — this is what weights the gap score.
    await c.query(
      `insert into properties (name, area_id, location, qr_token, plan, subscription_minor)
       values ('Posada del Puerto', $1,
               ST_SetSRID(ST_MakePoint(-68.0056,10.4716),4326)::geography,
               'qr-demo', 'paid', 2000)`,
      [AREA_ID],
    );
    c.release();

    app = buildApp({ pool, inference: new FakeInference(new Map()), minCandidates: 3, emailSender: capture.sender });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    const admin = new pg.Pool({ connectionString: url('postgres') });
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.end();
  });

  it('step 1–3: an uncovered question is REFUSED and recorded as demand', async () => {
    // Three different guests ask about snorkelling. Nothing is verified here.
    for (let i = 0; i < 3; i++) {
      const headers = await authTourist(app, capture.codes, `guest${i}@test.guaca.live`);
      const res = await app.inject({
        method: 'POST',
        url: '/api/ask',
        headers,
        payload: {
          text: 'is there anywhere to snorkel near Isla Larga?',
          language: 'en',
          lat: 10.4716,
          lon: -68.0056,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().kind).toBe('refusal');
    }

    const q = await pool.query<{ n: number }>(
      `select count(*)::int as n from questions
        where answered = false and refusal_reason is not null`,
    );
    // The refusal became a demand signal instead of vanishing.
    expect(q.rows[0]!.n).toBe(3);
  });

  it('step 4: the gap agent aggregates the refusals and commissions ONE mission', async () => {
    const result = await runGapCycle({
      cluster: () => clusterUnanswered(pool, AREA_ID),
      runAgent: () =>
        runGapAgent({
          areaId: AREA_ID,
          dryRun: false,
          minScore: 45,
          maxRewardMinor: 500,
          dailyCap: 5,
          listGaps: async (areaId) =>
            (await rankedGaps(pool, areaId)).map((g) => ({
              id: g.id,
              category: g.category,
              h3_8: g.h3_8,
              questionCount: g.questionCount,
              distinctSessionCount: g.distinctSessionCount,
            })),
          countMissionsToday: async () => 0,
          loadSignals: (gap) =>
            loadGapSignals(pool, {
              id: gap.id,
              category: gap.category,
              h3_8: gap.h3_8,
            }),
          listSpotters: (zoneId) => listSpotterCandidates(pool, zoneId),
          score: scoreGap,
          selectSpotter: async (cands, zoneId) => selectSpotter(cands, zoneId),
          composeBrief,
          commission: (args) =>
            commissionMission(pool, { ...args, currency: 'USD', expiresInHours: 48 }),
        }),
    });

    expect(result.questionsClustered).toBeGreaterThan(0);
    expect(result.commissioned).toHaveLength(1);

    const m = await pool.query<{
      n: number;
      spotter_id: string;
      created_by: string;
    }>(
      `select count(*)::int as n, min(spotter_id::text) as spotter_id, min(created_by) as created_by
         from missions where status in ('offered','accepted','submitted')`,
    );
    // ONE mission, ONE named spotter, created autonomously by the agent.
    expect(m.rows[0]!.n).toBe(1);
    expect(m.rows[0]!.spotter_id).toBe(SPOTTER);
    expect(m.rows[0]!.created_by).toBe('agent');
  });

  it('a second cycle does not double-commission for the same gap', async () => {
    const result = await runGapCycle({
      cluster: () => clusterUnanswered(pool, AREA_ID),
      runAgent: () =>
        runGapAgent({
          areaId: AREA_ID,
          dryRun: false,
          minScore: 45,
          maxRewardMinor: 500,
          dailyCap: 5,
          listGaps: async (areaId) =>
            (await rankedGaps(pool, areaId)).map((g) => ({
              id: g.id,
              category: g.category,
              h3_8: g.h3_8,
              questionCount: g.questionCount,
              distinctSessionCount: g.distinctSessionCount,
            })),
          countMissionsToday: async () => 1,
          loadSignals: (gap) =>
            loadGapSignals(pool, {
              id: gap.id,
              category: gap.category,
              h3_8: gap.h3_8,
            }),
          listSpotters: (zoneId) => listSpotterCandidates(pool, zoneId),
          score: scoreGap,
          selectSpotter: async (cands, zoneId) => selectSpotter(cands, zoneId),
          composeBrief,
          commission: (args) =>
            commissionMission(pool, { ...args, currency: 'USD', expiresInHours: 48 }),
        }),
    });
    void result;

    const m = await pool.query<{ n: number }>(
      `select count(*)::int as n from missions
        where status in ('offered','accepted','submitted')`,
    );
    // "One mission, one Spotter, one guaranteed payment" survives a re-run.
    expect(m.rows[0]!.n).toBe(1);
  });
});
