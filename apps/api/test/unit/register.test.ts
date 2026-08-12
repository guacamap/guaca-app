import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';

function fakePool() {
  const calls: { text: string; values: unknown[] }[] = [];
  const pool = {
    query: async (text: string, values: unknown[]) => {
      calls.push({ text, values });
      return {
        rows: [{ id: 'reg-1', role: values[0], created_at: new Date('2026-08-11T00:00:00Z') }],
      };
    },
  } as unknown as Pool;
  return { pool, calls };
}

describe('POST /api/register', () => {
  it('rejects an unknown role', async () => {
    const app = buildApp({ pool: fakePool().pool });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: { role: 'admin', name: 'Ana', contact: 'ana@example.com' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing name or contact', async () => {
    const app = buildApp({ pool: fakePool().pool });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: { role: 'traveler', name: '  ', contact: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('records each valid role and echoes the id', async () => {
    for (const role of ['traveler', 'spotter', 'owner'] as const) {
      const { pool, calls } = fakePool();
      const app = buildApp({ pool });
      const res = await app.inject({
        method: 'POST',
        url: '/api/register',
        payload: {
          role,
          name: 'Ana Pérez',
          contact: 'ana@example.com',
          language: 'es',
          details: { zone: 'Patanemo' },
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ ok: true, id: 'reg-1', role });
      expect(calls).toHaveLength(1);
      expect(calls[0]!.values[0]).toBe(role);
      expect(calls[0]!.values[2]).toBe('ana@example.com');
      expect(calls[0]!.values[3]).toBe('es');
    }
  });

  it('normalizes contact details before recording the waitlist entry', async () => {
    const { pool, calls } = fakePool();
    const app = buildApp({ pool });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        role: 'traveler',
        name: 'Ana Pérez',
        contact: '  ANA@Example.COM ',
        details: { community: 'Curaçao' },
      },
    });

    expect(res.statusCode).toBe(201);
    expect(calls[0]!.values[2]).toBe('ana@example.com');
    expect(calls[0]!.values[4]).toBe(JSON.stringify({ community: 'Curaçao' }));
  });
});
