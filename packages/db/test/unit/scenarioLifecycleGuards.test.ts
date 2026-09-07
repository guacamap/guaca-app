import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { checkScenario, resetScenario } from '../../src/seed/scenarioLifecycle.js';
import { SCENARIO_IDS, SCENARIO_KEY } from '../../src/seed/scenario.js';

afterEach(() => vi.unstubAllEnvs());

describe('recording lifecycle boundaries', () => {
  it('refuses production and unknown scenarios before connecting', async () => {
    const query = vi.fn();
    const pool = { query } as unknown as Pool;
    vi.stubEnv('NODE_ENV', 'production');
    await expect(resetScenario(pool, SCENARIO_KEY)).rejects.toThrow('production');
    vi.stubEnv('NODE_ENV', 'test');
    await expect(resetScenario(pool, 'unknown')).rejects.toThrow('Unknown scenario');
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses the working database before starting any transaction', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const query = vi.fn().mockResolvedValue({ rows: [{ name: 'guaca' }] });
    const connect = vi.fn();
    await expect(resetScenario({ query, connect } as unknown as Pool, SCENARIO_KEY)).rejects.toThrow('dedicated guaca_recording');
    expect(connect).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('select current_database() as name');
  });

  it('counts only scenario activities, not unrelated city content', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await checkScenario({ query } as unknown as Pool);
    const [sql, values] = query.mock.calls[0]!;
    expect(sql).toContain('from activities where id = any($5::uuid[])');
    expect(values[4]).toEqual(Object.values(SCENARIO_IDS.activities));
  });
});
