import { describe, expect, it } from 'vitest';
import {
  type VisionVerdict,
  type FusionInput,
  fuseTrust,
  decideSubmission,
  type Verdict,
} from '../../src/verification/fusion.ts';

const goodVision: VisionVerdict = {
  showsRealPlace: true,
  categoryMatch: true,
  isFranchise: false,
  isScreenshot: false,
  isStockLike: false,
  confidence: 0.9,
  reasons: ['signage_matches'],
};

const baseInput: FusionInput = {
  gpsScore: 1,
  freshnessScore: 1,
  originalityScore: 1,
  vision: goodVision,
  spotterConsecutiveAccepted: 0,
  geoInconclusive: false,
};

describe('fuseTrust (§7.4 formula, verbatim)', () => {
  it('computes the weighted trust score', () => {
    const t = fuseTrust(baseInput);
    // 0.30*1 + 0.20*1 + 0.15*1 + 0.35*(0.55*1+0.30*1+0.15*0.9) = 0.65 + 0.35*0.985
    expect(t).toBeCloseTo(0.99475, 4);
  });

  it('applies the spotter reputation bonus (capped at +0.10)', () => {
    // Use a mid-band input so the clamp does not hide the bonus.
    const mid: FusionInput = {
      gpsScore: 0.5,
      freshnessScore: 0.5,
      originalityScore: 0.5,
      vision: { ...goodVision, confidence: 0.5 },
      spotterConsecutiveAccepted: 0,
      geoInconclusive: false,
    };
    const t0 = fuseTrust(mid);
    const t5 = fuseTrust({ ...mid, spotterConsecutiveAccepted: 5 });
    expect(t5 - t0).toBeCloseTo(0.1, 4); // 0.02*5 = 0.10
    const t20 = fuseTrust({ ...mid, spotterConsecutiveAccepted: 20 });
    expect(t20 - t0).toBeCloseTo(0.1, 4); // capped at 0.10
  });

  it('is deterministic — same inputs, same score', () => {
    expect(fuseTrust(baseInput)).toBe(fuseTrust(baseInput));
  });
});

describe('decideSubmission (§7.4 verdict table)', () => {
  it('franchise verdict → auto-REJECT (editorial rule), even with high confidence', () => {
    const d = decideSubmission({
      ...baseInput,
      vision: { ...goodVision, isFranchise: true, confidence: 0.99 },
    });
    expect(d.verdict).toBe('REJECT');
    expect(d.reasons).toContain('FRANCHISE');
  });

  it('a screenshot is treated as zero vision score → REJECT', () => {
    const d = decideSubmission({
      ...baseInput,
      vision: { ...goodVision, isScreenshot: true },
    });
    expect(d.verdict).toBe('REJECT');
  });

  it('effective ≥ 0.80 → ACCEPT_PENDING_SECOND', () => {
    const d = decideSubmission(baseInput);
    expect(d.verdict).toBe('ACCEPT_PENDING_SECOND');
  });

  it('0.55 ≤ effective < 0.80 → ESCALATE (needs_operator)', () => {
    // Moderate signals: trust lands in the mid band.
    const d = decideSubmission({
      gpsScore: 0.6,
      freshnessScore: 0.6,
      originalityScore: 0.6,
      vision: { ...goodVision, showsRealPlace: false, confidence: 0.6 },
      spotterConsecutiveAccepted: 0,
      geoInconclusive: false,
    });
    // visionScore = 0.55*1 + 0.30*0 + 0.15*0.6 = 0.64
    // trust = 0.3*0.6 + 0.2*0.6 + 0.15*0.6 + 0.35*0.64 = 0.614
    expect(d.verdict).toBe('ESCALATE');
  });

  it('effective < 0.55 → REJECT with structured feedback', () => {
    const d = decideSubmission({
      ...baseInput,
      gpsScore: 0.3,
      freshnessScore: 0.4,
      originalityScore: 0.3,
      vision: { ...goodVision, confidence: 0.3 },
    });
    expect(d.verdict).toBe('REJECT');
    expect(d.reasons.length).toBeGreaterThan(0);
  });

  it('geo INCONCLUSIVE and vision confidence < 0.6 → ESCALATE — never guess', () => {
    const d = decideSubmission({
      ...baseInput,
      geoInconclusive: true,
      vision: { ...goodVision, confidence: 0.5 },
    });
    expect(d.verdict).toBe('ESCALATE');
  });
});
