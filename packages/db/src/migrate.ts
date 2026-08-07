import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';

// The migrations dir lives at packages/db/migrations; this module is
// executed from src/ (via tsx/vitest) or dist/ (compiled), so resolve
// one level up from the file.
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);

/**
 * Apply every migration in migrations/*.sql that has not yet been applied,
 * in filename (lexical) order, each inside its own transaction.
 * Safe to run repeatedly: already-applied migrations are skipped.
 *
 * This function is ADDITIVE ONLY. It never drops a schema, extension or table,
 * never rewrites the SQL it is handed, and never writes to a system catalog —
 * because it runs against production. Resetting a database is the caller's
 * job; see resetPublicSchema, which is for tests.
 */
export async function migrate(client: PoolClient): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const applied = await appliedMigrations(client);
  const ran: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await client.query('begin');
    try {
      // Serialise concurrent migrators. Held until this transaction ends, so
      // a second process waits here rather than racing on the same file.
      await client.query('select pg_advisory_xact_lock(727001)');
      if (await isApplied(client, file)) {
        // Another process applied it while we waited for the lock.
        await client.query('rollback');
        continue;
      }
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [
        file,
      ]);
      await client.query('commit');
      ran.push(file);
    } catch (err) {
      await client.query('rollback');
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return ran;
}

/**
 * DESTRUCTIVE. Drops and recreates the public schema. For test setup only —
 * never call this from application code, a CLI command, or a migration.
 */
export async function resetPublicSchema(client: PoolClient): Promise<void> {
  await client.query('drop schema if exists public cascade');
  await client.query('create schema if not exists public');
  await client.query('set search_path to public');
}

async function isApplied(client: PoolClient, file: string): Promise<boolean> {
  const res = await client.query<{ n: number }>(
    'select count(*)::int as n from schema_migrations where name = $1',
    [file],
  );
  return (res.rows[0]?.n ?? 0) > 0;
}

async function appliedMigrations(client: PoolClient): Promise<Set<string>> {
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const res = await client.query<{ name: string }>(
    'select name from schema_migrations',
  );
  return new Set(res.rows.map((r) => r.name));
}
