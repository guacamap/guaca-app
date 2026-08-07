import { describe, expect, it } from 'vitest';
import { requireOperatorToken, render, JsonOutput } from '../src/auth.ts';

describe('T6.1 — operator auth and --json', () => {
  it('rejects commands without OPERATOR_TOKEN', () => {
    expect(() => requireOperatorToken(undefined)).toThrow(/OPERATOR_TOKEN/);
  });

  it('accepts a configured OPERATOR_TOKEN', () => {
    expect(requireOperatorToken('secret-token')).toBe('secret-token');
  });

  it('renders --json as a single JSON line', () => {
    const out = render({ ok: true, items: [1, 2] }, { json: true });
    expect(JSON.parse(out)).toEqual({ ok: true, items: [1, 2] });
  });

  it('renders human output without --json', () => {
    const out = render({ ok: true, items: [1, 2] }, { json: false });
    expect(out).not.toContain('{');
    expect(out).toContain('ok');
  });

  it('JsonOutput type carries the shape for typed commands', () => {
    const o: JsonOutput<{ missionId: string }> = { missionId: 'm1' };
    expect(o.missionId).toBe('m1');
  });
});
