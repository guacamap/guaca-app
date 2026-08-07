import { describe, expect, it } from 'vitest';
import { validateSubmission } from '../src/submit.ts';

describe('T7.4 — place submission validation', () => {
  it('requires the landmark description', () => {
    const r = validateSubmission({
      name: 'Arepera La Guacamaya',
      category: 'eat_drink',
      landmarkDescription: '',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/landmark/i);
  });

  it('requires a name and a category', () => {
    expect(validateSubmission({ name: '', category: 'eat_drink', landmarkDescription: 'Casa amarilla' }).ok).toBe(false);
    expect(validateSubmission({ name: 'X', category: '' as never, landmarkDescription: 'Casa amarilla' }).ok).toBe(false);
  });

  it('accepts a complete submission', () => {
    const r = validateSubmission({
      name: 'Arepera La Guacamaya',
      category: 'eat_drink',
      landmarkDescription: 'Casa amarilla al lado del puente',
      priceBand: 2,
    });
    expect(r.ok).toBe(true);
  });
});
