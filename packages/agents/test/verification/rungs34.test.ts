import { describe, expect, it } from 'vitest';
import {
  checkPhotoReuse,
  checkIntraDiversity,
  nameSimilarity,
} from '../../src/verification/rungs34.ts';
import { hammingDistance } from '../../src/verification/phash.ts';

describe('checkPhotoReuse (rung L3)', () => {
  it('re-submitting a prior photo is a hard PHOTO_REUSE (Hamming ≤ 6)', () => {
    const v = checkPhotoReuse('aaaaaaaaaaaaaaaa', ['aaaaaaaaaaaaaaaa'], 0);
    expect(v.verdict).toBe('HARD');
    expect(v.reason).toBe('PHOTO_REUSE');
  });

  it('Hamming 7–12 is WEAK', () => {
    // Construct a hash 8 bits apart from the reference.
    const ref = 'ffffffffffffffff';
    const near = 'ffffffffffffff00'; // 8 bits differ
    expect(hammingDistance(ref, near)).toBe(8);
    const v = checkPhotoReuse(near, [ref], 0);
    expect(v.verdict).toBe('WEAK');
  });

  it('Hamming > 12 is PASS', () => {
    const ref = 'ffffffffffffffff';
    const far = '0000000000000000';
    expect(hammingDistance(ref, far)).toBe(64);
    const v = checkPhotoReuse(far, [ref], 0);
    expect(v.verdict).toBe('PASS');
  });
});

describe('checkIntraDiversity (rung L4)', () => {
  it('three shots of the same wall fail NO_DIVERSITY', () => {
    const v = checkIntraDiversity([
      'aaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaab',
      'aaaaaaaaaaaaaaac',
    ]);
    expect(v.verdict).toBe('HARD');
    expect(v.reason).toBe('NO_DIVERSITY');
  });

  it('distinct photos pass', () => {
    const v = checkIntraDiversity([
      'ffffffffffffffff',
      '0000000000000000',
      '1111111111111111',
    ]);
    expect(v.verdict).toBe('PASS');
  });
});

describe('nameSimilarity (near-duplicate places)', () => {
  it('identical names are near-duplicates', () => {
    expect(nameSimilarity('Arepera La Guacamaya', 'Arepera La Guacamaya')).toBe(1);
  });

  it('diacritic-folded names are near-duplicates', () => {
    expect(nameSimilarity('Café El Puerto', 'Cafe El Puerto')).toBeGreaterThan(0.9);
  });

  it('unrelated names are not', () => {
    expect(nameSimilarity('Arepera La Guacamaya', 'Farmacia Central')).toBeLessThan(0.5);
  });
});
