import { pool } from './pool.js';
import { seedDemoAccount } from './seed/demoAccount.js';

try {
  if (process.env.NODE_ENV === 'production') throw new Error('Account fixtures are for local development only.');
  const account = await seedDemoAccount(pool);
  console.log(`Account ready: ${account.email}; ${account.savedPlaces} saved places; itinerary /t/${account.shareSlug}`);
  console.log('Local development login: request a code, then enter 000000 with the dev email sender.');
} finally {
  await pool.end();
}
