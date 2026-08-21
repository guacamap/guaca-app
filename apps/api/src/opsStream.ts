import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';

const clients = new Set<WebSocket>();

/**
 * T5.7 — /api/ops/stream broadcasts agent events (structured log lines) to
 * connected ops clients — the demo shows the gap agent reasoning live.
 * fastify-plugin is required so the decorate escapes the plugin context.
 */
export const opsStreamPlugin = fp(async (app: FastifyInstance) => {
  await app.register(websocket);

  app.decorate('broadcastAgentEvent', (event: object) => {
    const line = JSON.stringify(event);
    for (const client of clients) {
      try {
        client.send(line);
      } catch {
        clients.delete(client);
      }
    }
  });

  // Refuse bad tokens at the HTTP layer, before the 101 upgrade — the
  // socket-level close below is the second layer, not the only one.
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/ops/stream')) return;
    const expected = process.env.OPERATOR_TOKEN;
    if (!expected) {
      if (process.env.NODE_ENV === 'production') {
        return reply.code(503).send({ error: 'OPERATOR_TOKEN is not configured' });
      }
      return; // dev/test without a token: open stream (localhost only)
    }
    const presented = new URL(req.url, 'http://x').searchParams.get('token') ?? '';
    const ok =
      presented.length > 0 &&
      timingSafeEqual(
        createHash('sha256').update(presented).digest(),
        createHash('sha256').update(expected).digest(),
      );
    if (!ok) return reply.code(401).send({ error: 'operator token required' });
  });

  app.get('/api/ops/stream', { websocket: true }, (socket, req) => {
    // The stream is operational telemetry — gap scores, commission events,
    // spotter names in briefs. It must be as guarded as the operator CLI:
    // when OPERATOR_TOKEN is set (it is, in every deployed tier), the
    // upgrade must carry it as ?token= (browser WS cannot set headers).
    // Without a token configured, only non-production allows connections —
    // a production process with no OPERATOR_TOKEN refuses instead of
    // broadcasting to the world.
    const expected = process.env.OPERATOR_TOKEN;
    const presented = ((req.query as { token?: string }) ?? {}).token ?? '';
    const tokenOk =
      !!expected &&
      presented.length > 0 &&
      timingSafeEqual(
        createHash('sha256').update(presented).digest(),
        createHash('sha256').update(expected).digest(),
      );
    if (expected ? !tokenOk : process.env.NODE_ENV === 'production') {
      socket.close(4001, 'operator token required');
      return;
    }
    clients.add(socket as unknown as WebSocket);
    socket.on('close', () => clients.delete(socket as unknown as WebSocket));
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    broadcastAgentEvent(event: object): void;
  }
}
