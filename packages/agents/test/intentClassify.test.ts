import { describe, expect, it } from 'vitest';
import { classifyWithModel, classifiesIntent } from '../src/planner/intent.ts';

/** Minimal stub: the classifier only needs `json`. */
function stub(raw: unknown) {
  return { json: async () => ({ raw }) } as never;
}

describe('model-backed intent classification', () => {
  it('returns the category when the model places the question', async () => {
    const got = await classifyWithModel(
      stub({ category: 'eat_drink', namesDistantLocation: false }),
      'fresh seafood by the water',
    );
    expect(got).toBe('eat_drink');
  });

  it('refuses a question about somewhere else, however well it classifies', async () => {
    const got = await classifyWithModel(
      stub({ category: 'eat_drink', namesDistantLocation: true }),
      'best sushi in Tokyo',
    );
    expect(got).toBeNull();
  });

  it('returns null for "unknown" so the caller refuses', async () => {
    const got = await classifyWithModel(
      stub({ category: 'unknown', namesDistantLocation: false }),
      'what is 2+2',
    );
    expect(got).toBeNull();
  });

  it('never answers when the classifier itself fails', async () => {
    const broken = { json: async () => { throw new Error('provider down'); } } as never;
    expect(await classifyWithModel(broken, 'anything')).toBeNull();
  });

  it('the lexicon still short-circuits recognised words (no model call)', () => {
    expect(classifiesIntent('where can I eat arepas')).toBe(true);
    expect(classifiesIntent('asdfghjkl')).toBe(false);
  });
});
