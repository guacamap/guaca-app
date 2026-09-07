import { describe, expect, it } from 'vitest';
import { requireScenarioId, scenarioArg } from '../../src/demoArgv.js';
import { SCENARIO_KEY } from '../../src/seed/scenario.js';

describe('demo argv', () => {
  it('reads --scenario and --scenario=', () => {
    expect(scenarioArg(['node', 'cli', '--scenario', SCENARIO_KEY])).toBe(SCENARIO_KEY);
    expect(scenarioArg(['node', 'cli', `--scenario=${SCENARIO_KEY}`])).toBe(SCENARIO_KEY);
  });

  it('refuses a missing scenario flag', () => {
    const prev = process.env.SCENARIO;
    delete process.env.SCENARIO;
    try {
      expect(() => requireScenarioId(['node', 'cli'])).toThrow(/unknown targets are refused/i);
    } finally {
      if (prev === undefined) delete process.env.SCENARIO;
      else process.env.SCENARIO = prev;
    }
  });
});
