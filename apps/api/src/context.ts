import type { WeatherProvider } from './weather.js';

/**
 * What a local host knows before you ask: the weather right now, the sea,
 * when the sun sets, whether today is a holiday, what a dollar is worth,
 * and whether a storm is anywhere near. Facts about the world, never about
 * a place. Every feed is fetched server side with the area's coordinates,
 * cached per area, and any failure is a null field, never an error: the
 * conversation must not depend on a third party being up.
 */
export interface AreaContext {
  /** ISO local time in the area's zone, e.g. "2026-08-29T15:10". */
  localTime: string;
  weather: { tempC: number; rainPct: number; windKmh: number; uv: number; summary: 'clear' | 'showers' | 'rain' | 'windy' } | null;
  sea: { waveM: number; swellM: number; seaTempC: number | null; state: 'calm' | 'moderate' | 'rough' } | null;
  sun: { sunrise: string; sunset: string } | null;
  holiday: { name: string; localName: string } | null;
  /** Local currency per USD. Venezuela carries two honest numbers. */
  rates: { currency: string; official: number; parallel: number | null; asOf: string } | null;
  alert: { kind: 'tropical_cyclone' | 'flood' | 'earthquake' | 'tsunami' | 'volcano'; name: string; level: string; distanceKm: number; source: 'NHC' | 'GDACS' } | null;
}

export interface ContextProvider {
  forArea(area: { lat: number; lon: number; country: string; timezone: string }): Promise<AreaContext>;
}

export interface LiveContextOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Weather and sea reuse. Default 3h. */
  cacheMs?: number;
  /** Alerts reuse. Default 15 min. */
  alertCacheMs?: number;
  /** Holidays and rates reuse. Default 6h. */
  slowCacheMs?: number;
  /** Alerts farther than this are not this area's problem. Default 300 km. */
  alertRadiusKm?: number;
}

interface Slot<T> { at: number; value: T }

function kmBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * 111.32;
  const dLon = (bLon - aLon) * 111.32 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLon);
}

