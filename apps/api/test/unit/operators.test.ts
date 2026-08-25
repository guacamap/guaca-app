import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';

/**
 * The panel allowlist routes. Exercised through the shared OPERATOR_TOKEN,
 * which counts as admin by design; the per-operator JWT path is covered by
 * the guards' 403 on a non-admin role.
 */
function fakePool(opts: { activeAdminsBesides?: number; targetRole?: string } = {}) {
  const calls: { text: string; values: unknown[] }[] = [];
  const pool = {
    query: async (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      if (/from operators where email/.test(text)) return { rows: [] };
      if (/count\(\*\)::int as n from operators/.test(text)) return { rows: [{ n: opts.activeAdminsBesides ?? 1 }] };
      if (/select role from operators where id/.test(text)) return { rows: [{ role: opts.targetRole ?? 'operator' }] };
      if (/^\s*select id, email, name, role, active, last_login_at\s+from operators/.test(text)) {
        return { rows: [{ id: 'op-1', email: 'a@guaca.live', name: 'A', role: 'admin', active: true, last_login_at: null }] };
      }
      if (/insert into operators/.test(text)) {
        return { rows: [{ id: 'op-2', email: values[0], name: values[1], role: values[2], active: true, last_login_at: null }] };
      }
      if (/update operators set active/.test(text)) {
        return { rows: [{ id: values[0], email: 'x@guaca.live', name: 'X', role: 'operator', active: values[1], lastLoginAt: null }] };
      }
      return { rows: [] };
    },
  } as unknown as Pool;
  return { pool, calls };
}

const H = { authorization: 'Bearer shared-secret' };

describe('operator allowlist routes', () => {
  let prev: string | undefined;
  beforeEach(() => { prev = process.env.OPERATOR_TOKEN; process.env.OPERATOR_TOKEN = 'shared-secret'; });
  afterEach(() => { process.env.OPERATOR_TOKEN = prev; });

  it('refuses without a token', async () => {
    const app = buildApp({ pool: fakePool().pool });
    const res = await app.inject({ method: 'GET', url: '/api/operator/operators' });
    expect(res.statusCode).toBe(401);
  });

  it('lists operators for the shared token', async () => {
    const app = buildApp({ pool: fakePool().pool });
    const res = await app.inject({ method: 'GET', url: '/api/operator/operators', headers: H });
    expect(res.statusCode).toBe(200);
    expect(res.json().operators[0].email).toBe('a@guaca.live');
  });

  it('validates email and role when adding', async () => {
    const app = buildApp({ pool: fakePool().pool });
    const bad = await app.inject({ method: 'POST', url: '/api/operator/operators', headers: H, payload: { email: 'nope', name: 'N' } });
    expect(bad.statusCode).toBe(400);
    const badRole = await app.inject({ method: 'POST', url: '/api/operator/operators', headers: H, payload: { email: 'n@guaca.live', name: 'N', role: 'owner' } });
    expect(badRole.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/api/operator/operators', headers: H, payload: { email: 'N@Guaca.live', name: 'N', role: 'moderator' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().email).toBe('n@guaca.live');
  });

  it('will not deactivate the last active admin', async () => {
    const app = buildApp({ pool: fakePool({ activeAdminsBesides: 0, targetRole: 'admin' }).pool });
    const res = await app.inject({
      method: 'POST', url: '/api/operator/operators/11111111-1111-4111-8111-111111111111/active', headers: H, payload: { active: false },
    });
    expect(res.statusCode).toBe(409);
  });

  it('deactivates and reactivates an ordinary operator, auditing both', async () => {
    const { pool, calls } = fakePool({ activeAdminsBesides: 1, targetRole: 'operator' });
    const app = buildApp({ pool });
    const id = '22222222-2222-4222-8222-222222222222';
    const off = await app.inject({ method: 'POST', url: `/api/operator/operators/${id}/active`, headers: H, payload: { active: false } });
    expect(off.statusCode).toBe(200);
    expect(off.json().active).toBe(false);
    const on = await app.inject({ method: 'POST', url: `/api/operator/operators/${id}/active`, headers: H, payload: { active: true } });
    expect(on.statusCode).toBe(200);
    const audits = calls.filter((c) => /insert into operator_actions/.test(c.text)).map((c) => c.values[0]);
    expect(audits).toEqual(['operator.deactivate', 'operator.reactivate']);
  });
});
