import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerScenarioApi, type ScenarioApiDeps } from '../../src/scenarioApi.js';

afterEach(() => vi.unstubAllEnvs());

describe('isolated recording API handshake', () => {
  async function check(name: string) {
    const query = vi.fn().mockResolvedValue({ rows: [{ name }] });
    const app = Fastify();
    registerScenarioApi(app, { pool: { query } } as unknown as ScenarioApiDeps);
    try {
      return { response: await app.inject({ method: 'GET', url: '/api/recording/runtime' }), query };
    } finally { await app.close(); }
  }

  it('is unavailable in production even if the flag is enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RECORDING_SCENARIO_ENABLED', 'true');
    const { response, query } = await check('guaca_recording_test');
    expect(response.statusCode).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it('is opt-in in development', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RECORDING_SCENARIO_ENABLED', 'false');
    const { response, query } = await check('guaca_recording_test');
    expect(response.statusCode).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses the ordinary working database', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RECORDING_SCENARIO_ENABLED', 'true');
    expect((await check('guaca')).response.statusCode).toBe(409);
  });

  it('hides the Spotter ask route outside recording', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RECORDING_SCENARIO_ENABLED', 'false');
    const query = vi.fn().mockResolvedValue({ rows: [{ name: 'guaca_recording_test' }] });
    const app = Fastify();
    registerScenarioApi(app, { pool: { query } } as unknown as ScenarioApiDeps);
    try {
      const ask = await app.inject({ method: 'POST', url: '/api/spotter/ask', payload: { text: 'breakfast' } });
      expect(ask.statusCode).toBe(404);
    } finally { await app.close(); }
  });

  it('returns only the isolated database identity', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RECORDING_SCENARIO_ENABLED', 'true');
    const { response } = await check('guaca_recording_test');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ database: 'guaca_recording_test' });
  });
});
