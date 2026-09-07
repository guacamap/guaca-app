import { loadLocalEnv, requireScenarioId } from './demoArgv.js';
import { resetScenario, ScenarioTargetError } from './seed/scenarioLifecycle.js';
import { formatCheckpoint } from './demoFormat.js';

loadLocalEnv();
const { pool } = await import('./pool.js');

try {
  if (process.env.NODE_ENV === 'production') {
    throw new ScenarioTargetError('Scenario reset is refused in production.');
  }
  const scenarioId = requireScenarioId();
  const result = await resetScenario(pool, scenarioId);
  console.log(`Reset ${scenarioId} to the start checkpoint.`);
  console.log(formatCheckpoint(result));
  if (!result.ok) process.exitCode = 1;
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
