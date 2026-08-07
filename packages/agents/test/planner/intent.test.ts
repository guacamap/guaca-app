import { describe, expect, it } from 'vitest';
import {
  IntentSchema,
  parseIntent,
  extractIntent,
} from '../../src/planner/intent.ts';
import { PlaceCategory } from '@guaca/shared';

describe('IntentSchema', () => {
  it('accepts a full intent', () => {
    const parsed = IntentSchema.safeParse({
      category: 'eat_drink',
      h3_8: '8a0000000000000',
      when: 'now',
      partySize: 2,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const parsed = IntentSchema.safeParse({ category: 'alien_world' });
    expect(parsed.success).toBe(false);
  });

  it('is strict — extra keys fail', () => {
    const parsed = IntentSchema.safeParse({
      category: 'eat_drink',
      placeName: 'La Sirena Dorada',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('extractIntent', () => {
  it('classifies an eat/drink question by lexicon', () => {
    const intent = extractIntent('¿Dónde puedo comer arepas cerca del fuerte?');
    expect(intent.category).toBe('eat_drink');
    expect(intent.when).toBe('now');
  });

  it('classifies a beach question', () => {
    const intent = extractIntent('is there anywhere to snorkel at Isla Larga?');
    expect(intent.category).toBe('beach_water');
  });

  it('classifies a practical-services question', () => {
    const intent = extractIntent('where is the nearest atm?');
    expect(intent.category).toBe('services');
  });

  it('degrades to a broad category on unparseable input, never fails', () => {
    const intent = extractIntent('zzzz qqqq xxxx');
    expect(intent.category).toBe('eat_drink'); // broad default
    expect(intent.when).toBe('now');
  });

  it('preserves party size when present', () => {
    const intent = extractIntent('table for 4 people, please');
    expect(intent.partySize).toBe(4);
  });
});

describe('parseIntent', () => {
  it('round-trips a valid object', () => {
    const parsed = parseIntent({
      category: 'eat_drink' as PlaceCategory,
      h3_8: '8a0000000000000',
      when: 'evening',
      partySize: 3,
    });
    expect(parsed).not.toBeNull();
  });

  it('returns null (→ broad category) on junk, never throws', () => {
    expect(parseIntent({ category: 'bogus' })).toBeNull();
    expect(parseIntent(null)).toBeNull();
    expect(parseIntent('garbage')).toBeNull();
  });
});
