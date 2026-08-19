import { describe, expect, it } from 'vitest';
import {
  runGapAgent,
  type GapAgentOptions,
  type GapAgentResult,
} from '../../src/gap/agent.ts';
import { HARD_GATES, scoreGap } from '../../src/gap/scoring.ts';

function options(overrides: Partial<GapAgentOptions> = {}): GapAgentOptions {
  return {
    areaId: 'area-1',
    dryRun: false,
    minScore: 45,
    maxRewardMinor: 500,
    dailyCap: 5,
    listGaps: async () => [],
    countMissionsToday: async () => 0,
    score: () => ({ score: 0, breakdown: { D: 0, Rmult: 0, Cmult: 0, S: 0, F: 0, T: 1, q: 0, s: 0 } }),
    selectSpotter: async () => null,
    composeBrief: () => '',
    commission: async () => ({ status: 'offered' as const, missionId: 'm1' }),
    ...overrides,
  };
}

describe('runGapAgent (T5.6)', () => {
  it('dry-run scores and explains without commissioning', async () => {
    const commissions: string[] = [];
    const result: GapAgentResult = await runGapAgent(
      options({
        dryRun: true,
        listGaps: async () => [
          { id: 'g1', category: 'eat_drink', h3_8: 'h', questionCount: 7, distinctSessionCount: 6 },
        ],
        score: () => ({ score: 120, breakdown: { D: 1, Rmult: 1, Cmult: 1, S: 1, F: 1, T: 1, q: 7, s: 6 } }),
        selectSpotter: async () => ({ id: 's1', name: 'Yorman', zoneId: 'h', homeH3: 'h', level: 2, openMissions: 0 }),
        commission: async (args) => {
          commissions.push(args.gapId);
          return { status: 'offered' as const, missionId: 'm1' };
        },
      }),
    );
    expect(result.commissioned).toHaveLength(0);
    expect(result.explained.length).toBeGreaterThan(0);
    expect(commissions).toHaveLength(0);
  });

  it('commissions a gap that passes the hard gates and score floor', async () => {
    const result: GapAgentResult = await runGapAgent(
      options({
        dryRun: false,
        listGaps: async () => [
          { id: 'g1', category: 'eat_drink', h3_8: 'h', questionCount: 7, distinctSessionCount: 6 },
        ],
        score: () => ({ score: 120, breakdown: { D: 1, Rmult: 1, Cmult: 1, S: 1, F: 1, T: 1, q: 7, s: 6 } }),
        selectSpotter: async () => ({ id: 's1', name: 'Yorman', zoneId: 'h', homeH3: 'h', level: 2, openMissions: 0 }),
        commission: async () => ({ status: 'offered' as const, missionId: 'm1' }),
      }),
    );
    expect(result.commissioned).toHaveLength(1);
    expect(result.commissioned[0]!.missionId).toBe('m1');
  });

  it('a gap below the score floor is never commissioned', async () => {
    const commissions: string[] = [];
    const result: GapAgentResult = await runGapAgent(
      options({
        dryRun: false,
        listGaps: async () => [
          { id: 'g1', category: 'eat_drink', h3_8: 'h', questionCount: 7, distinctSessionCount: 6 },
        ],
        score: () => ({ score: 30, breakdown: { D: 1, Rmult: 1, Cmult: 1, S: 1, F: 1, T: 1, q: 7, s: 6 } }),
        selectSpotter: async () => ({ id: 's1', name: 'Yorman', zoneId: 'h', homeH3: 'h', level: 2, openMissions: 0 }),
        commission: async (args) => {
          commissions.push(args.gapId);
          return { status: 'offered' as const, missionId: 'm1' };
        },
      }),
    );
    expect(result.commissioned).toHaveLength(0);
    expect(commissions).toHaveLength(0);
  });

  it('HARD_GATES blocks spam and unreachable zones', () => {
    expect(HARD_GATES({ questionCount: 20, distinctSessions: 1, spotterCapacityInZone: 1, askAgeDays: [], properties: [], verifiedPlaces: [], accessDifficulty: 0 })).toBe(false);
    expect(HARD_GATES({ questionCount: 9, distinctSessions: 7, spotterCapacityInZone: 0, askAgeDays: [], properties: [], verifiedPlaces: [], accessDifficulty: 0 })).toBe(false);
    expect(HARD_GATES({ questionCount: 7, distinctSessions: 6, spotterCapacityInZone: 1, askAgeDays: [], properties: [], verifiedPlaces: [], accessDifficulty: 0 })).toBe(true);
  });
});

