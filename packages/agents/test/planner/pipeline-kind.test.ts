import { describe, expect, it } from 'vitest';
import { answerFromCatalog, matchesKind } from '../../src/planner/pipeline.js';
import type { Inference, JsonRequest, JsonResult } from '../../src/inference/types.js';

/** The classifier says "services"; nothing else is ever asked. */
class Classifies implements Inference {
  async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
    if (req.purpose === 'intent.classify') return { raw: { category: 'services' } as T, usage: { tokensIn: 1, tokensOut: 1 }, model: 'x' };
    throw new Error(`unexpected ${req.purpose}`);
  }
  async vision<T>(): Promise<JsonResult<T>> { throw new Error('unused'); }
}

const place = (id: string, name: string, category: string, subcategory: string | null) => ({
  id, name, category, lat: 10.47, lon: -68.0, verificationStatus: 'candidate', witnessCount: 0, tier: 'corroborated' as const, corroboration: 2, subcategory,
});

describe('a named kind narrows the catalog', () => {
  it('matches on name or listed kind, accents aside', () => {
    expect(matchesKind('tattoo studio', 'Ink Tattoo Studio', null)).toBe(true);
    expect(matchesKind('tattoo studio', 'Arte Corporal', 'Tattoo parlor')).toBe(true);
    expect(matchesKind('tattoo studio', 'BBVA Banco Provincial', 'Bank')).toBe(false);
    expect(matchesKind('farmacia', 'Farmacias Unidas', 'Pharmacy')).toBe(true);
  });
  it('refuses rather than answer a tattoo ask with a bank', async () => {
    const out = await answerFromCatalog({
      text: 'where can I find a tattoo studio open tonight?', language: 'en', lat: 10.47, lon: -68.0,
      places: [place('a', 'BBVA Banco Provincial', 'services', 'Bank'), place('b', 'Cruz Roja', 'services', 'Red cross')],
      inference: new Classifies(), minCandidates: 1, nowMin: 20 * 60, kind: 'tattoo studio',
    });
    expect(out).toMatchObject({ kind: 'refusal', reason: 'INSUFFICIENT_COVERAGE' });
  });
  it('answers when a place of that kind exists', async () => {
    const out = await answerFromCatalog({
      text: 'where can I find a tattoo studio open tonight?', language: 'en', lat: 10.47, lon: -68.0,
      places: [place('a', 'BBVA Banco Provincial', 'services', 'Bank'), place('b', 'Ink Tattoo Studio', 'services', 'Tattoo parlor')],
      inference: new Classifies(), minCandidates: 1, nowMin: 20 * 60, kind: 'tattoo studio',
    });
    expect(out).toMatchObject({ kind: 'answer', placeIds: ['b'] });
  });
});
