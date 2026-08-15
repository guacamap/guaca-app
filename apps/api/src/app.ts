import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { q, storePhoto, missionsForSpotter, acceptMission, spotterEarnings, sessionForQr, recordRegistration, recordQuestion, upsertTouristLoginCode, consumeTouristLoginCode, touristById, submitPlace, confirmSecondLocal, pendingProvisionalNear, propertyByQrToken, deleteTourist, addPlacePost, postsForPlace, addFavorite, removeFavorite, listFavorites } from '@guaca/db';
import { createObjectStore, type ObjectStore } from './objectStore.js';
import { runSubmissionVerification, confirmAllowed } from './verificationService.js';
import type { Inference } from '@guaca/agents';
import { ask } from './plannerService.js';
import { opsStreamPlugin } from './opsStream.js';
import { spotterLogin, verifySpotterToken } from './spotterAuth.js';
import { requestTouristCode, verifyTouristLogin, verifyTouristToken } from './touristAuth.js';
import { createEmailSender, type EmailSender } from './email.js';

export interface AppOptions {
  pool: Pool;
  inference?: Inference;
  minCandidates?: number;
  /** Injected by tests to capture login codes instead of sending mail. */
  emailSender?: EmailSender;
  /** Injected by tests; defaults to MinIO/S3 from env. */
  objectStore?: ObjectStore;
}

/** §4.1 — auth tokens arrive as an httpOnly cookie (web) or a Bearer
 *  header (wrapper/native), through the same verification path. */
function tokenFrom(req: FastifyRequest, cookieName: string): string | undefined {
  const fromCookie = req.cookies?.[cookieName];
  if (fromCookie) return fromCookie;
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
}

/** Fixed-window in-memory rate limit — deliberate §7 decision: no Redis
 *  while a single API instance exists. */
