import { describe, expect, it } from 'vitest';
import {
  selectSpotter,
  type SpotterCandidate,
} from '../../src/gap/spotterSelection.ts';

function spotter(overrides: Partial<SpotterCandidate>): SpotterCandidate {
  return {
    id: overrides.id ?? 's1',
    name: overrides.name ?? 'Yorman',
    zoneId: overrides.zoneId ?? 'malecon',
    homeH3: overrides.homeH3 ?? 'malecon',
    level: overrides.level ?? 2,
    openMissions: overrides.openMissions ?? 0,
    ...overrides,
  };
}

describe('selectSpotter (T5.3)', () => {
  it('the zone\'s named Spotter wins when available', () => {
    const candidates = [
      spotter({ id: 's1', zoneId: 'malecon', homeH3: 'malecon', level: 3, openMissions: 0 }),
      spotter({ id: 's2', zoneId: 'centro', homeH3: 'centro', level: 4, openMissions: 0 }),
    ];
    const winner = selectSpotter(candidates, 'malecon');
    expect(winner?.id).toBe('s1');
  });

  it('falls back to level, then fewest open missions when no zone owner', () => {
    const candidates = [
      spotter({ id: 's1', zoneId: 'centro', homeH3: 'centro', level: 2, openMissions: 1 }),
      spotter({ id: 's2', zoneId: 'centro', homeH3: 'centro', level: 4, openMissions: 5 }),
      spotter({ id: 's3', zoneId: 'centro', homeH3: 'centro', level: 4, openMissions: 2 }),
    ];
    const winner = selectSpotter(candidates, 'malecon');
    expect(winner?.id).toBe('s3'); // level 4, fewest open missions (2 < 5)
  });

  it('returns null when no candidates', () => {
    expect(selectSpotter([], 'malecon')).toBeNull();
  });
});
