import { z } from 'zod';
import { PlaceCategory } from '@guaca/shared';
import type { Inference } from '../inference/types.js';

/**
 * The AI steward — the "AI person" that drafts candidate enrichment for
 * the team to confirm. Deliberately NOT a fourth agent: it is a tool an
 * operator runs (`POST /api/operator/steward/enrich`); it has no loop, no
 * scheduler, and no write path of its own. Every draft lands in a review
 * queue a human drains, and an approved draft only ever enriches a
 * CANDIDATE — tourist visibility still requires a Spotter's physical
 * verification under the two-witness rule.
 *
 * What the model may output is exactly this schema: a category from the
 * fixed taxonomy, a landmark hint in the spotter's language, its reasoning
 * for the team, a photo checklist, and suggested tags. It cannot name a
 * new place — it can only characterize one OpenStreetMap already recorded.
 */
export const CandidateDraftSchema = z
  .object({
    category: PlaceCategory,
    /** How a local would point another local to it (es — spotters work in Spanish). */
    landmarkHint: z.string().min(5).max(200),
    /** Why the model believes this characterization — TEAM EYES ONLY. */
    whyLikely: z.string().min(5).max(300),
    /** What a Spotter should photograph there. */
    photoChecklist: z.array(z.string().min(2).max(80)).min(2).max(5),
    suggestedTags: z.array(z.string().min(2).max(30)).max(6),
  })
  .strict();

export type CandidateDraft = z.infer<typeof CandidateDraftSchema>;

export interface CandidateInput {
  id: string;
  name: string;
  category: string;
  landmarkDescription: string | null;
  tags: string[];
}

export type DraftOutcome =
  | { kind: 'draft'; draft: CandidateDraft }
  | { kind: 'skipped' };

/** Format the OSM tags for the prompt without leaking noise. */
function tagSummary(tags: string[]): string {
  const shown = tags.filter((t) => t.length > 1).slice(0, 12);
  return shown.length > 0 ? shown.join(', ') : '(no tags)';
}

export async function draftCandidate(
  inference: Inference,
  candidate: CandidateInput,
): Promise<DraftOutcome> {
  try {
    const res = await inference.json<CandidateDraft>({
      schema: CandidateDraftSchema,
      purpose: 'steward.draft',
      maxOutputTokens: 220,
      system:
        'You enrich OpenStreetMap candidates for a Caribbean mapping product. ' +
        'For the given candidate, choose the best category from the fixed taxonomy, ' +
        'write a landmark hint in SPANISH the way a local would give directions, ' +
        'explain briefly in English why (the team reads this, tourists never do), ' +
        'list what a local Spotter should photograph, and suggest lowercase tags. ' +
        'You may only characterize the candidate given — never invent places.',
      user: `Candidate: ${candidate.name}\nImporter category: ${candidate.category}\n` +
        `Existing landmark note: ${candidate.landmarkDescription ?? '(none)'}\n` +
        `OSM tags: ${tagSummary(candidate.tags)}`,
      untrusted: candidate.name,
    });
    return { kind: 'draft', draft: res.raw };
  } catch {
    // One candidate the model cannot place honestly is not an error worth
    // failing a batch over — it simply stays for the next run or a human.
    return { kind: 'skipped' };
  }
}
