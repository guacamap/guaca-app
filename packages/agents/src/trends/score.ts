/**
 * The trend engine — a deterministic scoring module, deliberately NOT an
 * agent. Same contract as `gap/scoring.ts`: a pure function over recorded
 * signals, zero inference, versioned so stored scores stay interpretable.
 *
 * Product rules it protects:
 * - trends only RANK verified places; they can never introduce one (the
 *   planner's catalog and the guard are untouched by ordering)
 * - raw counts are never shown to tourists — badges only, and every badge is
 *   a literally-true statement about recorded behaviour
 * - favourites are a private save-list: they feed the score, never a counter
 *   on a public surface
 */

export const TREND_VERSION = '1';

export const ENGAGEMENT_HALF_LIFE_DAYS = 7;
export const INTEREST_HALF_LIFE_DAYS = 30;

/** Minimum score for the "trending" badge — plus real evidence, see below. */
export const TRENDING_SCORE_MIN = 180;

export interface TrendSignals {
  placeId: string;
  category: string;
  /** Days since the place was last verified. */
  ageDays: number;
  /** Questions whose answer cited this place, last 30 days. */
  interestCount: number;
  /** Age in days of the most recent citing question — null when none. */
  lastInterestAgeDays: number | null;
  favoriteCount: number;
  postCount: number;
  avgRating: number | null;
  ratingCount: number;
  socialCount: number;
  /** Age in days of the newest post/rating/social link — null when none. */
  lastEngagementAgeDays: number | null;
  doubtCount: number;
}

/** Area-level forecast summary — the category-relevant slice of a provider. */
export interface WeatherState {
  /** 0..1 chance of rain over the next three days. */
  precipProbability: number;
  /** Max wind km/h — the honest sea-state proxy we can actually source. */
  windKph: number;
  tempC: number;
}

export type TrendBadge = 'trending' | 'asked_about' | 'fresh';

export interface ScoredTrend {
  placeId: string;
  score: number;
  badge: TrendBadge | null;
  breakdown: {
    /** Engagement — posts, presence-verified ratings, social links (7d hl). */
    E: number;
    /** Interest — answer citations, favourites, re-check doubts (30d hl). */
    I: number;
    /** Verification freshness — 180-day decay, 0.15 floor (as gap scoring). */
    F: number;
    /** Weather modulation for this place's category, bounded [0.6, 1.3]. */
    W: number;
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function recency(lastAgeDays: number | null, halfLifeDays: number): number {
  // No recorded activity → no recency penalty; the counts are zero anyway.
  if (lastAgeDays === null) return 1;
  return 0.5 ** (lastAgeDays / halfLifeDays);
}

/**
 * Weather × category multipliers — a deterministic table, not a model call.
 * Rain moves recommendations indoors; calm wind makes the beach honest
 * advice. Bounded so weather can reorder, never dominate.
 */
export function weatherMultiplier(
  category: string,
  w: WeatherState | null | undefined,
): number {
  if (!w) return 1;
  const rainy = w.precipProbability >= 0.5;
  const calmSea = w.windKph < 15;
  const hot = w.tempC >= 31;
  let m = 1;
  if (rainy) {
    if (category === 'beach_water') m *= 0.65;
    else if (category === 'nature_walk') m *= 0.8;
    else if (category === 'culture_history' || category === 'market_shop') m *= 1.15;
    else if (category === 'services') m *= 1.1;
  } else if (calmSea) {
    if (category === 'beach_water') m *= 1.15;
    else if (category === 'nature_walk') m *= 1.05;
  }
  if (hot && category === 'beach_water') m *= 1.05;
  return Math.min(1.3, Math.max(0.6, m));
}

/**
 * Every badge is a claim. Keep each one literally true:
 * - trending: high score AND ≥3 recorded engagement/interest events — never
 *   a badge on inference alone, and never on a stale place
 * - asked_about: a real question cited this place twice, or a traveller
 *   doubted its freshness
 * - fresh: verified within the last three weeks
 */
function badgeFor(s: TrendSignals, score: number): TrendBadge | null {
  const evidence =
    s.postCount + s.socialCount + s.interestCount + s.doubtCount + s.ratingCount;
  if (score >= TRENDING_SCORE_MIN && evidence >= 3) return 'trending';
  if (s.doubtCount >= 1 || s.interestCount >= 2) return 'asked_about';
  if (s.ageDays <= 21) return 'fresh';
  return null;
}

export function scoreTrends(
  signals: TrendSignals[],
  weather?: WeatherState | null,
): ScoredTrend[] {
  return signals.map((s) => {
    // 3★→1.12, 5★→1.30, unrated→1: ratings refine, they cannot carry a place.
    const ratingQuality = s.avgRating === null ? 1 : 0.85 + 0.09 * s.avgRating;
    const E =
      Math.log1p(s.postCount + 0.5 * s.ratingCount + 1.5 * s.socialCount) *
      ratingQuality *
      recency(s.lastEngagementAgeDays, ENGAGEMENT_HALF_LIFE_DAYS);
    const I =
      Math.log1p(s.interestCount + 0.75 * s.favoriteCount + 1.25 * s.doubtCount) *
      recency(s.lastInterestAgeDays, INTEREST_HALF_LIFE_DAYS);
    const F = clamp(1 - s.ageDays / 180, 0.15, 1);
    const W = weatherMultiplier(s.category, weather ?? null);
    const score = Math.round(100 * F * W * (1 + 0.35 * E + 0.45 * I));
    return { placeId: s.placeId, score, badge: badgeFor(s, score), breakdown: { E, I, F, W } };
  });
}
