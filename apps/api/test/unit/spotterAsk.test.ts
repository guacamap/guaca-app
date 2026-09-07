import { describe, expect, it } from 'vitest';
import { groundedSpotterAsk } from '../../src/spotterAsk.js';
import type { SpotterMission } from '@guaca/db';

function mission(partial: Partial<SpotterMission> & { id: string }): SpotterMission {
  return {
    brief: 'Check it',
    targetCategory: 'eat_drink',
    targetH3: '8a',
    rewardMinor: 120,
    currency: 'USD',
    status: 'offered',
    expiresAt: new Date('2026-09-26T00:00:00Z'),
    taskKind: 'hours',
    placeId: null,
    placeName: 'Casa Rosada',
    photoUrl: null,
    lat: 10.47,
    lon: -68.01,
    expectedEvidenceEn: null,
    expectedEvidenceEs: null,
    mine: true,
    ...partial,
  };
}

describe('groundedSpotterAsk', () => {
  const breakfast = mission({ id: '00000000-0000-4000-8000-00000000c101', placeName: 'Casa Rosada', taskKind: 'hours' });
  const witness = mission({
    id: '00000000-0000-4000-8000-00000000c106',
    placeName: 'Blue Marine',
    status: 'submitted',
    mine: false,
    taskKind: 'evidence',
  });
  const beach = mission({
    id: '00000000-0000-4000-8000-00000000c103',
    placeName: 'Playa Delfín',
    taskKind: 'access',
    targetCategory: 'beach_water',
  });

  it('points a breakfast question at the hours mission', () => {
    const reply = groundedSpotterAsk([breakfast, witness, beach], 'Where can I check breakfast hours?', 'en');
    expect(reply.missionIds).toEqual([breakfast.id]);
    expect(reply.text).toMatch(/Casa Rosada/);
    expect(reply.text).not.toMatch(/itinerary|verified fact/i);
  });

  it('points a second-local question at submitted work that is not mine', () => {
    const reply = groundedSpotterAsk([breakfast, witness], 'Who needs a second witness?', 'en');
    expect(reply.missionIds).toEqual([witness.id]);
    expect(reply.text).toMatch(/Blue Marine/);
  });

  it('does not invent work when nothing matches', () => {
    const reply = groundedSpotterAsk([], 'breakfast hours', 'en');
    expect(reply.missionIds).toEqual([]);
    expect(reply.text).toMatch(/First visit|I'm here/);
  });
});
