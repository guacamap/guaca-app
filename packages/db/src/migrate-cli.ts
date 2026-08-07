import { pool } from './pool.js';
import { migrate } from './migrate.js';

const client = await pool.connect();
try {
  const ran = await migrate(client);
  if (ran.length === 0) {
    console.log('no pending migrations');
  } else {
    for (const name of ran) console.log(`applied ${name}`);
  }
} finally {
  client.release();
  await pool.end();
}
