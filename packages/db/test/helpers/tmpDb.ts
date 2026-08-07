import pg from 'pg';

const BASE =
  process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca';

/** Connection string for a sibling database on the same server. */
export function urlFor(db: string): string {
  const u = new URL(BASE);
  u.pathname = `/${db}`;
  return u.toString();
}

async function admin(sql: string): Promise<void> {
  const client = new pg.Client({ connectionString: urlFor('postgres') });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Create a throwaway database for one test file, cloned from template_postgis
 * so it mirrors what the postgis image's initdb leaves in POSTGRES_DB.
 *
 * Integration tests must never touch the developer's `guaca` database: it
 * holds seed data, and a test run that destroys it costs more than the test
 * is worth. Give each file its own database and drop it afterwards.
 */
export async function createTempDb(name: string): Promise<pg.Pool> {
  await admin(`drop database if exists ${name}`);
  await admin(`create database ${name} template template_postgis`);
  return new pg.Pool({ connectionString: urlFor(name) });
}

/** End the pool and drop the throwaway database. */
export async function dropTempDb(name: string, pool?: pg.Pool): Promise<void> {
  await pool?.end();
  await admin(`drop database if exists ${name}`);
}