/** Local wall clock of a zone as "YYYY-MM-DDTHH:MM", without a library. */
export function localIso(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`;
}

/** One line for a prompt: "15:10 local · 31°C, 20% rain, UV 9 · calm sea 29°C · sunset 18:41 · holiday: Día del Virgen del Valle · 1 USD = 791.67 VES official, 911.73 parallel". */
export function contextLine(c: AreaContext): string {
  const bits: string[] = [`${c.localTime.slice(11)} local`];
  if (c.weather) bits.push(`${Math.round(c.weather.tempC)}°C, ${c.weather.rainPct}% rain, wind ${Math.round(c.weather.windKmh)} km/h, UV ${Math.round(c.weather.uv)} (${c.weather.summary})`);
  if (c.sea) bits.push(`${c.sea.state} sea, waves ${c.sea.waveM.toFixed(1)} m${c.sea.seaTempC != null ? `, water ${Math.round(c.sea.seaTempC)}°C` : ''}`);
  if (c.sun) bits.push(`sunrise ${c.sun.sunrise}, sunset ${c.sun.sunset}`);
  if (c.holiday) bits.push(`public holiday today: ${c.holiday.localName}`);
  if (c.rates) bits.push(`1 USD = ${c.rates.official} ${c.rates.currency} official${c.rates.parallel ? `, ${c.rates.parallel} parallel` : ''}`);
  if (c.alert) bits.push(`ALERT: ${c.alert.kind.replace('_', ' ')} ${c.alert.name} (${c.alert.level}) ${Math.round(c.alert.distanceKm)} km away`);
  return bits.join(' · ');
}

export function liveContextProvider(options: LiveContextOptions = {}): ContextProvider {
  const doFetch = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const cacheMs = options.cacheMs ?? 3 * 60 * 60 * 1000;
  const alertCacheMs = options.alertCacheMs ?? 15 * 60 * 1000;
  const slowCacheMs = options.slowCacheMs ?? 6 * 60 * 60 * 1000;
  const radius = options.alertRadiusKm ?? 300;
  const cache = new Map<string, Slot<unknown>>();

  const memo = async <T>(key: string, ttl: number, load: () => Promise<T>): Promise<T | null> => {
    const hit = cache.get(key) as Slot<T> | undefined;
    if (hit && now().getTime() - hit.at < ttl) return hit.value;
    try {
      const value = await load();
      cache.set(key, { at: now().getTime(), value });
      return value;
    } catch {
      // A failed feed is remembered briefly so a dead vendor is not hit on every turn.
      cache.set(key, { at: now().getTime() - ttl + 5 * 60 * 1000, value: null });
      return null;
    }
  };
  const getJson = async (url: string): Promise<unknown> => {
    const res = await doFetch(url, { signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'guaca/1.0 (+https://guaca.live)' } });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.json();
  };

  return {
    async forArea(area) {
      const key = `${area.lat.toFixed(2)},${area.lon.toFixed(2)}`;
      const t = now();
      const localTime = localIso(t, area.timezone);
      const hourIdx = Number(localTime.slice(11, 13));
      const today = localTime.slice(0, 10);

      const [weatherSun, sea, holiday, rates, alert] = await Promise.all([
        memo(`wx:${key}`, cacheMs, async () => {
          const d = (await getJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${area.lat}&longitude=${area.lon}` +
            `&hourly=temperature_2m,precipitation_probability,wind_speed_10m,uv_index&daily=sunrise,sunset&forecast_days=1&timezone=auto`,
          )) as { hourly: { temperature_2m: number[]; precipitation_probability: number[]; wind_speed_10m: number[]; uv_index: number[] }; daily: { sunrise: string[]; sunset: string[] } };
          const i = Math.min(hourIdx, d.hourly.temperature_2m.length - 1);
          // Rain for the rest of the day, not the current hour alone: a 5% now
          // before a 70% afternoon must not read as a dry day.
          const restOfDay = d.hourly.precipitation_probability.slice(i);
          const rainPct = Math.max(...restOfDay, 0);
          const windKmh = d.hourly.wind_speed_10m[i] ?? 0;
          const summary: NonNullable<AreaContext['weather']>['summary'] = rainPct >= 70 ? 'rain' : rainPct >= 40 ? 'showers' : windKmh >= 35 ? 'windy' : 'clear';
          return {
            weather: { tempC: d.hourly.temperature_2m[i] ?? 0, rainPct, windKmh, uv: Math.max(...d.hourly.uv_index.slice(i, i + 4), 0), summary },
            sun: { sunrise: (d.daily.sunrise[0] ?? '').slice(11), sunset: (d.daily.sunset[0] ?? '').slice(11) },
          };
        }),
        memo(`sea:${key}`, cacheMs, async () => {
          const d = (await getJson(
            `https://marine-api.open-meteo.com/v1/marine?latitude=${area.lat}&longitude=${area.lon}` +
            `&daily=wave_height_max,swell_wave_height_max&hourly=sea_surface_temperature&forecast_days=1&timezone=auto`,
          )) as { daily: { wave_height_max: number[]; swell_wave_height_max: number[] }; hourly: { sea_surface_temperature: Array<number | null> } };
          const waveM = d.daily.wave_height_max[0] ?? 0;
          const swellM = d.daily.swell_wave_height_max[0] ?? 0;
          const seaTempC = d.hourly.sea_surface_temperature[Math.min(hourIdx, d.hourly.sea_surface_temperature.length - 1)] ?? null;
          return { waveM, swellM, seaTempC, state: (waveM >= 1.5 || swellM >= 1.2 ? 'rough' : waveM >= 0.8 ? 'moderate' : 'calm') as 'calm' | 'moderate' | 'rough' };
        }),
        memo(`hol:${area.country}:${today.slice(0, 4)}`, slowCacheMs, async () => {
          const d = (await getJson(`https://date.nager.at/api/v3/PublicHolidays/${today.slice(0, 4)}/${area.country}`)) as Array<{ date: string; name: string; localName: string }>;
          return d;
        }).then((list) => {
          const h = (list ?? []).find((x) => x.date === today);
          return h ? { name: h.name, localName: h.localName } : null;
        }),
        area.country === 'VE'
          ? memo('rates:VE', slowCacheMs, async () => {
              const d = (await getJson('https://ve.dolarapi.com/v1/dolares')) as Array<{ nombre: string; promedio: number; fechaActualizacion: string }>;
              const official = d.find((x) => /oficial|d[oó]lar$/i.test(x.nombre)) ?? d[0];
              const parallel = d.find((x) => /paralelo/i.test(x.nombre));
              if (!official) throw new Error('no official rate');
              return { currency: 'VES', official: Math.round(official.promedio * 100) / 100, parallel: parallel ? Math.round(parallel.promedio * 100) / 100 : null, asOf: official.fechaActualizacion };
            })
          : Promise.resolve(null),
        memo('alerts', alertCacheMs, async () => {
          const found: NonNullable<AreaContext['alert']>[] = [];
          const nhc = (await getJson('https://www.nhc.noaa.gov/CurrentStorms.json').catch(() => ({ activeStorms: [] }))) as { activeStorms?: Array<{ name: string; classification: string; latitudeNumeric: number; longitudeNumeric: number }> };
          for (const s of nhc.activeStorms ?? []) {
            found.push({ kind: 'tropical_cyclone', name: s.name, level: s.classification, distanceKm: kmBetween(area.lat, area.lon, s.latitudeNumeric, s.longitudeNumeric), source: 'NHC' });
          }
          const gd = (await getJson('https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventlist=TC;FL;EQ;TS;VO').catch(() => ({ features: [] }))) as { features?: Array<{ properties: { eventtype: string; alertlevel: string; name: string }; geometry?: { coordinates: [number, number] } }> };
          const kinds: Record<string, NonNullable<AreaContext['alert']>['kind']> = { TC: 'tropical_cyclone', FL: 'flood', EQ: 'earthquake', TS: 'tsunami', VO: 'volcano' };
          for (const f of gd.features ?? []) {
            if (!f.geometry || !kinds[f.properties.eventtype]) continue;
            if (f.properties.alertlevel === 'Green') continue;
            found.push({ kind: kinds[f.properties.eventtype]!, name: f.properties.name, level: f.properties.alertlevel, distanceKm: kmBetween(area.lat, area.lon, f.geometry.coordinates[1], f.geometry.coordinates[0]), source: 'GDACS' });
          }
          return found;
        }).then((list) => {
          const near = (list ?? []).filter((a) => a.distanceKm <= radius).sort((a, b) => a.distanceKm - b.distanceKm);
          return near[0] ?? null;
        }),
      ]);

      return {
        localTime,
        weather: weatherSun?.weather ?? null,
        sea: sea ?? null,
        sun: weatherSun?.sun ?? null,
        holiday: holiday ?? null,
        rates: rates ?? null,
        alert: alert ?? null,
      };
    },
  };
}

/** For tests and for WEATHER_ENABLED=false: every field null, time still right. */
export function disabledContextProvider(now: () => Date = () => new Date()): ContextProvider {
  return {
    async forArea(area) {
      return { localTime: localIso(now(), area.timezone), weather: null, sea: null, sun: null, holiday: null, rates: null, alert: null };
    },
  };
}

// The trends weather seam stays as it was; this file is the wider one.
export type { WeatherProvider };
