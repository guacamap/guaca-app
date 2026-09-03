import { describe, expect, it } from 'vitest';
import { groundFromVerifiedRows } from '@guaca/agents';
import { applyTravel } from '../../src/travel.js';
import type { Router } from '../../src/routing.js';

describe('applying travel to a plan', () => {
  it('pushes a stop that starts before the traveller could arrive, and keeps the legs', async () => {
    const ids = new Set(['a', 'b', 'c']);
    const artifact = groundFromVerifiedRows([
      { placeId: 'a', startMin: 600, durationMin: 60, reasonCode: 'NEAREST' },
      { placeId: 'b', startMin: 670, durationMin: 60, reasonCode: 'NEAREST' },
      { placeId: 'c', startMin: 800, durationMin: 60, reasonCode: 'NEAREST' },
    ], ids);
    const router: Router = { legs: async () => [{ minutes: 40, mode: 'car', estimated: false, distanceKm: 20 }, { minutes: 5, mode: 'foot', estimated: false, distanceKm: 0.4 }] };
    const coords = new Map([['a', { lat: 0, lon: 0 }], ['b', { lat: 0, lon: 0.2 }], ['c', { lat: 0, lon: 0.201 }]]);
    const r = await applyTravel(artifact, coords, router);
    const by = Object.fromEntries(r.artifact.stops.map((s) => [s.placeId, s.startMin]));
    expect(by.a).toBe(600);
    expect(by.b).toBe(600 + 60 + 40 + 5);
    expect(by.c).toBe(800); // already late enough after b ends at 765 + 5 + 5
    expect(r.legs.get('a>b')).toMatchObject({ mode: 'car', minutes: 40 });
  });
});
