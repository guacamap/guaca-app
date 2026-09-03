import { describe, expect, it } from 'vitest';
import { estimateLeg, osrmRouter } from '../../src/routing.js';
import { rainWindows, rainWindowsLine } from '../../src/context.js';

const A = { lat: 10.4716, lon: -68.0056 };
const B = { lat: 10.4800, lon: -68.0100 }; // ~1 km
const C = { lat: 10.5500, lon: -67.9000 }; // ~14 km

describe('travel between stops', () => {
  it('estimates a short hop on foot and a long one by car, and says it is an estimate', () => {
    expect(estimateLeg(A, B)).toMatchObject({ mode: 'foot', estimated: true });
    expect(estimateLeg(A, C)).toMatchObject({ mode: 'car', estimated: true });
    expect(estimateLeg(A, C).minutes).toBeGreaterThan(20);
  });
  it('reads OSRM durations, walks the short leg, and calls an unroutable leg a boat', async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ code: 'Ok', durations: [[0, 300, null], [300, 0, null], [null, null, 0]], distances: [[0, 900, null], [900, 0, null], [null, null, 0]] }), { status: 200 })) as unknown as typeof fetch;
    const legs = await osrmRouter('http://router', fake).legs([A, B, C]);
    expect(legs[0]).toMatchObject({ mode: 'foot', estimated: false });
    expect(legs[1]).toMatchObject({ mode: 'boat', estimated: true });
  });
  it('falls back to estimates when the router is down', async () => {
    const down = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    const legs = await osrmRouter('http://router', down).legs([A, C]);
    expect(legs[0]).toMatchObject({ mode: 'car', estimated: true });
  });
});

describe('rain windows', () => {
  it('turns hourly probabilities into ranges at 50%', () => {
    const hours = Array.from({ length: 24 }, (_, h) => (h >= 13 && h < 16 ? 70 : h === 20 ? 55 : 10));
    expect(rainWindows(hours)).toEqual([{ from: 13, to: 16 }, { from: 20, to: 21 }]);
    expect(rainWindowsLine(hours)).toBe('13:00–16:00, 20:00–21:00');
    expect(rainWindowsLine(Array(24).fill(10))).toBeNull();
  });
});
