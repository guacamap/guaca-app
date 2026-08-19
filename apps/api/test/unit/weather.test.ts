import { describe, expect, it } from 'vitest';
import {
  describeWeather,
  disabledWeatherProvider,
  openMeteoProvider,
} from '../../src/weather.ts';

function okBody(): unknown {
  return {
    daily: {
      precipitation_probability_max: [10, 80, 30],
      wind_speed_10m_max: [9, 22, 14],
      temperature_2m_max: [29, 27, 32],
    },
  };
}

function fetchOk(body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
}

const fetchFail: typeof fetch = (async () => {
  throw new Error('network down');
}) as typeof fetch;

describe('openMeteoProvider', () => {
  it('maps the daily forecast to the category-relevant state', async () => {
    const w = openMeteoProvider({ fetchImpl: fetchOk(okBody()) });
    const f = await w.forecast(10.47, -68.0);
    expect(f).not.toBeNull();
    expect(f!.precipProbability).toBeCloseTo(0.8, 5); // max across 3 days
    expect(f!.windKph).toBe(22);
    expect(f!.tempC).toBe(32);
  });

  it('a down provider degrades to null, never throws', async () => {
    const w = openMeteoProvider({ fetchImpl: fetchFail, errorCacheMs: 60_000 });
    await expect(w.forecast(10.47, -68.0)).resolves.toBeNull();
  });

  it('caches per rounded location — one area, one call', async () => {
    let calls = 0;
    const counting: typeof fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify(okBody()), { status: 200 });
    }) as typeof fetch;
    const w = openMeteoProvider({ fetchImpl: counting, cacheMs: 60_000 });
    await w.forecast(10.4716, -68.0056);
    await w.forecast(10.4719, -68.0058); // same 3-dp cell
    expect(calls).toBe(1);
    await w.forecast(10.6, -68.0); // different cell
    expect(calls).toBe(2);
  });

  it('null results are retried sooner than successes', async () => {
    let calls = 0;
    let failing = true;
    const flaky: typeof fetch = (async () => {
      calls += 1;
      if (failing) throw new Error('down');
      return new Response(JSON.stringify(okBody()), { status: 200 });
    }) as typeof fetch;
    const w = openMeteoProvider({
      fetchImpl: flaky,
      errorCacheMs: 0,
      cacheMs: 60_000,
    });
    await w.forecast(10.47, -68.0);
    failing = false;
    const f = await w.forecast(10.47, -68.0);
    expect(f).not.toBeNull();
    expect(calls).toBe(2);
  });
});

describe('weather plumbing', () => {
  it('disabled provider always knows nothing', async () => {
    await expect(disabledWeatherProvider().forecast(1, 1)).resolves.toBeNull();
  });

  it('describeWeather states are honest and compound', () => {
    expect(describeWeather({ precipProbability: 0.8, windKph: 30, tempC: 27 })).toBe('rainy');
    expect(describeWeather({ precipProbability: 0.1, windKph: 8, tempC: 29 })).toBe('calm');
    expect(describeWeather({ precipProbability: 0.1, windKph: 8, tempC: 33 })).toBe('calm+hot');
    expect(describeWeather({ precipProbability: 0.2, windKph: 25, tempC: 28 })).toBe('fair');
  });
});
