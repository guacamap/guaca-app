import { describe, expect, it } from 'vitest';
import { lexicalSweep } from '../../src/guard/lexicalSweep.ts';

// Catalog names: tokens that ARE allowed in prose.
const CATALOG_NAMES = ['La Guacamaya', 'Café El Puerto'];

describe('lexicalSweep', () => {
  it('passes prose built from catalog names plus gazetteer nouns', () => {
    const text = 'Café El Puerto está junto a la Playa Quizandal';
    expect(lexicalSweep(text, CATALOG_NAMES)).toEqual([]);
  });

  it('catches a Cyrillic homoglyph café (Сafé)', () => {
    // Cyrillic С + Latin afé — visually identical, different code points.
    const text = 'Сafé La Sirena Dorada';
    const hits = lexicalSweep(text, CATALOG_NAMES);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('catches a capitalised n-gram not in the catalog', () => {
    const text = 'La Sirena Dorada es famosa';
    const hits = lexicalSweep(text, CATALOG_NAMES);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toContain('Sirena');
  });

  it('catches quoted spans', () => {
    const text = 'Busca "El Rincón del Cangrejo" al final de la calle';
    const hits = lexicalSweep(text, CATALOG_NAMES);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('does not flag generic nouns or single words', () => {
    const text = 'La playa está cerca del puerto';
    expect(lexicalSweep(text, CATALOG_NAMES)).toEqual([]);
  });

  it('normalises diacritics before matching', () => {
    // 'Café' with an accent must match the catalog token 'Café El Puerto'
    // after NFKD folding, so it is NOT flagged.
    const text = 'Café El Puerto abre a las nueve';
    expect(lexicalSweep(text, CATALOG_NAMES)).toEqual([]);
  });
});
