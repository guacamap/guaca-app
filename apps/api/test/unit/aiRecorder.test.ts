import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { z } from 'zod';
import { recordingInference } from '../../src/aiRecorder.ts';
import type { Inference } from '@guaca/agents';

function pool() {
  const rows: unknown[][] = [];
  return { rows, pool: { query: async (_t: string, v: unknown[]) => { rows.push(v); return { rows: [] }; } } as unknown as Pool };
}
const req = { schema: z.object({ a: z.number() }), purpose: 'planner.plan', maxOutputTokens: 100, system: 's', user: 'u' };

describe('recordingInference', () => {
  it('records a successful call with purpose, model, latency and tokens', async () => {
    const { rows, pool: p } = pool();
    const inner: Inference = { json: async () => ({ raw: { a: 1 }, usage: { tokensIn: 12, tokensOut: 3 }, model: 'm1' }), vision: async () => { throw new Error('x'); } };
    const res = await recordingInference(p, inner, 'hint').json(req);
    expect(res.raw).toEqual({ a: 1 });
    expect(rows).toHaveLength(1);
    const [purpose, kind, model, ok, errKind, , , tin, tout] = rows[0]!;
    expect([purpose, kind, model, ok, errKind, tin, tout]).toEqual(['planner.plan', 'json', 'm1', true, null, 12, 3]);
  });

  it('records a schema failure as such and rethrows so the caller still sees it', async () => {
    const { rows, pool: p } = pool();
    const inner: Inference = { json: async () => { throw new Error('inference returned invalid JSON after repair: stops Required'); }, vision: async () => { throw new Error('x'); } };
    await expect(recordingInference(p, inner, 'hint').json(req)).rejects.toThrow(/invalid JSON/);
    const [purpose, , model, ok, errKind] = rows[0]!;
    expect([purpose, model, ok, errKind]).toEqual(['planner.plan', 'hint', false, 'schema']);
  });

  it('never lets a failed write break the call', async () => {
    const broken = { query: async () => { throw new Error('db down'); } } as unknown as Pool;
    const inner: Inference = { json: async () => ({ raw: { a: 2 }, usage: { tokensIn: 1, tokensOut: 1 }, model: 'm' }), vision: async () => { throw new Error('x'); } };
    const res = await recordingInference(broken, inner, 'hint').json(req);
    expect(res.raw).toEqual({ a: 2 });
  });
});
