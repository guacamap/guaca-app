import { pool } from './pool.js';
import { seedPuertoCabello } from './seed/puertoCabello.js';

try {
  const result = await seedPuertoCabello(pool);
  console.log(`Puerto Cabello ready: ${result.inserted} new public places, ${result.profiles} sourced demo profiles. No local verifications or people created.`);
} finally {
  await pool.end();
}
