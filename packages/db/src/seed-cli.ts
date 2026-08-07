import { pool } from './pool.js';
import { seed } from './seed/index.js';

try {
  await seed(pool);
  console.log('seed complete');
} finally {
  await pool.end();
}
