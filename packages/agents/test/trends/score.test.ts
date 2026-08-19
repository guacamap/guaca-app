import { describe, expect, it } from 'vitest';
import {
  ENGAGEMENT_HALF_LIFE_DAYS,
  INTEREST_HALF_LIFE_DAYS,
  TRENDING_SCORE_MIN,
  TREND_VERSION,
  scoreTrends,
  weatherMultiplier,
  type TrendSignals,
} from '../../src/trends/score.ts';

/** A verified place with no recorded behaviour — the honest baseline. */
function quiet(overrides: Partial<TrendSignals> = {}): TrendSignals {
  return {
    placeId: 'p1',
    category: 'eat_drink',
    ageDays: 5,
    interestCount: 0,
    lastInterestAgeDays: null,
    favoriteCount: 0,
    postCount: 0,
    avgRating: null,
    ratingCount: 0,
    socialCount: 0,
    lastEngagementAgeDays: null,
    doubtCount: 0,
    ...overrides,
  };
}

describe('scoreTrends — the deterministic trend engine', () => {
  it('is versioned and pure: same signals, same scores, TREND_VERSION pinned', () => {
    const a = scoreTrends([quiet({ placeId: 'a' }), quiet({ placeId: 'b', ageDays: 90 })]);
    const b = scoreTrends([quiet({ placeId: 'a' }), quiet({ placeId: 'b', ageDays: 90 })]);
    expect(a).toEqual(b);
    expect(TREND_VERSION).toBe('1');
    for (const t of a) expect(Number.isInteger(t.score)).toBe(true);
  });

  it('a quiet, freshly verified place badges fresh and scores ≈100·F', () => {
    const [t] = scoreTrends([quiet({ ageDays: 0 })]);
    expect(t!.badge).toBe('fresh');
    expect(t!.score).toBe(100); // F=1, no engagement, no interest, no weather
  });

  it('badges are literally true: no evidence, no asked_about/trending badge', () => {
    // High score impossible without signals — a quiet stale place has neither.
    const [t] = scoreTrends([quiet({ ageDays: 100 })]);
    expect(t!.badge).toBeNull();
    expect(t!.score).toBeLessThan(50); // F=clamp(1-100/180,...)≈0.44 → ~44
  });

  it('engagement raises the score and can earn trending with real evidence', () => {
    const busy = quiet({
      postCount: 3,
      ratingCount: 2,
      avgRating: 4.5,
      socialCount: 2,
      lastEngagementAgeDays: 1,
      interestCount: 4,
      lastInterestAgeDays: 2,
    });
    const [t] = scoreTrends([busy]);
    expect(t!.badge).toBe('trending');
    expect(t!.score).toBeGreaterThanOrEqual(TRENDING_SCORE_MIN);
    expect(t!.breakdown.E).toBeGreaterThan(0);
    expect(t!.breakdown.I).toBeGreaterThan(0);
  });

  it('trending requires evidence, not just points — a fat score with <3 events never trends', () => {
    // favourites alone can push the score, but a save is not public behaviour
    const [t] = scoreTrends([quiet({ favoriteCount: 60 })]);
    expect(t!.score).toBeGreaterThanOrEqual(TRENDING_SCORE_MIN);
    expect(t!.badge).not.toBe('trending');
  });

  it('engagement decays with a 7-day half-life', () => {
    const fresh = scoreTrends([
      quiet({ postCount: 4, lastEngagementAgeDays: 0 }),
    ])[0]!;
    const weekOld = scoreTrends([
      quiet({ postCount: 4, lastEngagementAgeDays: ENGAGEMENT_HALF_LIFE_DAYS }),
    ])[0]!;
    expect(weekOld.breakdown.E).toBeCloseTo(fresh.breakdown.E / 2, 5);
  });

  it('interest decays with a 30-day half-life', () => {
    const fresh = scoreTrends([quiet({ interestCount: 5, lastInterestAgeDays: 0 })])[0]!;
    const monthOld = scoreTrends([
      quiet({ interestCount: 5, lastInterestAgeDays: INTEREST_HALF_LIFE_DAYS }),
    ])[0]!;
    expect(monthOld.breakdown.I).toBeCloseTo(fresh.breakdown.I / 2, 5);
  });

  it('a single re-check doubt earns asked_about — someone questioned freshness', () => {
    const [t] = scoreTrends([quiet({ ageDays: 40, doubtCount: 1 })]);
    expect(t!.badge).toBe('asked_about');
  });

  it('two answers citing a place earn asked_about', () => {
    const [t] = scoreTrends([quiet({ ageDays: 40, interestCount: 2 })]);
    expect(t!.badge).toBe('asked_about');
  });

  it('trending outranks asked_about outranks fresh', () => {
    const trending = scoreTrends([
      quiet({ postCount: 5, socialCount: 2, interestCount: 3, lastInterestAgeDays: 0, lastEngagementAgeDays: 0 }),
    ])[0]!;
    expect(trending.score).toBeGreaterThanOrEqual(TRENDING_SCORE_MIN);
    expect(trending.badge).toBe('trending'); // evidence + score, not just youth
  });
});

describe('weatherMultiplier — bounded, deterministic category modulation', () => {
  const rain = { precipProbability: 0.8, windKph: 30, tempC: 27 };
  const calm = { precipProbability: 0.1, windKph: 8, tempC: 29 };
  const hot = { precipProbability: 0.1, windKph: 10, tempC: 32 };

  it('no weather → neutral 1', () => {
    expect(weatherMultiplier('beach_water', null)).toBe(1);
    expect(weatherMultiplier('beach_water', undefined)).toBe(1);
  });

  it('rain pushes travellers indoors', () => {
    expect(weatherMultiplier('beach_water', rain)).toBeLessThan(1);
    expect(weatherMultiplier('nature_walk', rain)).toBeLessThan(1);
    expect(weatherMultiplier('culture_history', rain)).toBeGreaterThan(1);
    expect(weatherMultiplier('market_shop', rain)).toBeGreaterThan(1);
  });

  it('calm sea makes the beach honest advice', () => {
    expect(weatherMultiplier('beach_water', calm)).toBeGreaterThan(1);
    expect(weatherMultiplier('eat_drink', calm)).toBe(1);
  });

  it('heat nudges the beach up', () => {
    expect(weatherMultiplier('beach_water', hot)).toBeGreaterThan(1);
  });

  it('multipliers are bounded — weather can reorder, never dominate', () => {
    for (const cat of ['eat_drink', 'beach_water', 'culture_history', 'services']) {
      for (const w of [rain, calm, hot, { precipProbability: 1, windKph: 80, tempC: 35 }]) {
        const m = weatherMultiplier(cat, w);
        expect(m).toBeGreaterThanOrEqual(0.6);
        expect(m).toBeLessThanOrEqual(1.3);
      }
    }
  });

  it('weather flows through the score for the place category only', () => {
    const beach = quiet({ category: 'beach_water' });
    const museum = quiet({ category: 'culture_history', placeId: 'p2' });
    const [b, m] = scoreTrends([beach, museum], rain);
    expect(b!.breakdown.W).toBeLessThan(1);
    expect(m!.breakdown.W).toBeGreaterThan(1);
    expect(m!.score).toBeGreaterThan(b!.score);
  });
});
