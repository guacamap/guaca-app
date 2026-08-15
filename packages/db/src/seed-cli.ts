import { pool } from './pool.js';
import { seed } from './seed/index.js';

/**
 * `node seed-cli.js` seeds reference geography ONLY — safe on production.
 * `--demo` adds the invented spotters and villas used in dev and staging.
 */
const demo = process.argv.includes('--demo');

try {
  await seed(pool, { demo });
  console.log(demo ? 'seed complete (reference + demo data)' : 'seed complete (reference data only)');
} finally {
  await pool.end();
}
