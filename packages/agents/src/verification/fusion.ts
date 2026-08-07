/** Rung L5 vision verdict — the ONE structured output of the multimodal call. */
export interface VisionVerdict {
  showsRealPlace: boolean;
  categoryMatch: boolean;
  isFranchise: boolean;
  isScreenshot: boolean;
  /** Stock-like imagery (e.g. a downloaded photo of the beach). */
  isStockLike: boolean;
  confidence: number; // 0..1
  reasons: string[];
}

export interface FusionInput {
  gpsScore: number; // 0..1 from rung L2
  freshnessScore: number; // 0..1 from rung L1
  originalityScore: number; // 0..1 from rung L3 (no-reuse)
  vision: VisionVerdict;
  spotterConsecutiveAccepted: number;
  geoInconclusive: boolean;
}

export type Verdict =
  | 'ACCEPT_PENDING_SECOND'
  | 'ESCALATE'
  | 'REJECT';

export interface SubmissionDecision {
  verdict: Verdict;
  effective: number;
  reasons: string[];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * §7.4, verbatim. Fusion is deterministic — no model involved in the
 * decision:
 *
 *   visionScore = isScreenshot || isStockLike ? 0
 *     : 0.55*typeMatchesClaim + 0.30*sceneConsistency + 0.15*confidence
 *   trust = 0.30*gpsScore + 0.20*freshnessScore + 0.15*originalityScore + 0.35*visionScore
 *   effective = clamp(trust + min(0.10, 0.02*spotter.consecutiveAccepted), 0, 1)
 *
 * The plan's vision fields map onto the formula as: typeMatchesClaim ≈
 * categoryMatch, sceneConsistency ≈ showsRealPlace.
 */
export function fuseTrust(input: FusionInput): number {
  const v = input.vision;
  const visionScore =
    v.isScreenshot || v.isStockLike
      ? 0
      : 0.55 * (v.categoryMatch ? 1 : 0) +
        0.3 * (v.showsRealPlace ? 1 : 0) +
        0.15 * v.confidence;
  const trust =
    0.3 * input.gpsScore +
    0.2 * input.freshnessScore +
    0.15 * input.originalityScore +
    0.35 * visionScore;
  return clamp(trust + Math.min(0.1, 0.02 * input.spotterConsecutiveAccepted), 0, 1);
}

/**
 * §7.4 verdict table. Any hard fail short-circuits before L5 (the graph
 * guarantees that); this function decides what happens after the vision call.
 */
export function decideSubmission(input: FusionInput): SubmissionDecision {
  const v = input.vision;
  if (v.isFranchise) {
    return {
      verdict: 'REJECT',
      effective: 0,
      reasons: ['FRANCHISE'],
    };
  }
  const effective = fuseTrust(input);

  if (v.isScreenshot || v.isStockLike) {
    return { verdict: 'REJECT', effective, reasons: ['SCREENSHOT_OR_STOCK'] };
  }
  if (input.geoInconclusive && v.confidence < 0.6) {
    return {
      verdict: 'ESCALATE',
      effective,
      reasons: ['GEO_INCONCLUSIVE_LOW_CONFIDENCE'],
    };
  }
  if (effective >= 0.8) {
    return { verdict: 'ACCEPT_PENDING_SECOND', effective, reasons: ['TRUST_ABOVE_FLOOR'] };
  }
  if (effective >= 0.55) {
    return { verdict: 'ESCALATE', effective, reasons: ['TRUST_MID_BAND'] };
  }
  return {
    verdict: 'REJECT',
    effective,
    reasons: ['TRUST_BELOW_FLOOR', ...(v.confidence < 0.5 ? ['LOW_CONFIDENCE'] : [])],
  };
}
