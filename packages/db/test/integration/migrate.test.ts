import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_migrate_test';

/**
 * Runs entirely inside its own throwaway database. It must never drop or
 * modify `guaca` — that is the developer's database and holds seed data.
 */
describe('migrate', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = await createTempDb(DB);
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('is idempotent: applying twice runs each migration exactly once', async () => {
    const client = await pool.connect();
    try {
      const first = await migrate(client);
      expect(first.length).toBeGreaterThan(0);

      const second = await migrate(client);
      expect(second).toEqual([]);

      const res = await client.query<{ n: number }>(
        'select count(*)::int as n from schema_migrations',
      );
      expect(res.rows[0]!.n).toBe(first.length);
    } finally {
      client.release();
    }
  });
});
