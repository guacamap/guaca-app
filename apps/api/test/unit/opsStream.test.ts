import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import type { FastifyInstance } from 'fastify';

const pool = { query: async () => ({ rows: [] }) } as unknown as Pool;

function openWs(app: FastifyInstance): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    app.ready().then(() => {
      const url = `ws://localhost:${(app.server.address() as { port: number }).port}/api/ops/stream`;
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(ws);
      ws.onerror = (e) => reject(new Error(`ws error: ${JSON.stringify(e)}`));
    });
  });
}

describe('GET /api/ops/stream (T5.7)', () => {
  it('broadcasts agent events to connected ops clients', async () => {
    const app = buildApp({ pool });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const events: string[] = [];

    const ws = await openWs(app);
    ws.onmessage = (m) => events.push(String(m.data));

    // The app's broadcast helper — the same one the gap agent scheduler uses.
    (app as unknown as { broadcastAgentEvent(e: object): void }).broadcastAgentEvent({
      ts: '2026-08-06T18:00:00Z',
      level: 'info',
      event: 'agent.node.complete',
      agent: 'gap',
      status: 'ok',
    });

    // Give the broadcast a tick to flush.
    await new Promise((r) => setTimeout(r, 50));
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!).toContain('gap');

    ws.close();
    await app.close();
  });
  it('refuses unauthenticated upgrades when OPERATOR_TOKEN is set', async () => {
    process.env.OPERATOR_TOKEN = 'secret-op-token';
    const app = buildApp({ pool });
    await app.listen({ port: 0, host: '127.0.0.1' });
    await app.ready();

    // 'open' can legitimately fire before the close frame is processed —
    // the assertion that matters is HOW the connection ends: the gate's
    // 4001, not a quiet broadcast-ready socket.
    const closeCode = await new Promise<number>((resolve) => {
      const addr = app.server.address() as { port: number };
      const ws = new WebSocket(`ws://localhost:${addr.port}/api/ops/stream`);
      ws.onopen = () => {
        (app as unknown as { broadcastAgentEvent(e: object): void }).broadcastAgentEvent({
          event: 'should.not.arrive', agent: 'gap',
        });
      };
      ws.onmessage = () => resolve(-1); // a broadcast would prove the gate failed
      ws.onclose = (e) => resolve((e as unknown as { code: number }).code);
      ws.onerror = () => resolve(1006);
      setTimeout(() => resolve(0), 2000);
    });
    expect([4001, 1006, 1005]).toContain(closeCode);

    delete process.env.OPERATOR_TOKEN;
    await app.close();
  });
});