function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const kept = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (kept.length >= limit) {
      hits.set(key, kept);
      return false;
    }
    kept.push(now);
    hits.set(key, kept);
    return true;
  };
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
        .header('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS')
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
    // Review activity per place — powers the ★ pin badges and the heatmap.
    const stats = await options.pool.query(
      `select place_id,
              count(*)::int as posts_count,
              avg(rating)::float as avg_rating,
              count(rating)::int as rating_count
       from place_posts where status = 'visible' group by place_id`,
    );
    const byPlace = new Map(
      stats.rows.map((r) => [
        r.place_id as string,
        {
          postsCount: r.posts_count as number,
          avgRating: (r.avg_rating as number) ?? null,
          ratingCount: r.rating_count as number,
        },
      ]),
    );
    return {
      places: places.map((p) => ({
        ...p,
        ...(byPlace.get(p.id) ?? { postsCount: 0, avgRating: null, ratingCount: 0 }),
      })),
    };
  });

  /*
   * OSM candidates — the open-data backdrop (§DATA_SOURCES). Rendered as
   * small dots, never pins: a dot has NOT been verified by anyone. The only
   * road from dot to pin is the witness pipeline.
   */
  app.get('/api/places/candidates', async (req, reply) => {
    const { bbox } = req.query as { bbox?: string };
    if (!bbox) return reply.code(400).send({ error: 'bbox is required' });
    const [lonMin, latMin, lonMax, latMax] = bbox.split(',').map(Number);
    if ([lonMin, latMin, lonMax, latMax].some((n) => !Number.isFinite(n))) {
      return reply.code(400).send({ error: 'invalid bbox' });
    }
    const res = await options.pool.query(
      `select id, name, category,
              ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon
       from places
       where verification_status = 'candidate' and source = 'osm_candidate'
         and ST_Intersects(location::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
       limit 800`,
      [lonMin, latMin, lonMax, latMax],
    );
    return { candidates: res.rows };
  });

  app.post('/api/photos', async (req, reply) => {
    // The uploader is whoever holds the spotter session — never a body field.
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const body = req.body as {
      placeId?: string;
      imageBase64?: string;
      captureLat?: number;
      captureLon?: number;
      captureAccuracyM?: number;
      capturedAt?: string;
    };
    if (!body.placeId || !body.imageBase64) {
      return reply.code(400).send({ error: 'placeId, imageBase64 required' });
    }
    const image = Buffer.from(body.imageBase64, 'base64');
    if (image.length > 8 * 1024 * 1024) {
      return reply.code(413).send({ error: 'photo too large (8MB max)' });
    }
    // Only the submitting spotter may attach photos, and only while the
    // submission is open — review finding: photo injection into someone
    // else's ladder run (stale timestamps / duplicate phashes / foreign
    // bytes in the victim's paid vision call).
    const target = await options.pool.query(
      `select verification_status, created_by_spotter_id from places where id = $1`,
      [body.placeId],
    );
    const targetPlace = target.rows[0];
    if (!targetPlace) return reply.code(404).send({ error: 'place not found' });
    if (targetPlace.created_by_spotter_id !== spotterId) {
      return reply.code(403).send({ error: 'not your submission' });
    }
    if (targetPlace.verification_status !== 'provisional') {
      return reply.code(409).send({ error: `place is ${targetPlace.verification_status}` });
    }
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
    // Bytes first (the ladder's L5 must be able to read them back), row second.
    const storageKey = `${body.placeId}/${randomUUID()}.jpg`;
    await objectStore.put(storageKey, image, 'image/jpeg');
    const stored = await storePhoto(options.pool, {
      placeId: body.placeId,
      uploadedBySpotterId: spotterId,
      storageKey,
      image,
      capture,
    });
    return reply.code(201).send(stored);
  });

  // `||` not `??`: an empty string must not silently sign sessions, and in
  // production a missing secret is a hard failure, not a fallback.
  const sessionSecret = () => {
    const secret = process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET is required in production');
    }
    return new TextEncoder().encode(secret || 'changeme-32-bytes-min!');
  };
  const emailSender = options.emailSender ?? createEmailSender();
  const objectStore = options.objectStore ?? createObjectStore();
  const resolveInference = async () =>
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
  const askLimiter = rateLimiter(30, 60 * 60 * 1000); // 30 asks/hour/account
  const codeLimiter = rateLimiter(5, 15 * 60 * 1000); // 5 codes/15min/email

  app.post('/api/tourist/auth/request-code', async (req, reply) => {
    const body = req.body as { email?: string; language?: string; propertyId?: string };
    if (!body.email) return reply.code(400).send({ error: 'email is required' });
    if (!codeLimiter(body.email.trim().toLowerCase())) {
      return reply.code(429).send({ error: 'too many codes requested — wait a few minutes' });
    }
    const result = await requestTouristCode(
      {
        upsertLoginCode: (input) => upsertTouristLoginCode(options.pool, input),
        consumeLoginCode: (email, hash) => consumeTouristLoginCode(options.pool, email, hash),
      },
      {
        email: body.email,
        ...(body.language ? { language: body.language } : {}),
        attributedPropertyId: body.propertyId ?? null,
      },
      emailSender,
    );
    if (!result.ok) return reply.code(400).send({ error: 'invalid email' });
    return { ok: true };
  });

  app.post('/api/tourist/auth/verify', async (req, reply) => {
    const body = req.body as { email?: string; code?: string };
    if (!body.email || !body.code) {
      return reply.code(400).send({ error: 'email and code required' });
    }
    const result = await verifyTouristLogin(
      {
        upsertLoginCode: (input) => upsertTouristLoginCode(options.pool, input),
        consumeLoginCode: (email, hash) => consumeTouristLoginCode(options.pool, email, hash),
      },
      { email: body.email, code: body.code },
      sessionSecret(),
    );
    if (!result.ok) return reply.code(401).send({ error: result.reason });
    return reply
      .setCookie('guaca_tourist', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      })
      .send({ ok: true, token: result.token, language: result.tourist.language });
  });

  // COMPLIANCE.md erasure + Google Play account-deletion requirement:
  // authenticated self-service, effective immediately.
  app.delete('/api/tourist/me', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'unauthorized' });
    const deleted = await deleteTourist(options.pool, touristId);
    if (!deleted) return reply.code(404).send({ error: 'account not found' });
    return reply
      .clearCookie('guaca_tourist', { path: '/' })
      .send({ ok: true, deleted: true });
  });

  app.get('/api/tourist/me', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'unauthorized' });
    const tourist = await touristById(options.pool, touristId);
    if (!tourist) return reply.code(401).send({ error: 'unauthorized' });
    let propertyName: string | null = null;
    if (tourist.attributedPropertyId) {
      const r = await options.pool.query(`select name from properties where id = $1`, [
        tourist.attributedPropertyId,
      ]);
      propertyName = (r.rows[0]?.name as string) ?? null;
    }
    return { email: tourist.email, language: tourist.language, propertyName };
  });

  app.patch('/api/tourist/me', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'unauthorized' });
    const body = req.body as { language?: string };
    if (body.language !== 'en' && body.language !== 'es') {
      return reply.code(400).send({ error: 'language must be en or es' });
    }
    await options.pool.query(`update tourists set language = $1 where id = $2`, [
      body.language,
      touristId,
    ]);
    return { ok: true, language: body.language };
  });

  app.post('/api/tourist/logout', async (_req, reply) => {
    return reply.clearCookie('guaca_tourist', { path: '/' }).send({ ok: true });
  });

  const doubtLimiter = rateLimiter(5, 24 * 60 * 60 * 1000); // 5 doubts/day/tourist

  /*
   * "Is this still accurate?" — a doubt, not a review. Nothing is published;
   * the doubt becomes an unanswered question at the place's location, which
   * the gap agent clusters into re-check demand like any refusal. Tourists
   * influence the map ONLY through questions — this is the second question
   * verb (§ product rules: no ratings, no reviews, no user content).
   */
  app.post('/api/places/:id/doubt', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'login required' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    if (!doubtLimiter(touristId)) {
      return reply.code(429).send({ error: 'too many re-check requests today' });
    }
    const { id } = req.params as { id: string };
    const res = await options.pool.query(
      `select name, category,
              ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon
       from places where id = $1 and verification_status = 'verified'`,
      [id],
    );
    const place = res.rows[0] as
      | { name: string; category: string; lat: number; lon: number }
      | undefined;
    if (!place) return reply.code(404).send({ error: 'place not found' });
    await recordQuestion(options.pool, {
      rawText: `[recheck] ${place.name}`,
      language: 'en',
      category: place.category,
      lat: place.lat,
      lon: place.lon,
      answered: false,
      answerPlaceIds: [],
      refusalReason: 'RECHECK_REQUESTED',
      sessionId: null,
      propertyId: null,
    });
    return reply.code(201).send({ ok: true });
  });

  /*
   * "What locals say" — posts about a verified place: text tips plus links
   * to social videos (Reels/TikTok). Commentary only: a post never creates
   * or edits map facts. Ranking is trust-first — verified spotters by
   * level, then travelers — computed in postsForPlace.
   */
  const MEDIA_URL_RE =
    /^https:\/\/([a-z0-9-]+\.)?(tiktok\.com|instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/\S+$/i;
  const postLimiter = rateLimiter(10, 24 * 60 * 60 * 1000); // 10 posts/day/account

  app.get('/api/places/:id/posts', async (req) => {
    const { id } = req.params as { id: string };
    return { posts: await postsForPlace(options.pool, id) };
  });

  app.post('/api/places/:id/posts', async (req, reply) => {
    // Either signed-in role can post; the author identity sets the ranking.
    const spotterToken = tokenFrom(req, 'guaca_spotter');
    const touristToken = tokenFrom(req, 'guaca_tourist');
    let spotterId: string | null = null;
    let touristId: string | null = null;
    if (spotterToken) {
      spotterId = (await verifySpotterToken(spotterToken, sessionSecret())).spotterId;
    }
    if (!spotterId && touristToken) {
      touristId = (await verifyTouristToken(touristToken, sessionSecret())).touristId;
    }
    if (!spotterId && !touristId) return reply.code(401).send({ error: 'login required' });
    if (!postLimiter(spotterId ?? touristId!)) {
      return reply.code(429).send({ error: 'too many posts today' });
    }

    const { id } = req.params as { id: string };
    const body = req.body as {
      text?: string;
      mediaUrl?: string;
      rating?: number;
      lat?: number;
      lon?: number;
    };
    const text = body.text?.trim() ?? '';
    if (text.length === 0 || text.length > 500) {
      return reply.code(400).send({ error: 'text must be 1-500 characters' });
    }
    const mediaUrl = body.mediaUrl?.trim() || null;
    if (mediaUrl && !MEDIA_URL_RE.test(mediaUrl)) {
      return reply
        .code(400)
        .send({ error: 'mediaUrl must be a TikTok, Instagram, YouTube or Facebook link' });
    }
    // Presence check: reviews (stars) only count when made AT the place.
    const hasGeo = typeof body.lat === 'number' && typeof body.lon === 'number';
    const place = await options.pool.query(
      hasGeo
        ? `select id, ST_DWithin(location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, 200) as at_place
           from places where id = $1 and verification_status = 'verified'`
        : `select id, false as at_place from places where id = $1 and verification_status = 'verified'`,
      hasGeo ? [id, body.lat, body.lon] : [id],
    );
    if (place.rows.length === 0) return reply.code(404).send({ error: 'place not found' });
    const visited = Boolean(place.rows[0]!.at_place);
    // Stars from someone who wasn't there are stripped, not stored.
    const rating =
      visited && typeof body.rating === 'number' && body.rating >= 1 && body.rating <= 5
        ? Math.round(body.rating)
        : null;

    const created = await addPlacePost(options.pool, {
      placeId: id,
      spotterId,
      touristId,
      body: text,
      mediaUrl,
      visited,
      rating,
    });
    return reply.code(201).send({ ok: true, id: created.id, visited, rating });
  });

  /* Favorites — a private save-list; never shown as counts on the map. */
  const requireTourist = async (req: import('fastify').FastifyRequest) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return null;
    return (await verifyTouristToken(token, sessionSecret())).touristId;
  };

  app.post('/api/places/:id/favorite', async (req, reply) => {
    const touristId = await requireTourist(req);
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const { id } = req.params as { id: string };
    await addFavorite(options.pool, touristId, id);
    return reply.code(201).send({ ok: true });
  });

  app.delete('/api/places/:id/favorite', async (req, reply) => {
    const touristId = await requireTourist(req);
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const { id } = req.params as { id: string };
    await removeFavorite(options.pool, touristId, id);
    return { ok: true };
  });

  app.get('/api/tourist/favorites', async (req, reply) => {
    const touristId = await requireTourist(req);
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    return { favorites: await listFavorites(options.pool, touristId) };
  });

  /*
   * "Tell me when it's verified" — opt-in link between an anonymous question
   * and the account, held in its own cascade-deleted table so questions stay
   * anonymous unless the tourist explicitly asks to hear back.
   */
  app.post('/api/questions/:id/notify', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'login required' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const { id } = req.params as { id: string };
    const question = await options.pool.query(
      `select id from questions where id = $1 and answered = false`,
      [id],
    );
    if (question.rows.length === 0) return reply.code(404).send({ error: 'question not found' });
    await options.pool.query(
      `insert into question_notifications (question_id, tourist_id)
       values ($1, $2) on conflict do nothing`,
      [id, touristId],
    );
    return reply.code(201).send({ ok: true });
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
    // §4.1 — asks are free and unlimited in product terms, but they belong
    // to an account: identity is what makes demand signals gameable-proof.
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'login required' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    if (!askLimiter(touristId)) {
      return reply.code(429).send({ error: 'rate limited — try again soon' });
    }
    const inference = await resolveInference();
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
      headers: {
        // Forward the caller's identity — /api/ask is gated (§4.1).
        ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
      },
      payload: { text: body.text, language: body.language, lat: 10.4716, lon: -68.0056 },
    }).then((res) => reply.code(res.statusCode).send(res.body));
  });

  app.post('/api/register', async (req, reply) => {
    const body = req.body as {
      role?: string;
      name?: string;
      contact?: string;
      language?: string;
      details?: Record<string, unknown>;
    };
    const role = body.role;
    if (role !== 'traveler' && role !== 'spotter' && role !== 'owner') {
      return reply.code(400).send({ error: 'role must be traveler, spotter or owner' });
    }
    const name = body.name?.trim();
    const contact = body.contact?.trim().toLowerCase();
    if (!name || !contact) {
      return reply.code(400).send({ error: 'name and contact required' });
    }
    if (name.length > 200 || contact.length > 200) {
      return reply.code(400).send({ error: 'name and contact must be under 200 characters' });
    }
    const details =
      body.details && typeof body.details === 'object' && !Array.isArray(body.details)
        ? body.details
        : {};
    if (JSON.stringify(details).length > 4000) {
      return reply.code(400).send({ error: 'details must be under 4000 characters' });
    }
    const recorded = await recordRegistration(options.pool, {
      role,
      name,
      contact,
      language: body.language === 'es' ? 'es' : 'en',
      details,
    });
    return reply.code(201).send({ ok: true, id: recorded.id, role: recorded.role });
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
    const token = tokenFrom(req, 'guaca_spotter');
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
    const token = tokenFrom(req, 'guaca_spotter');
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
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? 'changeme-32-bytes-min!',
    );
    const { spotterId } = await verifySpotterToken(token, secret);
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const rows = await spotterEarnings(options.pool, spotterId);
    return { rows };
  });

  app.get('/api/spotter/me', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const res = await options.pool.query(
      `select id, name, language from spotters where id = $1 and active`,
      [spotterId],
    );
    const row = res.rows[0];
    if (!row) return reply.code(401).send({ error: 'unauthorized' });
    return { id: row.id, name: row.name, language: row.language };
  });

  // Provisional places by OTHER spotters near the caller — the L6 worklist.
  app.get('/api/spotter/confirmations', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const { lat, lon } = req.query as { lat?: string; lon?: string };
    const latN = Number(lat ?? 10.4716);
    const lonN = Number(lon ?? -68.0056);
    if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
      return reply.code(400).send({ error: 'invalid lat/lon' });
    }
    const pending = await pendingProvisionalNear(options.pool, latN, lonN, 5000, spotterId);
    return { pending };
  });

  // The submission is complete — run the check ladder (§7.4). The cheap
  // rungs run always; if vision is unreachable the case escalates to the
  // operator instead of silently passing.
  app.post('/api/spotter/submissions/:placeId/complete', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const { placeId } = req.params as { placeId: string };
    const inference = await resolveInference();
    const result = await runSubmissionVerification(options.pool, inference, objectStore, {
      placeId,
      spotterId,
    });
    if (!result.ok) return reply.code(result.code).send({ error: result.error });
    return reply.send(result.verdict);
  });

  app.post('/api/spotter/places', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const body = req.body as {
      name?: string;
      category?: string;
      landmarkDescription?: string;
      lat?: number;
      lon?: number;
      missionId?: string;
    };
    if (!body.name || !body.category || !body.landmarkDescription ||
        typeof body.lat !== 'number' || typeof body.lon !== 'number') {
      return reply.code(400).send({ error: 'name, category, landmarkDescription, lat, lon required' });
    }
    // Same area/h3 derivation the demand pipeline uses — one geometry truth.
    const geo = await options.pool.query<{ area_id: string | null; h3_8: string }>(
      `select (select a.id from areas a
                where ST_Covers(a.geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)
                limit 1) as area_id,
              h3_lat_lng_to_cell(point($2, $1), 8)::text as h3_8`,
      [body.lat, body.lon],
    );
    const areaId = geo.rows[0]?.area_id;
    if (!areaId) return reply.code(400).send({ error: 'outside any coverage area' });
    // Mission linkage is validated BEFORE creating anything: a retry after a
    // mid-flow failure replays the existing submission instead of minting an
    // orphan duplicate place (review finding).
    if (body.missionId) {
      const mres = await options.pool.query(
        `select id, status, spotter_id, result_place_id from missions where id = $1`,
        [body.missionId],
      );
      const mission = mres.rows[0];
      if (!mission || mission.spotter_id !== spotterId) {
        return reply.code(404).send({ error: 'mission not found' });
      }
      if (mission.status === 'submitted' && mission.result_place_id) {
        return reply
          .code(200)
          .send({ ok: true, placeId: mission.result_place_id, status: 'provisional' });
      }
      if (mission.status !== 'accepted') {
        return reply.code(409).send({ error: `mission is ${mission.status}` });
      }
    }
    const result = await submitPlace(options.pool, {
      name: body.name,
      category: body.category,
      landmarkDescription: body.landmarkDescription,
      lat: body.lat,
      lon: body.lon,
      h3_8: geo.rows[0]!.h3_8,
      spotterId,
      areaId,
    });
    if (!result.ok || !result.placeId) {
      return reply.code(409).send({ error: result.reason ?? 'submission rejected' });
    }
    if (body.missionId) {
      await options.pool.query(
        `update missions set status = 'submitted', submitted_at = now(), result_place_id = $1
         where id = $2 and spotter_id = $3 and status = 'accepted'`,
        [result.placeId, body.missionId, spotterId],
      );
    }
    return reply.code(201).send({ ok: true, placeId: result.placeId, status: 'provisional' });
  });

  // L6 — the second local. A DIFFERENT spotter confirms on the ground;
  // only then does the place become verified (witness_count = 2).
  app.post('/api/spotter/places/:id/confirm', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    // L6 runs after the ladder, never instead of it (§7.4).
    if (!(await confirmAllowed(options.pool, id))) {
      return reply.code(409).send({ error: 'VERIFICATION_PENDING' });
    }
    // Atomic: witness-2, the audit row, the mission and the gap move
    // together or not at all (review finding).
    const client = await options.pool.connect();
    try {
      await client.query('begin');
      const result = await confirmSecondLocal(client, id, spotterId);
      if (!result.ok) {
        await client.query('rollback');
        return reply.code(409).send({ error: result.reason });
      }
      await client.query(
        `insert into verification_runs (place_id, checks, decision, decided_by)
         values ($1, $2, 'verified', 'second_local')`,
        [id, JSON.stringify({ secondLocal: spotterId })],
      );
      await client.query(
        `update missions set status = 'verified' where result_place_id = $1 and status = 'submitted'`,
        [id],
      );
      // Close the loop: the gap that demanded this place is now filled.
      await client.query(
        `update gaps set status = 'filled', updated_at = now()
         where status = 'commissioned'
           and id in (select gap_id from missions where result_place_id = $1)`,
        [id],
      );
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }

    // "Tell me when it's verified" — fire opted-in notifications for
    // unanswered questions in this place's area+category. Best-effort and
    // post-commit: a mail failure must never un-verify a place. Rows are
    // deleted first so a crash means a missed mail, never a duplicate.
    void (async () => {
      try {
        const placeRow = await options.pool.query(
          `select name, category, area_id from places where id = $1`,
          [id],
        );
        const place = placeRow.rows[0] as
          | { name: string; category: string; area_id: string }
          | undefined;
        if (!place || !emailSender.sendPlaceVerified) return;
        const optIns = await options.pool.query(
          `delete from question_notifications qn
           using questions qu, tourists t
           where qu.id = qn.question_id
             and t.id = qn.tourist_id
             and qu.answered = false
             and qu.area_id = $1
             and qu.intent->>'category' = $2
           returning t.email, t.language`,
          [place.area_id, place.category],
        );
        for (const row of optIns.rows as Array<{ email: string; language: string }>) {
          await emailSender.sendPlaceVerified(row.email, place.name, row.language);
        }
      } catch {
        /* notification is a courtesy, never a failure path */
      }
    })();

    return { ok: true, status: 'verified' };
  });

  // Resolve a QR without minting a session — used by the printable cards.
  app.get('/api/v/:qrToken/info', async (req, reply) => {
    const { qrToken } = req.params as { qrToken: string };
    const property = await propertyByQrToken(options.pool, qrToken);
    if (!property) return reply.code(404).send({ error: 'qr not found' });
    return { propertyName: property.name };
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
      propertyId: session.propertyId,
      propertyName: session.propertyName,
      language: session.language,
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
