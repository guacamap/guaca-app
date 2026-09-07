import pg from 'pg';
import { migrate } from './migrate.js';
import { seedCartagena } from './seed/cartagena.js';
import { seedDemoAccount } from './seed/demoAccount.js';
import { seedPuertoCabello } from './seed/puertoCabello.js';
import { seedScenario } from './seed/scenario.js';

export const RECORDING_DB_NAME = 'guaca_recording';
export const RECORDING_DB_RE = /^guaca_recording(?:_[a-z0-9]+)*$/;

function urlFor(base: string, db: string): string {
  const u = new URL(base);
  u.pathname = `/${db}`;
  return u.toString();
}

export function recordingDbUrl(
  base = process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca',
  name = RECORDING_DB_NAME,
): string {
  const current = new URL(base).pathname.replace(/^\//, '') || 'guaca';
  if (name === RECORDING_DB_NAME && RECORDING_DB_RE.test(current)) return base;
  if (!RECORDING_DB_RE.test(name)) {
    throw new Error(`Refusing database name '${name}'.`);
  }
  return urlFor(base, name);
}

/**
 * Create the isolated recording database if needed, then migrate and seed.
 * Never drops or truncates the working `guaca` database. Template clone is
 * avoided because the live API holds connections to `guaca`.
 */
export async function ensureRecordingDatabase(
  base = process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca',
): Promise<string> {
  const url = recordingDbUrl(base);
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!RECORDING_DB_RE.test(name)) {
    throw new Error(`Refusing to prepare '${name}'. Recording databases must match ${RECORDING_DB_RE}.`);
  }

  const admin = new pg.Client({ connectionString: urlFor(base, 'postgres') });
  await admin.connect();
  try {
    const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
    if (exists.rows.length === 0) {
      await admin.query(`create database ${name} template template_postgis`);
    }
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await migrate(client);
  } finally {
    client.release();
  }
  await seedPuertoCabello(pool);
  await seedCartagena(pool);
  await seedDemoAccount(pool);
  await seedScenario(pool);
  await pool.end();
  return url;
}
