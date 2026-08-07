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

  app.get('/api/ops/stream', { websocket: true }, (socket) => {
    clients.add(socket as unknown as WebSocket);
    socket.on('close', () => clients.delete(socket as unknown as WebSocket));
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    broadcastAgentEvent(event: object): void;
  }
}
