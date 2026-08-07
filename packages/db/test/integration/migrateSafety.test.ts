import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const TMP_DB = 'guaca_migrate_safety';

/**
 * These tests run against a throwaway database created from template_postgis,
 * which mirrors what the postgis image's initdb leaves in POSTGRES_DB:
 * postgis in public, postgis_topology in topology, tiger geocoder in tiger.
 * A fresh database also means schema_migrations is empty, which is the exact
 * condition under which a destructive migrator does its damage.
 */
describe('migrate safety', () => {
  let tmpPool: pg.Pool;

  beforeAll(async () => {
    tmpPool = await createTempDb(TMP_DB);
  });

  afterAll(async () => {
    await dropTempDb(TMP_DB, tmpPool);
  });

  it('preserves pre-existing tables and rows in the target database', async () => {
    const client = await tmpPool.connect();
    try {
      await client.query('create table precious (id int primary key, note text)');
      await client.query("insert into precious values (1, 'DO NOT LOSE')");

      await migrate(client);

      const survived = await client.query<{ n: number }>(
        `select count(*)::int as n from information_schema.tables
          where table_schema = 'public' and table_name = 'precious'`,
      );
      expect(survived.rows[0]!.n).toBe(1);

      const row = await client.query<{ note: string }>(
        'select note from precious where id = 1',
      );
      expect(row.rows[0]?.note).toBe('DO NOT LOSE');
    } finally {
      client.release();
    }
  });

  it('leaves the postgis extensions the image pre-created intact', async () => {
    const client = await tmpPool.connect();
    try {
      await migrate(client);

      const res = await client.query<{ extname: string }>(
        `select extname from pg_extension
          where extname in ('postgis', 'postgis_topology', 'postgis_tiger_geocoder')
          order by extname`,
      );
      expect(res.rows.map((r) => r.extname)).toEqual([
        'postgis',
        'postgis_tiger_geocoder',
        'postgis_topology',
      ]);
    } finally {
      client.release();
    }
  });

  it('applies the full schema to a database it did not create', async () => {
    const client = await tmpPool.connect();
    try {
      await migrate(client);

      const res = await client.query<{ n: number }>(
        `select count(*)::int as n from information_schema.tables
          where table_schema = 'public'
            and table_name in ('places', 'missions', 'gaps', 'spotters', 'zones')`,
      );
      expect(res.rows[0]!.n).toBe(5);
    } finally {
      client.release();
    }
  });
});
