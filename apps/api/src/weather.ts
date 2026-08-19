import type { Pool } from 'pg';
import type { WeatherState } from '@guaca/agents';

/**
 * The weather seam — same pattern as PayoutProvider and EmailSender: one
 * interface, one boring default, failure is always a graceful null. Trends
 * modulate with weather; they never depend on it. A down provider must not
 * cost an answer, a mission, or a scheduler tick.
 */
export interface WeatherProvider {
  forecast(lat: number, lon: number): Promise<WeatherState | null>;
}

export interface OpenMeteoOptions {
  baseUrl?: string;
  /** Injected in tests; global fetch in production. */
  fetchImpl?: typeof fetch;
  /** How long a successful forecast is reused. Default 3h. */
  cacheMs?: number;
  /** How long a failure is remembered before retrying. Default 5min. */
  errorCacheMs?: number;
}

interface CacheEntry {
  at: number;
  value: WeatherState | null;
}

/**
 * Open-Meteo: free, keyless, no account — the provider a hackathon can
 * honestly run and a privacy policy can honestly name (it receives
 * coordinates only, no user data). CC-BY 4.0, attributed in DATA_SOURCES.md.
 */
export function openMeteoProvider(options: OpenMeteoOptions = {}): WeatherProvider {
  const baseUrl = options.baseUrl ?? 'https://api.open-meteo.com';
  const doFetch = options.fetchImpl ?? fetch;
  const cacheMs = options.cacheMs ?? 3 * 60 * 60 * 1000;
  const errorCacheMs = options.errorCacheMs ?? 5 * 60 * 1000;
  const cache = new Map<string, CacheEntry>();

  return {
    async forecast(lat, lon): Promise<WeatherState | null> {
      const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      const hit = cache.get(key);
      const ttl = hit?.value === null ? errorCacheMs : cacheMs;
      if (hit && Date.now() - hit.at < ttl) return hit.value;

      let value: WeatherState | null = null;
      try {
        const url =
          `${baseUrl}/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=precipitation_probability_max,wind_speed_10m_max,temperature_2m_max` +
          `&forecast_days=3&timezone=auto`;
        const res = await doFetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const body = (await res.json()) as {
            daily?: {
              precipitation_probability_max?: Array<number | null>;
              wind_speed_10m_max?: Array<number | null>;
              temperature_2m_max?: Array<number | null>;
            };
          };
          const d = body.daily;
          const maxOf = (xs: Array<number | null> | undefined): number =>
            Math.max(0, ...(xs ?? []).filter((x): x is number => x !== null));
          value = {
            precipProbability: Math.min(1, maxOf(d?.precipitation_probability_max) / 100),
            windKph: maxOf(d?.wind_speed_10m_max),
            tempC: maxOf(d?.temperature_2m_max),
          };
        }
      } catch {
        // Network down, timeout, malformed body — all become "no weather".
      }
      cache.set(key, { at: Date.now(), value });
      return value;
    },
  };
}

/** A provider that always knows nothing — WEATHER_ENABLED=false. */
export function disabledWeatherProvider(): WeatherProvider {
  return { forecast: async () => null };
}

/** Human-honest one-word state stored beside each trend score. */
export function describeWeather(w: WeatherState): string {
  const parts: string[] = [];
  if (w.precipProbability >= 0.5) parts.push('rainy');
  else if (w.windKph < 15) parts.push('calm');
  if (w.tempC >= 31) parts.push('hot');
  return parts.length > 0 ? parts.join('+') : 'fair';
}

/** The forecast for an area's centroid — one call per area is pilot-honest. */
export async function forecastForArea(
  pool: Pool,
  provider: WeatherProvider,
  areaId: string,
): Promise<WeatherState | null> {
  try {
    const centre = await pool.query<{ lat: number; lon: number }>(
      `select ST_Y(c)::float8 as lat, ST_X(c)::float8 as lon
         from (select ST_Centroid(geom::geometry) as c from areas where id = $1) x`,
      [areaId],
    );
    const row = centre.rows[0];
    if (!row) return null;
    return await provider.forecast(row.lat, row.lon);
  } catch {
    return null;
  }
}
