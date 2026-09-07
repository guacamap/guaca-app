import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { SCENARIO_KEY } from './seed/scenario.js';

/** Load apps/api/.env into process.env without printing values. */
export function loadLocalEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../../../apps/api/.env'),
    join(process.cwd(), 'apps/api/.env'),
    join(process.cwd(), '.env'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    return;
  }
}

export function scenarioArg(argv: string[] = process.argv): string | null {
  const flag = argv.indexOf('--scenario');
  if (flag >= 0) return argv[flag + 1] ?? null;
  const eq = argv.find((item) => item.startsWith('--scenario='));
  if (eq) return eq.slice('--scenario='.length) || null;
  return process.env.SCENARIO ?? null;
}

export function requireScenarioId(argv?: string[]): string {
  const id = scenarioArg(argv);
  if (!id) {
    throw new Error(`Pass --scenario ${SCENARIO_KEY} (unknown targets are refused).`);
  }
  return id;
}
