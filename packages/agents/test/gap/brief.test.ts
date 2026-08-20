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

describe('composeBrief — zone people-count', () => {
  it('es: names the demand that justified the mission', () => {
    const brief = composeBrief({
      language: 'es',
      category: 'eat_drink',
      zoneName: 'Malecón',
      spotterName: 'Yorman',
      zonePeopleCount: 7,
    });
    expect(brief).toContain('7 personas han preguntado por esta zona');
    expect(brief).toContain('Malecón');
  });

  it('en: singular person gets singular grammar', () => {
    const one = composeBrief({
      language: 'en',
      category: 'eat_drink',
      zoneName: 'Malecón',
      spotterName: 'Yorman',
      zonePeopleCount: 1,
    });
    expect(one).toContain('1 person has asked');
  });

  it('no count, no demand line — never a fabricated number', () => {
    const brief = composeBrief({
      language: 'es',
      category: 'eat_drink',
      zoneName: 'Malecón',
      spotterName: 'Yorman',
    });
    expect(brief).not.toContain('personas han preguntado');
  });
});
