import { pool } from './pool.js';
import { seedCartagena } from './seed/cartagena.js';

try {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_CARTAGENA_SEED) {
    throw new Error('The Cartagena population is a demo action; set ALLOW_CARTAGENA_SEED=1 to run it in production.');
  }
  const result = await seedCartagena(pool);
  console.log(`Cartagena ready: ${result.inserted} imported candidates, ${result.curated} curated records, ${result.profiles} sourced demo profiles. No local verifications or people created.`);
} finally {
  await pool.end();
}