describe('runGapAgent — continuous-loop fixes', () => {
  it('counts today\'s missions live within the run — the cap bounds commissions, not runs', async () => {
    const seen: number[] = [];
    const result = await runGapAgent(
      options({
        dailyCap: 5,
        listGaps: async () => [
          { id: 'g1', category: 'eat_drink', h3_8: 'h', questionCount: 7, distinctSessionCount: 6 },
          { id: 'g2', category: 'eat_drink', h3_8: 'h', questionCount: 7, distinctSessionCount: 6 },
          { id: 'g3', category: 'eat_drink', h3_8: 'h', questionCount: 7, distinctSessionCount: 6 },
        ],
        score: () => ({ score: 120, breakdown: { D: 1, Rmult: 1, Cmult: 1, S: 1, F: 1, T: 1, q: 7, s: 6 } }),
        selectSpotter: async () => ({ id: 's1', name: 'Yorman', zoneId: 'h', homeH3: 'h', level: 2, openMissions: 0 }),
        commission: async (args) => {
          seen.push(args.missionsToday);
          return { status: 'offered' as const, missionId: 'm' + seen.length };
        },
      }),
    );
    expect(result.commissioned).toHaveLength(3);
    expect(seen).toEqual([0, 1, 2]); // snapshot + live increment
  });

  it('persists every computed score, even for gaps it will not commission', async () => {
    const persisted: Array<[string, number]> = [];
    await runGapAgent(
      options({
        listGaps: async () => [
          { id: 'g-gated', category: 'eat_drink', h3_8: 'h', questionCount: 1, distinctSessionCount: 1 },
          { id: 'g-floor', category: 'eat_drink', h3_8: 'h', questionCount: 7, distinctSessionCount: 6 },
        ],
        loadSignals: async (gap) => ({
          questionCount: gap.questionCount,
          distinctSessions: gap.distinctSessionCount,
          askAgeDays: [],
          properties: [],
          verifiedPlaces: [],
          spotterCapacityInZone: 1,
          accessDifficulty: 0,
        }),
        score: (g) => scoreGap(g),
        persistScore: async (gapId, score) => {
          persisted.push([gapId, score]);
        },
        selectSpotter: async () => ({ id: 's1', name: 'Yorman', zoneId: 'h', homeH3: 'h', level: 2, openMissions: 0 }),
        commission: async () => ({ status: 'offered' as const, missionId: 'm1' }),
      }),
    );
    expect(persisted).toHaveLength(2); // the gated gap's score lands too
    expect(new Set(persisted.map((p) => p[0]))).toEqual(new Set(['g-gated', 'g-floor']));
    expect(persisted.every(([, score]) => score > 0)).toBe(true);
  });

  it('briefs carry the human zone name and a refresh hint for stale places', async () => {
    const briefs: string[] = [];
    await runGapAgent(
      options({
        listGaps: async () => [
          { id: 'g1', category: 'eat_drink', h3_8: '8a…', questionCount: 7, distinctSessionCount: 6 },
        ],
        loadSignals: async () => ({
          questionCount: 7,
          distinctSessions: 6,
          askAgeDays: [0],
          properties: [],
          verifiedPlaces: [],
          spotterCapacityInZone: 1,
          accessDifficulty: 0,
          zoneName: 'Malecón',
          stalePlaceNames: ['Arepera del Muelle'],
        }),
        score: () => ({ score: 120, breakdown: { D: 1, Rmult: 1, Cmult: 1, S: 1, F: 1, T: 1, q: 7, s: 6 } }),
        selectSpotter: async () => ({ id: 's1', name: 'Yorman', zoneId: 'h', homeH3: 'h', level: 2, openMissions: 0 }),
        composeBrief: (input) => {
          briefs.push(`${input.zoneName}|${input.landmarkHint ?? ''}`);
          return 'brief';
        },
        commission: async () => ({ status: 'offered' as const, missionId: 'm1' }),
      }),
    );
    expect(briefs).toEqual(['Malecón|revisar si siguen igual: Arepera del Muelle']);
  });
});
