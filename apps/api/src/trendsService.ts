import type { Pool } from 'pg';
import { loadTrendSignals, writeTrends } from '@guaca/db';
import { scoreTrends, TREND_VERSION } from '@guaca/agents';
import { describeWeather, forecastForArea, type WeatherProvider } from './weather.js';

export interface TrendCycleResult {
  places: number;
  weatherState: string | null;
}

/**
 * One trend recomputation: gather recorded signals for every verified place,
 * modulate with the area forecast, score deterministically, replace the
 * stored set. Zero inference — this is the same contract as scoreGap, a
 * pure function the scheduler keeps warm.
 *
 * Runs BEFORE clustering in the scheduler cycle so a fresh trend score can
 * inform gap scoring the same tick it was computed.
 */
export async function recomputeTrends(
  pool: Pool,
  opts: { areaId: string; weather?: WeatherProvider | null },
): Promise<TrendCycleResult> {
  let weather = null;
  if (opts.weather) {
    weather = await forecastForArea(pool, opts.weather, opts.areaId);
  }

  const signals = await loadTrendSignals(pool, opts.areaId);
  const scored = scoreTrends(signals, weather);
  const weatherState = weather ? describeWeather(weather) : null;
  await writeTrends(
    pool,
    scored.map((s) => ({
      placeId: s.placeId,
      score: s.score,
      breakdown: { ...s.breakdown, badge: s.badge },
      weatherState,
      trendVersion: TREND_VERSION,
    })),
  );
  return { places: scored.length, weatherState };
}
