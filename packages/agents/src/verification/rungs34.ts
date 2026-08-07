import { hammingDistance } from './phash.js';

export type RungVerdict = 'PASS' | 'WEAK' | 'HARD';

export interface PhotoReuseResult {
  verdict: RungVerdict;
  reason?: 'PHOTO_REUSE';
  minDistance: number;
}

/**
 * Rung L3 — pHash vs the spotter's history, all photos in the zone, and a
 * known-web seed set. Hamming ≤6 → hard PHOTO_REUSE; 7–12 WEAK; >12 PASS.
 */
export function checkPhotoReuse(
  phash: string,
  history: readonly string[],
  _seedSetSize: number,
): PhotoReuseResult {
  let minDistance = 64;
  for (const h of history) {
    minDistance = Math.min(minDistance, hammingDistance(phash, h));
  }
  if (minDistance <= 6) {
    return { verdict: 'HARD', reason: 'PHOTO_REUSE', minDistance };
  }
  if (minDistance <= 12) return { verdict: 'WEAK', minDistance };
  return { verdict: 'PASS', minDistance };
}

export interface DiversityResult {
  verdict: RungVerdict;
  reason?: 'NO_DIVERSITY';
  minPairwise: number;
}

/**
 * Rung L4 — intra-submission diversity: three shots of the same wall is not
 * verification. Min pairwise Hamming <10 → hard NO_DIVERSITY.
 */
export function checkIntraDiversity(phashes: readonly string[]): DiversityResult {
  let minPairwise = 64;
  for (let i = 0; i < phashes.length; i++) {
    for (let j = i + 1; j < phashes.length; j++) {
      minPairwise = Math.min(
        minPairwise,
        hammingDistance(phashes[i]!, phashes[j]!),
      );
    }
  }
  if (minPairwise < 10) {
    return { verdict: 'HARD', reason: 'NO_DIVERSITY', minPairwise };
  }
  return { verdict: 'PASS', minPairwise };
}

/** Diacritic-folded token similarity for near-duplicate place names. */
export function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1);
  const ta = norm(a);
  const tb = norm(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setA = new Set(ta);
  let hits = 0;
  for (const w of tb) if (setA.has(w)) hits++;
  return hits / Math.max(ta.length, tb.length);
}
