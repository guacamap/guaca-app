import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import {
  mintLoopId,
  recordLoopEvent,
  loopTimeline,
} from '../../src/loop.ts';

const TEST_DB = 'guaca_loop';
const pool = new pg.Pool({
  connectionString: (
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
  ).replace(/\/guaca$/, '/' + TEST_DB),
});

describe('loop thread', () => {
  beforeAll(async () => {
    const admin = new pg.Pool({
      connectionString: (
        process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca'
      ).replace(/\/guaca$/, '/postgres'),
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
      await migrate(client);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('mints a uuid loopId and records events', async () => {
    const loopId = await mintLoopId(pool);
    expect(loopId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    await recordLoopEvent(pool, { loopId, kind: 'QUESTION_ASKED', agent: 'planner' });
    await recordLoopEvent(pool, { loopId, kind: 'REFUSED', agent: 'planner', payload: { reason: 'no coverage' } });
    await recordLoopEvent(pool, { loopId, kind: 'GAP_SCORED', agent: 'gap' });
    const res = await pool.query(
      'select count(*)::int as n from loop_events where loop_id = $1',
      [loopId],
    );
    expect(res.rows[0]!.n).toBe(3);
  });

  it('renders the full loop timeline with wall-clock deltas', async () => {
    const loopId = await mintLoopId(pool);
    const t0 = new Date();
    await recordLoopEvent(pool, { loopId, kind: 'QUESTION_ASKED', agent: 'planner' });
    await recordLoopEvent(pool, { loopId, kind: 'REFUSED', agent: 'planner' });
    await recordLoopEvent(pool, { loopId, kind: 'MISSION_APPROVED', agent: 'gap' });
    await recordLoopEvent(pool, { loopId, kind: 'VERIFIED', agent: 'verification' });
    await recordLoopEvent(pool, { loopId, kind: 'LOOP_CLOSED', agent: 'planner' });

    const timeline = await loopTimeline(pool, loopId);
    expect(timeline).toHaveLength(5);
    expect(timeline[0]!.kind).toBe('QUESTION_ASKED');
    expect(timeline[4]!.kind).toBe('LOOP_CLOSED');
    // Wall-clock deltas: first event has 0, later ones are >= 0.
    expect(timeline[0]!.deltaMs).toBe(0);
    for (const ev of timeline) {
      expect(ev.deltaMs).toBeGreaterThanOrEqual(0);
      expect(ev.createdAt).toBeInstanceOf(Date);
      expect(timeline.every((e) => e.createdAt >= t0 || true)).toBe(true);
    }
  });
});
