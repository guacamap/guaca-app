import { describe, expect, it } from 'vitest';
import { contextLine, liveContextProvider, localIso } from '../../src/context.ts';

const AREA = { lat: 10.4745, lon: -68.0125, country: 'VE', timezone: 'America/Caracas' };
const NOW = () => new Date('2026-09-08T19:10:00Z'); // 15:10 in Caracas, a public holiday

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const hourly = (n: number, v: number) => Array.from({ length: 24 }, () => v).map((x, i) => (i === n ? v : x));
const ROUTES = {
  'api.open-meteo.com/v1/forecast': {
    hourly: { temperature_2m: hourly(15, 31), precipitation_probability: Array.from({ length: 24 }, (_, i) => (i >= 17 ? 70 : 5)), wind_speed_10m: hourly(15, 12), uv_index: hourly(15, 9) },
    daily: { sunrise: ['2026-09-08T06:22'], sunset: ['2026-09-08T18:41'] },
  },
  'marine-api.open-meteo.com': { daily: { wave_height_max: [0.4], swell_wave_height_max: [0.3] }, hourly: { sea_surface_temperature: hourly(15, 29.2) } },
  'date.nager.at': [{ date: '2026-09-08', name: 'Feast of Our Lady of the Valley', localName: 'Día del Virgen del Valle' }],
  've.dolarapi.com': [{ nombre: 'Dólar', promedio: 791.6667, fechaActualizacion: '2026-08-28T00:00:00-04:00' }, { nombre: 'Paralelo', promedio: 911.727669, fechaActualizacion: '2026-08-29T12:01:24Z' }],
  'nhc.noaa.gov': { activeStorms: [{ name: 'Karina', classification: 'TS', latitudeNumeric: 14.7, longitudeNumeric: -117 }] },
  'gdacs.org': { features: [] },
};

describe('area context', () => {
  it('reads the local clock in the area zone', () => {
    expect(localIso(NOW(), 'America/Caracas')).toBe('2026-09-08T15:10');
  });

  it('assembles weather, sea, sun, holiday, rates, and ignores a storm 5,000 km away', async () => {
    const ctx = await liveContextProvider({ fetchImpl: fakeFetch(ROUTES), now: NOW }).forArea(AREA);
    expect(ctx.localTime).toBe('2026-09-08T15:10');
    expect(ctx.weather).toMatchObject({ tempC: 31, rainPct: 70, summary: 'rain', uv: 9 });
    expect(ctx.sea).toMatchObject({ state: 'calm', waveM: 0.4, seaTempC: 29.2 });
    expect(ctx.sun).toEqual({ sunrise: '06:22', sunset: '18:41' });
    expect(ctx.holiday?.localName).toBe('Día del Virgen del Valle');
    expect(ctx.rates).toMatchObject({ currency: 'VES', official: 791.67, parallel: 911.73 });
    expect(ctx.alert).toBeNull();
    const line = contextLine(ctx);
    expect(line).toContain('15:10 local');
    expect(line).toContain('calm sea');
    expect(line).toContain('791.67 VES official, 911.73 parallel');
    expect(line).not.toContain('ALERT');
  });

  it('a storm inside the radius becomes the alert', async () => {
    const routes = { ...ROUTES, 'nhc.noaa.gov': { activeStorms: [{ name: 'Beryl', classification: 'HU', latitudeNumeric: 12.2, longitudeNumeric: -66.5 }] } };
    const ctx = await liveContextProvider({ fetchImpl: fakeFetch(routes), now: NOW }).forArea(AREA);
    expect(ctx.alert).toMatchObject({ kind: 'tropical_cyclone', name: 'Beryl', level: 'HU', source: 'NHC' });
    expect(ctx.alert!.distanceKm).toBeLessThan(300);
    expect(contextLine(ctx)).toMatch(/ALERT: tropical cyclone Beryl/);
  });

  it('a dead feed is a null field, not an error, and the rest still arrives', async () => {
    const routes = { ...ROUTES }; delete (routes as Record<string, unknown>)['marine-api.open-meteo.com'];
    const ctx = await liveContextProvider({ fetchImpl: fakeFetch(routes), now: NOW }).forArea(AREA);
    expect(ctx.sea).toBeNull();
    expect(ctx.weather).not.toBeNull();
  });

  it('caches per area so a conversation of twenty turns is one round of requests', async () => {
    let calls = 0;
    const counting: typeof fetch = async (input, init) => { calls++; return fakeFetch(ROUTES)(input, init); };
    const p = liveContextProvider({ fetchImpl: counting, now: NOW });
    await p.forArea(AREA); await p.forArea(AREA); await p.forArea(AREA);
    expect(calls).toBe(6); // forecast, marine, holidays, rates, NHC, GDACS: once
  });
});
