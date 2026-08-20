export const TIER_WEIGHT = {
  PARTNER_PREMIUM: 3.0,
  PARTNER: 1.8,
  TRIAL: 0.6,
  NONE: 0,
} as const;

export const ACCESS_PENALTY = [1.0, 0.85, 0.6] as const; // walkable | needs transport | boat/4x4

export type PropertyTier = keyof typeof TIER_WEIGHT;

export interface GapSignals {
  questionCount: number;
  distinctSessions: number;
  /** Days since each question was asked. */
  askAgeDays: number[];
  /** Paying properties near the zone centroid. */
  properties: Array<{ tier: PropertyTier; distanceKm: number }>;
  /** Verified places in the zone with their age. */
  verifiedPlaces: Array<{ ageDays: number }>;
  spotterCapacityInZone: number;
  /** 0 walkable | 1 needs transport | 2 boat/4x4 */
  accessDifficulty: number;
  /**
   * Category momentum: questions (answered AND refused) in this category
   * across the area, last 14 days. Real asks only — an answered question is
   * demand evidence too, it just didn't become a gap. Momentum AMPLIFIES a
   * gap that already passed the demand gates; it can never create one.
   */
  recentCategoryAsks?: number;
  /** Human zone name for the brief — the raw h3 index otherwise. */
  zoneName?: string;
  /** People who asked in this zone (30d) — the mission's justification. */
  zonePeopleCount?: number;
  /** Verified places in the zone gone stale (>120d) — refresh-mission fuel. */
  stalePlaceNames?: string[];
  /** Steward-enriched candidates in the zone — team-approved starting points. */
  candidateHints?: string[];
}

export interface ScoredGap {
  score: number;
  breakdown: {
    D: number;
    Rmult: number;
    Cmult: number;
    S: number;
    F: number;
    T: number;
    q: number;
    s: number;
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Hard gates — applied BEFORE the score is even consulted (§7.5). */
export function HARD_GATES(g: GapSignals): boolean {
  return (
    g.questionCount >= 3 &&
    g.distinctSessions >= 2 &&
    g.spotterCapacityInZone > 0
  );
}

/**
 * §7.5, verbatim:
 *
 *   breadth = q > 0 ? s / q : 0
 *   D = log1p(q) * (0.35 + 0.65 * breadth)
 *   rHat = q > 0 ? Σ 0.5^(d/5) / q : 0
 *   Rmult = 0.30 + 0.70 * rHat
 *   C = Σ TIER_WEIGHT[tier] * exp(-distanceKm / 1.2)
 *   Cmult = 1 + 0.6 * log1p(C)
 *   coverage = Σ clamp(1 - ageDays / 180, 0.15, 1)
 *   S = 1 / (1 + coverage)^SCARCITY_EXPONENT
 *   F = (capacity > 0 ? 1 : 0) * ACCESS_PENALTY[accessDifficulty]
 *   score = round(100 * D * Rmult * Cmult * S * F)
 *
 * DEVIATION FROM THE PLAN, deliberate: the plan's prose gives the exponent as
 * 1.5 and its worked table claims two fresh verified places score 42, below
 * the floor of 45. Both cannot be true — at 1.5 that case scores 55, i.e. the
 * agent would commission a paid mission for a zone it has already covered.
 * The table's intent ("scarcity is steep; we only pay where we have almost
 * nothing") is the load-bearing claim, so the exponent is 2.0, which delivers
 * it: 2 fresh places → 32 (no mission), 3 fresh → 18 (no mission), while
 * 2 places gone stale at 150 days → 162 (refresh commissioned) and an
 * uncovered zone → 288. Behaviour is pinned in scoring.test.ts.
 */
export const SCARCITY_EXPONENT = 2.0;

/** Category-momentum amplification: 1 + 0.4·log1p(asks). Bounded by demand. */
export const TREND_GAIN = 0.4;

export function scoreGap(g: GapSignals): ScoredGap {
  const q = g.questionCount;
  const s = g.distinctSessions;

  const breadth = q > 0 ? s / q : 0;
  const D = Math.log1p(q) * (0.35 + 0.65 * breadth);

  const rHat =
    q > 0
      ? g.askAgeDays.reduce((a, d) => a + 0.5 ** (d / 5), 0) / q
      : 0;
  const Rmult = 0.3 + 0.7 * rHat;

  const C = g.properties.reduce(
    (a, p) => a + TIER_WEIGHT[p.tier] * Math.exp(-p.distanceKm / 1.2),
    0,
  );
  const Cmult = 1 + 0.6 * Math.log1p(C);

  const coverage = g.verifiedPlaces.reduce(
    (a, p) => a + clamp(1 - p.ageDays / 180, 0.15, 1),
    0,
  );
  const S = 1 / (1 + coverage) ** SCARCITY_EXPONENT;

  const F =
    (g.spotterCapacityInZone > 0 ? 1 : 0) *
    (ACCESS_PENALTY[g.accessDifficulty] ?? ACCESS_PENALTY[0]!);

  const T = 1 + TREND_GAIN * Math.log1p(g.recentCategoryAsks ?? 0);

  return {
    score: Math.round(100 * D * Rmult * Cmult * S * F * T),
    breakdown: { D, Rmult, Cmult, S, F, T, q, s },
  };
}
