import { PlaceCategory } from '@guaca/shared';

export interface SubmissionInput {
  name: string;
  category: string;
  landmarkDescription: string;
  priceBand?: number;
  openHours?: Record<string, string>;
}

export type SubmissionGate = { ok: true } | { ok: false; reason: string };

/**
 * T7.4 — the place submission form contract. Landmark-first, not
 * address-first: the landmark description is REQUIRED. A submitted place
 * lands `provisional` and runs the verification ladder — never verified by
 * the submitter alone.
 */
export function validateSubmission(input: SubmissionInput): SubmissionGate {
  if (!input.name.trim()) return { ok: false, reason: 'name is required' };
  if (!PlaceCategory.safeParse(input.category).success) {
    return { ok: false, reason: 'category is required' };
  }
  if (!input.landmarkDescription.trim()) {
    return { ok: false, reason: 'landmark description is required' };
  }
  return { ok: true };
}
