import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Pool } from 'pg';
import { q, storePhoto, missionsForSpotter, acceptMission, spotterEarnings, sessionForQr } from '@guaca/db';
import type { Inference } from '@guaca/agents';
import { ask } from './plannerService.js';
import { opsStreamPlugin } from './opsStream.js';
import { spotterLogin, verifySpotterToken } from './spotterAuth.js';

export interface AppOptions {
  pool: Pool;
  inference?: Inference;
  minCandidates?: number;
}

/**
 * Build the Fastify app. Routes are registered here so tests can inject
 * requests without binding a port.
 */
export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  void app.register(cookie);
  void app.register(opsStreamPlugin);

  /*
   * The web app is served from a different origin than the API in every
   * environment we run (3000 vs 3001 locally). Without this the browser
   * never reaches /api/ask at all — preflight 404s and the fetch is blocked.
   * A specific origin rather than "*" so the villa session cookie still works.
   */
  const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      reply.header('access-control-allow-origin', origin);
      reply.header('access-control-allow-credentials', 'true');
      reply.header('vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      reply
        .header('access-control-allow-methods', 'GET,POST,OPTIONS')
        .header(
          'access-control-allow-headers',
          req.headers['access-control-request-headers'] ?? 'content-type',
        )
        .header('access-control-max-age', '600')
        .code(204)
        .send();
    }
  });

  app.get('/api/places', async (req, reply) => {
    const { bbox, category } = req.query as {
      bbox?: string;
      category?: string;
    };
    if (!bbox) {
      return reply.code(400).send({ error: 'bbox is required' });
    }
    const [lonMin, latMin, lonMax, latMax] = bbox.split(',').map(Number);
    if (
      [lonMin, latMin, lonMax, latMax].some((n) => !Number.isFinite(n)) ||
      !(lonMin! < lonMax!) ||
      !(latMin! < latMax!)
    ) {
      return reply.code(400).send({ error: 'invalid bbox' });
    }
    const centerLat = (latMin! + latMax!) / 2;
    const centerLon = (lonMin! + lonMax!) / 2;
    const radiusM = Math.max(
      distM(centerLat, centerLon, latMin!, lonMin!),
      distM(centerLat, centerLon, latMax!, lonMax!),
    );
    const places = await q.places.findVerifiedNear(
      options.pool,
      centerLat,
      centerLon,
      radiusM,
      category,
    );
    return { places };
  });

  app.post('/api/photos', async (req, reply) => {
    const body = req.body as {
      placeId?: string;
      spotterId?: string;
      imageBase64?: string;
      captureLat?: number;
      captureLon?: number;
      captureAccuracyM?: number;
      capturedAt?: string;
    };
    if (!body.placeId || !body.spotterId || !body.imageBase64) {
      return reply.code(400).send({ error: 'placeId, spotterId, imageBase64 required' });
    }
    const image = Buffer.from(body.imageBase64, 'base64');
    const capture: {
      lat?: number;
      lon?: number;
      accuracyM?: number;
      capturedAt?: Date;
    } = {};
    if (body.captureLat !== undefined) capture.lat = body.captureLat;
    if (body.captureLon !== undefined) capture.lon = body.captureLon;
    if (body.captureAccuracyM !== undefined) capture.accuracyM = body.captureAccuracyM;
    if (body.capturedAt) capture.capturedAt = new Date(body.capturedAt);
    const stored = await storePhoto(options.pool, {
      placeId: body.placeId,
      uploadedBySpotterId: body.spotterId,
      image,
      capture,
    });
    return reply.code(201).send(stored);
  });

  app.post('/api/ask', async (req, reply) => {
    const body = req.body as {
      text?: string;
      language?: string;
      lat?: number;
      lon?: number;
    };
    if (!body.text) {
      return reply.code(400).send({ error: 'text is required' });
    }
    const inference =
      options.inference ??
      (await import('@guaca/agents')).createProvider({
        INFERENCE_BASE_URL: process.env.INFERENCE_BASE_URL ?? 'http://localhost:8000/v1',
        INFERENCE_API_KEY: process.env.INFERENCE_API_KEY ?? 'changeme',
        INFERENCE_MODEL: process.env.INFERENCE_MODEL ?? 'Qwen/Qwen3-VL-8B-Instruct',
        ...(process.env.INFERENCE_VISION_MODEL
          ? { INFERENCE_VISION_MODEL: process.env.INFERENCE_VISION_MODEL }
          : {}),
        ...(process.env.INFERENCE_TIMEOUT_MS
          ? { INFERENCE_TIMEOUT_MS: process.env.INFERENCE_TIMEOUT_MS }
          : {}),
        ...(process.env.INFERENCE_MAX_RETRIES
          ? { INFERENCE_MAX_RETRIES: process.env.INFERENCE_MAX_RETRIES }
          : {}),
      });
    const result = await ask(
      options.pool,
      {
        text: body.text,
        language: body.language ?? 'en',
        lat: body.lat ?? 10.4716,
        lon: body.lon ?? -68.0056,
      },
      {
        minCandidates: options.minCandidates ?? Number(process.env.PLANNER_MIN_CANDIDATES ?? 3),
        inference,
      },
    );
    return reply.send(result);
  });

  app.post('/api/plan', async (req, reply) => {
    const body = req.body as { text?: string; language?: string };
    // The plan endpoint is the routed day — same guarded pipeline; routing
    // is deterministic code, not LLM guessing (§4.7).
    return app.inject({
      method: 'POST',
      url: '/api/ask',
      payload: { text: body.text, language: body.language, lat: 10.4716, lon: -68.0056 },
    }).then((res) => reply.code(res.statusCode).send(res.body));
  });

  app.post('/api/spotter/login', async (req, reply) => {
    const body = req.body as { phone?: string; code?: string };
    if (!body.phone || !body.code) {
      return reply.code(400).send({ error: 'phone and code required' });
    }
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? 'changeme-32-bytes-min!',
    );
    const result = await spotterLogin(
      {
        findSpotterByPhone: async (phone) => {
          const res = await options.pool.query(
            `select id, phone, name, login_code_hash from spotters where phone = $1 and active`,
            [phone],
          );
          const r = res.rows[0];
          return r
            ? { id: r.id as string, phone: r.phone as string, name: r.name as string, loginCodeHash: (r.login_code_hash as string) ?? null }
            : null;
        },
      },
      { phone: body.phone, code: body.code },
      secret,
    );
    if (!result.ok) {
      return reply.code(401).send({ error: result.reason });
    }
    return reply
      .setCookie('guaca_spotter', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      })
      .send({ ok: true, name: result.spotter.name });
  });

  app.get('/api/spotter/missions', async (req, reply) => {
    const token = req.cookies?.guaca_spotter;
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? 'changeme-32-bytes-min!',
    );
    const { spotterId } = await verifySpotterToken(token, secret);
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const missions = await missionsForSpotter(options.pool, spotterId);
    return { missions };
  });

  app.post('/api/spotter/missions/:id/accept', async (req, reply) => {
    const token = req.cookies?.guaca_spotter;
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? 'changeme-32-bytes-min!',
    );
    const { spotterId } = await verifySpotterToken(token, secret);
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    const r = await acceptMission(options.pool, id, spotterId);
    return r.ok ? { ok: true } : reply.code(409).send({ error: r.reason });
  });

  app.get('/api/spotter/earnings', async (req, reply) => {
    const token = req.cookies?.guaca_spotter;
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? 'changeme-32-bytes-min!',
    );
    const { spotterId } = await verifySpotterToken(token, secret);
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const rows = await spotterEarnings(options.pool, spotterId);
    return { rows };
  });

  app.post('/api/v/:qrToken/session', async (req, reply) => {
    const { qrToken } = req.params as { qrToken: string };
    const body = req.body as { language?: string };
    const session = await sessionForQr(
      options.pool,
      qrToken,
      body.language ?? 'en',
    );
    if (!session) return reply.code(404).send({ error: 'qr not found' });
    return reply.send({
      sessionId: session.sessionId,
      propertyName: session.propertyName,
    });
  });

  app.get('/api/places/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await options.pool.query(
      `select
         p.id, p.area_id, p.name, p.category, p.description,
         p.landmark_description,
         ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon,
         p.h3_8, p.open_hours, p.price_band, p.tags, p.source,
         p.verification_status, p.witness_count,
         p.created_by_spotter_id, p.confirmed_by_spotter_id,
         p.verified_at, p.rejection_reason,
         s.name as spotter_name, s.photo_url as spotter_photo_url
       from places p
       left join spotters s on s.id = p.created_by_spotter_id
       where p.id = $1 and p.verification_status = 'verified'`,
      [id],
    );
    if (res.rows.length === 0) {
      return reply.code(404).send({ error: 'not found' });
    }
    return res.rows[0];
  });

  return app;
}

function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
