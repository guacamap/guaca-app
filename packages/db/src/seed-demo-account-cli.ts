import { pool } from './pool.js';
import { seedDemoAccount } from './seed/demoAccount.js';

try {
  if (process.env.NODE_ENV === 'production') throw new Error('Account fixtures are for local development only.');
  const account = await seedDemoAccount(pool);
  console.log(`Account ready: ${account.email}; ${account.savedPlaces} saved places; itinerary /t/${account.shareSlug}`);
  if (account.cartagenaSavedPlaces > 0) {
    console.log(`Cartagena on the same account: ${account.cartagenaSavedPlaces} saved places, ${account.cartagenaTrips} itineraries (additive, nothing Puerto Cabello touched).`);
  }
  console.log(`Demo cast: ${account.castSpotters} spotters, clean names, logins on @demo.guaca.live (local code 000000).`);
  console.log(`Cast venues: ${account.castProfiles} photo-backed demo profiles (illustrative captions where the photo is not of the venue).`);
  console.log(`Business posts: ${account.businessPosts} published as business commentary, never as verified facts.`);
  console.log(`Operator access: ${account.operatorEmail} is on the panel allowlist; request a login code in the admin app.`);
  console.log('Local development login: request a code, then enter 000000 with the dev email sender.');
} finally {
  await pool.end();
}
