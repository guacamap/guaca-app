import { describe, expect, it } from 'vitest';
import { scoreGap, type GapSignals, type ScoredGap, HARD_GATES } from '../../src/gap/scoring.ts';

const TIER_WEIGHT = { PARTNER_PREMIUM: 3.0, PARTNER: 1.8, TRIAL: 0.6, NONE: 0 } as const;
const ACCESS_PENALTY = [1.0, 0.85, 0.6] as const;

function baseSignals(overrides: Partial<GapSignals> = {}): GapSignals {
  return {
    questionCount: 7,
    distinctSessions: 6,
    askAgeDays: [0, 0, 0, 0, 0, 0, 0],
    properties: [],
    verifiedPlaces: [],
    spotterCapacityInZone: 1,
    accessDifficulty: 0,
    ...overrides,
  };
}

/**
 * The behavioural contract that actually governs spending. The plan's prose
 * says the scarcity term is "steep — we only pay where we have (almost)
 * nothing". These assert that intent directly, in terms of commission /
 * no-commission at the documented floor of 45, rather than pinning magic
 * numbers that can drift with the constants.
 */
describe('scoreGap — existing coverage must suppress spending', () => {
  const FLOOR = 45;
  const withCoverage = (ages: number[]) =>
    scoreGap(
      baseSignals({
        properties: [{ tier: 'PARTNER' as const, distanceKm: 0.3 }],
        verifiedPlaces: ages.map((ageDays) => ({ ageDays })),
      }),
    ).score;

  it('commissions where there is no coverage at all', () => {
    expect(withCoverage([])).toBeGreaterThanOrEqual(FLOOR);
  });

  it('does NOT commission where two fresh verified places already exist', () => {
    // The whole point of the scarcity term: raw demand alone must not buy a
    // mission for a zone that is already covered.
    expect(withCoverage([0, 0])).toBeLessThan(FLOOR);
  });

  it('does NOT commission where three fresh verified places exist', () => {
    expect(withCoverage([0, 0, 0])).toBeLessThan(FLOOR);
  });

  it('DOES commission a refresh when that coverage has gone stale', () => {
    expect(withCoverage([150, 150])).toBeGreaterThanOrEqual(FLOOR);
  });

  it('still commissions where coverage is only one thin place', () => {
    expect(withCoverage([0])).toBeGreaterThanOrEqual(FLOOR);
  });
});

describe('scoreGap (§7.5 worked table)', () => {
  // RESOLVED contract conflict. The plan's worked table asserted 219/42/143,
  // which is not reachable from its own prose formula — at the stated
  // exponent of 1.5 the numbers are 288/55/187, and row 2 lands ABOVE the
  // floor, meaning the agent would pay for a zone it had already covered.
  // The table's *intent* was the load-bearing part, so SCARCITY_EXPONENT is
  // 2.0 (see scoring.ts). The absolute magnitudes below are consequences of
  // that constant; the behaviour that matters is pinned in the
  // "existing coverage must suppress spending" block above.
  it('"7 guests asked, we have nothing", PARTNER hotel 300m → commissions', () => {
    const g = baseSignals({
      properties: [{ tier: 'PARTNER' as const, distanceKm: 0.3 }],
    });
    const s = scoreGap(g);
    expect(s.score).toBe(288);
  });

  it('same demand but 2 fresh verified places exist → below floor (no mission)', () => {
    const g = baseSignals({
      properties: [{ tier: 'PARTNER' as const, distanceKm: 0.3 }],
      verifiedPlaces: [{ ageDays: 0 }, { ageDays: 0 }],
    });
    const s = scoreGap(g);
    expect(s.score).toBe(32);
    expect(s.score).toBeLessThan(45); // coverage kills the mission, as intended
  });

  it('same but those 2 places are 150 days stale → refresh mission territory', () => {
    const g = baseSignals({
      properties: [{ tier: 'PARTNER' as const, distanceKm: 0.3 }],
      verifiedPlaces: [{ ageDays: 150 }, { ageDays: 150 }],
    });
    const s = scoreGap(g);
    expect(s.score).toBe(162);
    expect(s.score).toBeGreaterThanOrEqual(45);
  });

  it('one loud tourist asking 20 times → gated on s >= 2', () => {
    const g = baseSignals({ questionCount: 20, distinctSessions: 1 });
    expect(HARD_GATES(g)).toBe(false);
  });

  it('real demand but no spotter can reach it → 0 (F = 0)', () => {
    const g = baseSignals({
      questionCount: 9,
      distinctSessions: 7,
      spotterCapacityInZone: 0,
    });
    const s = scoreGap(g);
    expect(s.score).toBe(0);
    expect(s.breakdown.F).toBe(0);
  });
});

describe('scoreGap — components', () => {
  it('a gap in a cell with a paying property outscores an identical gap with none', () => {
    const withProp = scoreGap(
      baseSignals({ properties: [{ tier: 'PARTNER_PREMIUM' as const, distanceKm: 0.2 }] }),
    );
    const without = scoreGap(baseSignals());
    expect(withProp.score).toBeGreaterThan(without.score);
  });

  it('recency decay behaves at 0/7/14 days (5-day half-life)', () => {
    const d0 = scoreGap(baseSignals({ askAgeDays: [0] })).breakdown.Rmult;
    const d7 = scoreGap(baseSignals({ askAgeDays: [7] })).breakdown.Rmult;
    const d14 = scoreGap(baseSignals({ askAgeDays: [14] })).breakdown.Rmult;
    // 0.5^(0/5)=1, 0.5^(7/5)≈0.38, 0.5^(14/5)≈0.14 → monotone decay.
    expect(d0).toBeGreaterThan(d7);
    expect(d7).toBeGreaterThan(d14);
    expect(d14).toBeGreaterThan(0.3);
  });

  it('access penalty scales walkable → transport → boat/4x4', () => {
    const walk = scoreGap(baseSignals({ accessDifficulty: 0 })).breakdown.F;
    const transport = scoreGap(baseSignals({ accessDifficulty: 1 })).breakdown.F;
    const boat = scoreGap(baseSignals({ accessDifficulty: 2 })).breakdown.F;
    expect(walk).toBe(1.0 * ACCESS_PENALTY[0]);
    expect(transport).toBeCloseTo(0.85, 4);
    expect(boat).toBeCloseTo(0.6, 4);
  });

  it('breadth weights multi-asker demand over spam', () => {
    const spam = scoreGap(baseSignals({ questionCount: 40, distinctSessions: 1 })).breakdown.D;
    const market = scoreGap(baseSignals({ questionCount: 12, distinctSessions: 12 })).breakdown.D;
    expect(market).toBeGreaterThan(spam);
  });
});
