import { loadLocalEnv } from './demoArgv.js';
import { checkScenario } from './seed/scenarioLifecycle.js';
import { formatCheckpoint } from './demoFormat.js';

loadLocalEnv();
const { pool } = await import('./pool.js');

try {
  const result = await checkScenario(pool);
  console.log(formatCheckpoint(result));
  if (!result.ok) process.exitCode = 1;
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
