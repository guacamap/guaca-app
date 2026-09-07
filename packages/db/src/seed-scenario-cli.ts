import { loadLocalEnv } from './demoArgv.js';
import { seedScenario } from './seed/scenario.js';

loadLocalEnv();
const { pool } = await import('./pool.js');

try {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Scenario fixtures are for local development only.');
  }
  const result = await seedScenario(pool);
  console.log(
    `Scenario ready: ${result.stays} stays, ${result.activities} activities, ${result.observations} observations, ${result.spotters} spotters, ${result.ledgerEntries} ledger rows, ${result.catalogItems} catalog items, ${result.entitlements} entitlements, ${result.licenses} licenses, ${result.pcMissions} Puerto Cabello missions. Additive only; existing Puerto Cabello and Cartagena rows were not updated.`,
  );
} finally {
  await pool.end();
}
