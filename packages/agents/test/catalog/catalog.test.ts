import { describe, expect, it } from 'vitest';
import { Catalog } from '../../src/catalog/catalog.ts';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Arepera La Guacamaya',
    category: 'eat_drink' as const,
    verificationStatus: 'verified' as const,
    witnessCount: 2,
    ...overrides,
  };
}

describe('Catalog', () => {
  it('refuses a provisional row so its ref can never exist', () => {
    const catalog = Catalog.build([row({ verificationStatus: 'provisional' })]);
    expect(catalog.size).toBe(0);
    expect(() => catalog.byRef(1)).toThrow();
  });

  it('refuses a row with witness_count < 2', () => {
    const catalog = Catalog.build([row({ witnessCount: 1 })]);
    expect(catalog.size).toBe(0);
  });

  it('assigns stable refs and maps back to placeIds', () => {
    const a = row({ id: '00000000-0000-4000-8000-000000000001' });
    const b = row({ id: '00000000-0000-4000-8000-000000000002' });
    const catalog = Catalog.build([a, b]);
    expect(catalog.size).toBe(2);
    const refs = [...catalog.refs()].sort();
    expect(refs).toEqual([1, 2]);
    expect(catalog.byRef(1)!.placeId).toBe(a.id);
    expect(catalog.byRef(2)!.placeId).toBe(b.id);
  });

  it('refEnum emits an integer enum of 1..N for the JSON schema', () => {
    const catalog = Catalog.build([
      row({ id: '00000000-0000-4000-8000-000000000001' }),
      row({ id: '00000000-0000-4000-8000-000000000002' }),
      row({ id: '00000000-0000-4000-8000-000000000003' }),
    ]);
    const schema = catalog.refEnum();
    expect(schema.type).toBe('integer');
    expect(schema.enum).toEqual([1, 2, 3]);
  });

  it('produces a stable sha256 fingerprint over the catalog contents', () => {
    const a = row({ id: '00000000-0000-4000-8000-000000000001' });
    const b = row({ id: '00000000-0000-4000-8000-000000000002' });
    const c1 = Catalog.build([a, b]);
    const c2 = Catalog.build([a, b]);
    expect(c1.fingerprint).toBe(c2.fingerprint);
    expect(c1.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('placeIds are never sent to the model — refs are the only vocabulary', () => {
    const catalog = Catalog.build([
      row({ id: '00000000-0000-4000-8000-000000000001' }),
    ]);
    const schema = catalog.refEnum();
    expect(JSON.stringify(schema)).not.toContain('00000000-0000-4000-8000');
  });
});
