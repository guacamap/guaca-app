import { describe, expect, it } from 'vitest';
import { draftCandidate, type CandidateDraft } from '../../src/steward/draft.ts';
import type { Inference, JsonResult, JsonRequest } from '../../src/inference/types.ts';

const CANDIDATE = {
  id: '00000000-0000-4000-8000-0000000000d1',
  name: 'Restaurante El Sabor',
  category: 'eat_drink',
  landmarkDescription: 'Punto en OpenStreetMap',
  tags: ['restaurant', 'arepa', 'bolivar'],
};

const GOOD_DRAFT: CandidateDraft = {
  category: 'eat_drink',
  landmarkHint: 'Calle Bolívar, puerta azul, frente al parque',
  whyLikely: 'OSM lists amenity=restaurant with arepa signage nearby',
  photoChecklist: ['fachada', 'letrero', 'plato principal'],
  suggestedTags: ['arepas', 'casual'],
};

function provider(raw: unknown, model = 'fake'): Inference {
  return {
    async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
      const parsed = req.schema.safeParse(raw);
      if (!parsed.success) throw new Error('schema mismatch: ' + parsed.error.message);
      return { raw: parsed.data, usage: { tokensIn: 10, tokensOut: 10 }, model };
    },
    async vision<T>(): Promise<JsonResult<T>> {
      throw new Error('not used');
    },
  };
}

describe('draftCandidate — the AI steward', () => {
  it('a clean structured draft passes the strict schema', async () => {
    const out = await draftCandidate(provider(GOOD_DRAFT), CANDIDATE);
    expect(out.kind).toBe('draft');
    if (out.kind === 'draft') expect(out.draft.category).toBe('eat_drink');
  });

  it('a model that cannot comply is a skip, not a crash — batches survive', async () => {
    const broken = provider({ category: 'not_a_category', landmarkHint: 'x' });
    const out = await draftCandidate(broken, CANDIDATE);
    expect(out.kind).toBe('skipped');
  });

  it('a provider that throws is a skip too', async () => {
    const throwing: Inference = {
      async json(): Promise<never> {
        throw new Error('down');
      },
      async vision(): Promise<never> {
        throw new Error('down');
      },
    };
    expect((await draftCandidate(throwing, CANDIDATE)).kind).toBe('skipped');
  });
});
