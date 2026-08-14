import { describe, expect, it } from 'vitest';
import { analyzeMapHealth, type MapHealthStats } from '../../src/health/analyze.js';
import { narrateMapHealth } from '../../src/health/narrate.js';
import { FakeInference } from '../../src/inference/fake.js';

const stats: MapHealthStats = {
  areaId: 'a',
  categories: [
    // Deficit + real demand → the only mission-candidate shape.
    { category: 'eat_drink', verified: 3, refusedAsks: 4 },
    // At target with refused asks → covered demand, never a candidate.
    { category: 'beach_water', verified: 8, refusedAsks: 2 },
    // Big deficit, zero demand → finding only (coverage grows in demand order).
    { category: 'nightlife_music', verified: 0, refusedAsks: 0 },
  ],
  stalePlaces: [
    { id: 'p1', name: 'Vieja Arepera', category: 'eat_drink', verifiedAt: '2026-01-01T00:00:00Z' },
  ],
  weakLandmarks: [
    { id: 'p2', name: 'Kiosco Azul', category: 'eat_drink', landmarkDescription: 'centro' },
  ],
  zones: [
    { zoneId: 'malecon', zoneName: 'Malecón', verified: 3 },
    { zoneId: 'rancho-chico', zoneName: 'Rancho Chico', verified: 0 },
  ],
};

describe('map-health analysis (§ audit agent — deterministic core)', () => {
  it('creates mission candidates ONLY where refused demand meets a deficit', () => {
    const a = analyzeMapHealth(stats);
    expect(a.missionCandidates).toHaveLength(1);
    expect(a.missionCandidates[0]).toMatchObject({
      category: 'eat_drink',
      demandAsks: 4,
      deficit: 9,
      priority: 4 * 2 + 9,
    });
    // covered demand and speculative deficits never become candidates
    const categories = a.missionCandidates.map((c) => c.category);
    expect(categories).not.toContain('beach_water');
    expect(categories).not.toContain('nightlife_music');
  });

  it('reports deficits without demand as findings, ranked below unmet demand', () => {
    const a = analyzeMapHealth(stats);
    const kinds = a.findings.map((f) => f.kind);
    expect(kinds[0]).toBe('unmet_demand');
    expect(kinds).toContain('category_deficit');
    expect(kinds).toContain('stale_places');
    expect(kinds).toContain('weak_landmarks');
    expect(kinds).toContain('zone_gap');
    const zoneFinding = a.findings.find((f) => f.kind === 'zone_gap')!;
    expect(zoneFinding.detail).toContain('Rancho Chico');
    expect(zoneFinding.detail).not.toContain('Malecón');
  });

  it('is deterministic — same stats, same analysis', () => {
    expect(analyzeMapHealth(stats)).toEqual(analyzeMapHealth(stats));
  });

  it('narration degrades to null without a fixture and never throws', async () => {
    const fake = new FakeInference({});
    const narrative = await narrateMapHealth(fake, analyzeMapHealth(stats));
    expect(narrative).toBeNull();
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.purpose).toBe('map_health_narrative');
  });
});
