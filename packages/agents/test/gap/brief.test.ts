import { describe, expect, it } from 'vitest';
import { composeBrief, type BriefInput } from '../../src/gap/brief.ts';

function input(overrides: Partial<BriefInput> = {}): BriefInput {
  return {
    language: 'es',
    category: 'eat_drink',
    zoneName: 'Malecón',
    spotterName: 'Yorman',
    landmarkHint: 'Cerca del fuerte San Felipe',
    ...overrides,
  };
}

describe('composeBrief (T5.4)', () => {
  it('composes a Spanish brief naming what to find, where, and photos needed', () => {
    const brief = composeBrief(input());
    expect(brief).toContain('Yorman');
    expect(brief).toContain('Malecón');
    expect(brief).toContain('Cerca del fuerte San Felipe');
    expect(brief.toLowerCase()).toContain('foto');
    // The category label is present in Spanish.
    expect(brief).toContain('Comer y beber');
  });

  it('composes an English brief for an English-speaking spotter', () => {
    const brief = composeBrief(input({ language: 'en', spotterName: 'John' }));
    expect(brief).toContain('John');
    expect(brief.toLowerCase()).toContain('photo');
    expect(brief).toContain('Eat & drink');
  });

  it('mentions the number of photos needed', () => {
    const brief = composeBrief(input({ photosRequired: 3 }));
    expect(brief).toMatch(/3/);
  });
});
