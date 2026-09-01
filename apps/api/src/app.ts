import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import type { Pool } from 'pg';
import { randomUUID, createHash, timingSafeEqual, randomInt } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { q, storePhoto, missionsForSpotter, acceptMission, spotterEarnings, sessionForQr, recordRegistration, recordQuestion, upsertTouristLoginCode, consumeTouristLoginCode, touristById, submitPlace, confirmSecondLocal, pendingProvisionalNear, propertyByQrToken, deleteTourist, addPlacePost, postsForPlace, addFavorite, removeFavorite, listFavorites, listTrips, tripById, tripBySlug, deleteTrip, trendsForPlaces, zoneDemand, areaSummaries, unenrichedCandidates, saveDraft, stewardDrafts, approveDraft, rejectDraft, rankedGaps, operatorCommission, listMissions, cancelMission, payMission, addSpotter, listSpotters, issueLoginCode, pendingOperatorQueue, operatorVerify, operatorMapData, recentActivity, operatorConflicts, listIssues, createIssue, resolveIssue,
  upsertOperator, setOperatorLoginCode, consumeOperatorLoginCode, operatorByEmail, listOperators,
  findSpotterByEmail, setSpotterLoginCode, clearSpotterLoginCode } from '@guaca/db';
import { createObjectStore, type ObjectStore } from './objectStore.js';
import { runSubmissionVerification, confirmAllowed } from './verificationService.js';
import type { Inference } from '@guaca/agents';
import { ask, planTrip } from './plannerService.js';
import { draftCandidate } from '@guaca/agents';
import { suggestionsNear } from './suggestionsService.js';
import { TripRequestSchema, type TripPace } from '@guaca/shared';
import { opsStreamPlugin } from './opsStream.js';
import { requestSpotterCode, spotterLogin, verifySpotterToken } from './spotterAuth.js';
import { requestTouristCode, verifyTouristLogin, verifyTouristToken } from './touristAuth.js';
import { createEmailSender, type EmailSender } from './email.js';
import { recordingInference } from './aiRecorder.js';

export interface AppOptions {
  pool: Pool;
  inference?: Inference;
  minCandidates?: number;
  /** Injected by tests to capture login codes instead of sending mail. */
  emailSender?: EmailSender;
  /** Injected by tests; defaults to MinIO/S3 from env. */
  objectStore?: ObjectStore;
  /** Weather, sea, sun, holiday, rates, alerts per area; tests inject a stub. */
  contextProvider?: import('./context.js').ContextProvider;
}

/** §4.1 — auth tokens arrive as an httpOnly cookie (web) or a Bearer
 *  header (wrapper/native), through the same verification path. */
function tokenFrom(req: FastifyRequest, cookieName: string): string | undefined {
  const fromCookie = req.cookies?.[cookieName];
  if (fromCookie) return fromCookie;
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
}

/** Session cookie attributes, shared by the set and clear paths. A clearing
 *  cookie must carry the SAME attributes as the one it replaces, or a strict
 *  client keeps the original and the session outlives "log out". */
function sessionCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
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

  // Liveness + readiness in one: the process answers, and the database
  // actually takes a query. No auth by design — this is what the container
  // healthcheck, the smoke gate, and an uptime monitor poll.
  app.get('/healthz', async (_req, reply) => {
    try {
      await options.pool.query('select 1');
      return reply.send({ ok: true, db: true, sha: process.env.GIT_SHA ?? null });
    } catch {
      return reply.code(503).send({ ok: false, db: false, sha: process.env.GIT_SHA ?? null });
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
    // Trend badges — computed by the scheduler's trend cycle, each one a
    // literally-true statement about recorded behaviour. Raw counts stay
    // server-side; the map only ever sees the badge.
    const trends = await trendsForPlaces(
      options.pool,
      places.map((p) => p.id),
    );
    return {
      places: places.map((p) => ({
        ...p,
        ...(byPlace.get(p.id) ?? { postsCount: 0, avgRating: null, ratingCount: 0 }),
        trendBadge: trends.get(p.id)?.badge ?? null,
      })),
    };
  });

  // Areas with honest stats — the country→city picker's data source.
  // Public like /api/places: names and counts, nothing personal.
  app.get('/api/areas', async () => {
    return { areas: await areaSummaries(options.pool) };
  });

  // Zone demand — the persisted people-per-zone snapshot the scheduler
  // recomputes each cycle. Public like /api/places: aggregate counts of
  // anonymous sessions, never question text, never identities.
  app.get('/api/zones/demand', async (req) => {
    const { areaId } = req.query as { areaId?: string };
    // Scoped to the selected area when given: demand shown must be demand
    // for where the tourist is looking.
    return { zones: await zoneDemand(options.pool, areaId ?? null) };
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
      `select id, name, category, source,
              ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
              public_phone, public_website, public_socials, public_address, public_source, public_subcategory
       from places
       where verification_status = 'candidate' and source in ('osm_candidate', 'overture_candidate')
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

  /**
   * Operator auth: the same shared OPERATOR_TOKEN the CLI uses, over
   * Authorization: Bearer. Hash-then-compare so token length never leaks
   * through timing. 501 when unset — a route that silently accepts because
   * the token is blank would be the worst failure mode.
   */
  /*
   * Operator auth, hardened in layers:
   * 1. IP allowlist (optional, OPERATOR_ALLOWED_IPS) — blocks at the
   *    network layer before the token is even examined
   * 2. Brute-force lockout — 10 failures from one IP locks that IP out
   *    of operator routes for 15 minutes (reset on success)
   * 3. Timing-safe token comparison (hash-then-compare)
   * 4. Failed attempts audit-logged — the trail shows who was trying
   */
  const operatorFailures = new Map<string, { count: number; lockedUntil: number }>();
  const OPERATOR_MAX_FAILURES = 10;
  const OPERATOR_LOCKOUT_MS = 15 * 60 * 1000;

  const clientIp = (req: FastifyRequest): string => {
    return req.ip ?? 'unknown';
  };

  interface OperatorProfile {
    id: string; email: string; name: string; role: string;
  }

  const verifyOperatorJwt = async (bearer: string): Promise<OperatorProfile | null> => {
    try {
      const { payload } = await jwtVerify(bearer, sessionSecret());
      if (payload.role !== 'operator' && payload.role !== 'admin' && payload.role !== 'moderator') return null;
      return await operatorByEmail(options.pool, String(payload.sub));
    } catch { return null; }
  };

  const requireOperator = async (req: FastifyRequest, reply: import('fastify').FastifyReply): Promise<boolean> => {
    const expected = process.env.OPERATOR_TOKEN;
    if (!expected) {
      reply.code(501).send({ error: 'OPERATOR_TOKEN is not configured' });
      return false;
    }

    // Layer 1: IP allowlist (no cost when unset)
    const allowed = process.env.OPERATOR_ALLOWED_IPS?.split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed && allowed.length > 0) {
      const ip = clientIp(req);
      if (!allowed.includes(ip) && !allowed.includes('*')) {
        reply.code(403).send({ error: 'not authorized from this network' });
        return false;
      }
    }

    // Layer 2: lockout check
    const ip = clientIp(req);
    const state = operatorFailures.get(ip);
    if (state && state.lockedUntil > Date.now()) {
      const waitMin = Math.ceil((state.lockedUntil - Date.now()) / 60000);
      reply.code(429).send({ error: `locked — try again in ${waitMin} min` });
      return false;
    }

    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : '';
    let ok = false;
    if (bearer.length > 0) {
      const profile = await verifyOperatorJwt(bearer);
      if (profile) ok = true;
      else ok = timingSafeEqual(
        createHash('sha256').update(bearer).digest(),
        createHash('sha256').update(expected).digest(),
      );
    }

    if (!ok) {
      // Layer 2: count the failure
      const current = operatorFailures.get(ip) ?? { count: 0, lockedUntil: 0 };
      current.count += 1;
      if (current.count >= OPERATOR_MAX_FAILURES) {
        current.lockedUntil = Date.now() + OPERATOR_LOCKOUT_MS;
        current.count = 0;
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          level: 'warn',
          event: 'operator.lockout',
          agent: 'system',
          detail: { ip, lockedMinutes: OPERATOR_LOCKOUT_MS / 60000 },
        }));
      }
      operatorFailures.set(ip, current);

      // Layer 4: audit the failed attempt (every 5th to avoid log spam
      // under sustained attack — the lockout event above catches the rest)
      if (current.count % 5 === 0) {
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          level: 'warn',
          event: 'operator.auth_failed',
          agent: 'system',
          detail: { ip, consecutiveFailures: current.count },
        }));
      }

      reply.code(401).send({ error: 'operator token required' });
      return false;
    }

    // Success: clear the counter
    operatorFailures.delete(ip);
    return true;
  };

  const emailSender = options.emailSender ?? createEmailSender();
  const objectStore = options.objectStore ?? createObjectStore();
  // One provider for the process, wrapped once so every call lands in
  // ai_calls. Tests inject their own inference and bypass the recorder.
  let recorded: Inference | null = null;
  const resolveInference = async (): Promise<Inference> => {
    if (options.inference) return options.inference;
    if (recorded) return recorded;
    recorded = recordingInference(options.pool, await rawInference(), process.env.INFERENCE_MODEL ?? 'unknown');
    return recorded;
  };
  const rawInference = async () =>
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
  const planLimiter = rateLimiter(10, 60 * 60 * 1000); // 10 trips/hour/account — model-shaped work
  // 5 codes/15min/email in production; generous in dev so the bypass button
  // and repeated test runs don't lock testers out of their own build.
  const codeLimiter = rateLimiter(
    process.env.NODE_ENV === 'production' ? 5 : 200,
    15 * 60 * 1000,
  );

  app.post('/api/tourist/auth/request-code', async (req, reply) => {
    const body = req.body as {
      email?: string;
      language?: string;
      propertyId?: string;
      /** Delete flow: never create an account just to send a code. */
      existingOnly?: boolean;
    };
    if (!body.email) return reply.code(400).send({ error: 'email is required' });
    if (!codeLimiter(body.email.trim().toLowerCase())) {
      return reply.code(429).send({ error: 'too many codes requested — wait a few minutes' });
    }
    /*
     * The delete-account flow must not CREATE the account it is about to
     * delete: an unknown address used to get a row, a real sign-in code by
     * mail, and then "your account has been deleted" for something that
     * never existed. With existingOnly we answer identically either way
     * (no account enumeration) but touch nothing.
     */
    if (body.existingOnly) {
      const known = await options.pool.query(`select 1 from tourists where email = $1`, [
        body.email.trim().toLowerCase(),
      ]);
      if (known.rows.length === 0) return { ok: true };
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
        ...sessionCookie(),
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
      .clearCookie('guaca_tourist', sessionCookie())
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
    return reply.clearCookie('guaca_tourist', sessionCookie()).send({ ok: true });
  });

  app.post('/api/spotter/logout', async (_req, reply) => {
    return reply.clearCookie('guaca_spotter', sessionCookie()).send({ ok: true });
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
   * Report a post. Play requires both a way to flag user content and action
   * on flags, so a post auto-hides at the threshold and lands in the
   * operator's queue either way. Hiding is reversible — an operator decides.
   */
  const REPORTS_TO_HIDE = 2;

  /** How close a second local must physically be to confirm a place. */
  const CONFIRM_RADIUS_M = Number(process.env.CONFIRM_RADIUS_M ?? 150);

  app.post('/api/posts/:id/report', async (req, reply) => {
    const spotterToken = tokenFrom(req, 'guaca_spotter');
    const touristToken = tokenFrom(req, 'guaca_tourist');
    let key: string | null = null;
    if (spotterToken) {
      const { spotterId } = await verifySpotterToken(spotterToken, sessionSecret());
      if (spotterId) key = `spotter:${spotterId}`;
    }
    if (!key && touristToken) {
      const { touristId } = await verifyTouristToken(touristToken, sessionSecret());
      if (touristId) key = `tourist:${touristId}`;
    }
    if (!key) return reply.code(401).send({ error: 'login required' });

    const { id } = req.params as { id: string };
    const body = req.body as { reason?: string };
    const reason = ['spam', 'wrong', 'offensive', 'other'].includes(body.reason ?? '')
      ? body.reason!
      : 'other';
    const post = await options.pool.query(`select id from place_posts where id = $1`, [id]);
    if (post.rows.length === 0) return reply.code(404).send({ error: 'post not found' });

    await options.pool.query(
      `insert into place_post_reports (post_id, reporter_key, reason)
       values ($1, $2, $3) on conflict (post_id, reporter_key) do nothing`,
      [id, key, reason],
    );
    const count = await options.pool.query(
      `select count(*)::int as n from place_post_reports where post_id = $1`,
      [id],
    );
    const n = (count.rows[0]?.n as number) ?? 0;
    if (n >= REPORTS_TO_HIDE) {
      await options.pool.query(`update place_posts set status = 'hidden' where id = $1`, [id]);
    }
    return reply.code(201).send({ ok: true, hidden: n >= REPORTS_TO_HIDE });
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

  /** Cancel a watch — the tourist stops waiting on that question. */
  app.delete('/api/questions/:id/notify', async (req, reply) => {
    const touristId = await requireTourist(req);
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const { id } = req.params as { id: string };
    await options.pool.query(
      `delete from question_notifications where question_id = $1 and tourist_id = $2`,
      [id, touristId],
    );
    return { ok: true };
  });

  /**
   * The last option on a refusal: the traveller asks for a local to be sent.
   * The same gap agent the scheduler runs, scoped to the one gap this
   * question belongs to, with the score floor dropped (the demand is
   * explicit) and every other guard intact: one open mission per gap, the
   * daily cap, the reward cap, a real spotter in the zone. The traveller is
   * also put on the question's watch, so the answer reaches them.
   */
  app.post('/api/questions/:id/mission', async (req, reply) => {
    const touristId = await requireTourist(req);
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const { id } = req.params as { id: string };
    const { requestMission } = await import('./missionRequest.js');
    const result = await requestMission(options.pool, id, touristId);
    if (result.status === 'not_found') return reply.code(404).send({ error: 'question not found' });
    if (result.status === 'no_intent' || result.status === 'no_gap') return reply.code(409).send({ status: result.status });
    return reply.send(result);
  });

  /**
   * What this tourist is waiting on, and what already came back. Questions
   * stay anonymous: the only link is the opt-in row the tourist created.
   */
  app.get('/api/tourist/watching', async (req, reply) => {
    const touristId = await requireTourist(req);
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const res = await options.pool.query(
      `select qn.question_id, qn.notified_at, qu.raw_text, qu.created_at
       from question_notifications qn
       join questions qu on qu.id = qn.question_id
       where qn.tourist_id = $1
       order by qu.created_at desc
       limit 50`,
      [touristId],
    );
    const rows = res.rows as Array<{
      question_id: string;
      notified_at: string | null;
      raw_text: string;
      created_at: string;
    }>;
    return {
      pending: rows
        .filter((r) => !r.notified_at)
        .map((r) => ({ questionId: r.question_id, text: r.raw_text, askedAt: r.created_at })),
      fulfilled: rows.filter((r) => r.notified_at).length,
    };
  });

  /** The tourist's own posts — their contribution record ("passport"). */
  app.get('/api/tourist/posts', async (req, reply) => {
    const touristId = await requireTourist(req);
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const res = await options.pool.query(
      `select pp.id, pp.body, pp.media_url, pp.visited, pp.rating, pp.created_at,
              p.id as place_id, p.name as place_name, p.category
       from place_posts pp
       join places p on p.id = pp.place_id
       where pp.tourist_id = $1 and pp.status = 'visible'
       order by pp.created_at desc
       limit 50`,
      [touristId],
    );
    return { posts: res.rows };
  });

  /**
   * Attach a villa after the fact — for guests who never scanned the QR.
   * First writer wins, mirroring the QR attribution rule.
   */
  app.post('/api/tourist/villa-code', async (req, reply) => {
    const touristId = await requireTourist(req);
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const body = req.body as { code?: string };
    const code = body.code?.trim().toLowerCase();
    if (!code) return reply.code(400).send({ error: 'code is required' });
    const property = await propertyByQrToken(options.pool, code.startsWith('qr-') ? code : `qr-${code}`);
    if (!property) return reply.code(404).send({ error: 'code not found' });
    await options.pool.query(
      `update tourists set attributed_property_id = coalesce(attributed_property_id, $1)
       where id = $2`,
      [property.id, touristId],
    );
    return { ok: true, propertyName: property.name };
  });

  /** What a local knows right now around a point: for the app's header line. */
  app.get('/api/context', async (req, reply) => {
    const q = req.query as { lat?: string; lon?: string };
    const lat = Number(q.lat ?? 10.4716);
    const lon = Number(q.lon ?? -68.0056);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return reply.code(400).send({ error: 'lat and lon required' });
    const { areaAt, contextFor } = await import('./plannerService.js');
    const area = await areaAt(options.pool, lat, lon);
    const ctx = await contextFor(options.contextProvider, area, lat, lon);
    return reply.header('cache-control', 'public, max-age=300').send({ area: area ? { slug: area.slug, name: area.name, country: area.country, timezone: area.timezone } : null, context: ctx });
  });

  app.post('/api/ask', async (req, reply) => {
    const body = req.body as {
      text?: string;
      language?: string;
      lat?: number;
      lon?: number;
      /** The last few turns of the thread, oldest first, so Guaca can converse. */
      history?: Array<{ role: 'user' | 'guaca'; text: string }>;
      /** The latest refused question in the thread, for "yes, send someone". */
      lastQuestionId?: string | null;
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
    const history = Array.isArray(body.history)
      ? body.history
          .filter((m) => m && (m.role === 'user' || m.role === 'guaca') && typeof m.text === 'string')
          .slice(-8)
          .map((m) => ({ role: m.role, text: m.text.slice(0, 400) }))
      : [];
    const result = await ask(
      options.pool,
      {
        text: body.text,
        language: body.language ?? 'en',
        lat: body.lat ?? 10.4716,
        lon: body.lon ?? -68.0056,
        history,
        lastQuestionId: typeof body.lastQuestionId === 'string' ? body.lastQuestionId : null,
        touristId,
      },
      {
        minCandidates: options.minCandidates ?? Number(process.env.PLANNER_MIN_CANDIDATES ?? 3),
        inference,
        ...(options.contextProvider ? { contextProvider: options.contextProvider } : {}),
      },
    );
    return reply.send(result);
  });

  app.post('/api/plan', async (req, reply) => {
    // The trip endpoint: the same guarded pipeline as /api/ask, shaped by
    // days and pace, ranked by distance x trend, and SAVED as a shareable
    // trip. It used to be a hardcoded-lat/lon proxy of /api/ask — a trip
    // deserves its own contract.
    const parsed = TripRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid trip request', detail: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'login required' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    if (!planLimiter(touristId)) {
      return reply.code(429).send({ error: 'rate limited — try again soon' });
    }
    const inference = await resolveInference();
    const result = await planTrip(
      options.pool,
      {
        touristId,
        text: parsed.data.text,
        language: parsed.data.language,
        lat: parsed.data.lat,
        lon: parsed.data.lon,
        days: parsed.data.days,
        pace: parsed.data.pace as TripPace,
        ...(parsed.data.interests ? { interests: parsed.data.interests } : {}),
      },
      {
        minCandidates: options.minCandidates ?? Number(process.env.PLANNER_MIN_CANDIDATES ?? 3),
        inference,
      },
    );
    return reply.send(result);
  });

  app.get('/api/trips', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'login required' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    return reply.send({ trips: await listTrips(options.pool, touristId) });
  });

  app.get('/api/trips/:id', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'login required' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const { id } = req.params as { id: string };
    const trip = await tripById(options.pool, id, touristId);
    if (!trip) return reply.code(404).send({ error: 'not found' });
    return reply.send({ trip });
  });

  app.delete('/api/trips/:id', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'login required' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const { id } = req.params as { id: string };
    const ok = await deleteTrip(options.pool, id, touristId);
    if (!ok) return reply.code(404).send({ error: 'not found' });
    return reply.send({ ok: true });
  });

  // The public share view: anyone holding the link reads the trip. No auth
  // by design — a WhatsApp recipient may not have (or want) an account, and
  // a trip contains only verified places and the question that made it.
  // There is no update path anywhere; sharing is read-only by construction.
  app.get('/api/t/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const trip = await tripBySlug(options.pool, slug);
    if (!trip) return reply.code(404).send({ error: 'not found' });
    return reply.send({ trip });
  });

  /*
   * The AI steward — machine-drafted candidate enrichment for the team to
   * confirm by hand. NOT an agent: no loop, no scheduler; an operator runs
   * a batch, drafts land in a review queue, and approval only enriches a
   * CANDIDATE (tourist visibility still requires a Spotter's physical
   * verification under the two-witness rule). Tourists have no route to
   * anything here — every path requires the operator token.
   */
  app.post('/api/operator/steward/enrich', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const body = (req.body ?? {}) as { limit?: number };
    const limit = Math.max(1, Math.min(Number(body.limit) || 10, 50));
    const inference = await resolveInference();
    const candidates = await unenrichedCandidates(options.pool, { limit });
    let drafted = 0;
    let skipped = 0;
    for (const c of candidates) {
      const outcome = await draftCandidate(inference, c);
      if (outcome.kind === 'skipped') {
        skipped += 1;
        continue;
      }
      await saveDraft(options.pool, {
        candidateId: c.id,
        model: 'inference',
        draft: outcome.draft,
      });
      drafted += 1;
    }
    return { drafted, skipped, considered: candidates.length };
  });

  app.get('/api/operator/steward/drafts', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { status } = req.query as { status?: string };
    const s = status === 'approved' || status === 'rejected' ? status : 'pending';
    return { drafts: await stewardDrafts(options.pool, s) };
  });

  app.post('/api/operator/steward/drafts/:id/approve', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { note?: string };
    const res = await approveDraft(options.pool, id, 'operator', body.note);
    if (!res.ok) return reply.code(res.reason === 'not found' ? 404 : 409).send({ error: res.reason });
    return { draft: res.draft };
  });

  app.post('/api/operator/steward/drafts/:id/reject', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { note?: string };
    const res = await rejectDraft(options.pool, id, 'operator', body.note ?? '');
    if (!res.ok) return reply.code(res.reason === 'not found' ? 404 : 409).send({ error: res.reason });
    return { draft: res.draft };
  });

  /*
   * The admin panel's API — every operator capability the CLI has, behind
   * the same token, with an audit row for every mutation (the CLI paths
   * for commission/spotters/payouts never wrote operator_actions; these
   * routes do, so the panel is the auditable surface).
   */
  const audit = async (action: string, targetType: string, targetId: string, extra?: Record<string, unknown>) => {
    await options.pool.query(
      `insert into operator_actions (operator, action, target_type, target_id, reason, before_state, after_state)
       values ('operator', $1, $2, $3, $4, '{}'::jsonb, $5::jsonb)`,
      [action, targetType, targetId, extra?.note ?? null, JSON.stringify(extra ?? {})],
    );
  };

  app.get('/api/operator/map', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    return operatorMapData(options.pool);
  });

  app.get('/api/operator/activity', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    return { events: await recentActivity(options.pool) };
  });

  app.get('/api/operator/conflicts', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    return { conflicts: await operatorConflicts(options.pool) };
  });

  app.get('/api/operator/issues', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { status } = req.query as { status?: string };
    return { issues: await listIssues(options.pool, status) };
  });

  app.post('/api/operator/issues', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const body = (req.body ?? {}) as { title?: string; detail?: string; kind?: string; priority?: string };
    if (!body.title || body.title.trim().length < 3) {
      return reply.code(400).send({ error: 'title (3+ chars) required' });
    }
    const issue = await createIssue(options.pool, {
      title: body.title.trim(),
      ...(body.detail ? { detail: body.detail } : {}),
      ...(body.kind ? { kind: body.kind } : {}),
      ...(body.priority ? { priority: body.priority } : {}),
    });
    await audit('issue.create', 'issue', issue.id, { title: body.title, kind: issue.kind });
    return issue;
  });

  app.post('/api/operator/issues/:id/resolve', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { status?: string; note?: string };
    const status = body.status === 'wont_fix' ? 'wont_fix' : body.status === 'in_progress' ? 'in_progress' : 'resolved';
    const issue = await resolveIssue(options.pool, id, status, body.note ?? '');
    if (!issue) return reply.code(404).send({ error: 'not found' });
    await audit('issue.resolve', 'issue', id, { status, note: body.note });
    return issue;
  });

  const operatorCodeLimiter = rateLimiter(5, 15 * 60 * 1000);

  app.post('/api/operator/auth/request-code', async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return reply.code(400).send({ error: 'valid email required' });
    }
    if (!operatorCodeLimiter(email)) {
      return reply.code(429).send({ error: 'rate limited' });
    }
    const existing = await operatorByEmail(options.pool, email);
    // The operators table IS the whitelist — only pre-registered emails
    // get a code. For an internal tool, an explicit error beats the
    // anti-enumeration silence of consumer apps (and saves a confused
    // operator who typo'd their own email).
    if (!existing) {
      return reply.code(403).send({ error: 'this email is not registered as an operator' });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = createHash('sha256').update(code).digest('hex');
    await setOperatorLoginCode(options.pool, email, codeHash, new Date(Date.now() + 10 * 60_000));
    const sender = emailSender ?? createEmailSender();
    if (sender.mode === 'dev') {
      console.log(`[operator-auth] login code for ${email}: ${code}`);
    } else {
      await sender.sendLoginCode(email, code, 'en');
    }
    return { ok: true };
  });

  app.post('/api/operator/auth/verify', async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string; code?: string };
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim();
    if (!email || !code) return reply.code(400).send({ error: 'email and code required' });
    const codeHash = createHash('sha256').update(code).digest('hex');
    const result = await consumeOperatorLoginCode(options.pool, email, codeHash);
    if (!result.ok || !result.operator) {
      return reply.code(401).send({ error: result.reason ?? 'invalid code' });
    }
    const token = await new SignJWT({
      sub: result.operator.email,
      name: result.operator.name,
      role: result.operator.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(sessionSecret());
    return {
      ok: true, token,
      operator: { email: result.operator.email, name: result.operator.name, role: result.operator.role },
    };
  });

  app.get('/api/operator/auth/me', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const bearer = req.headers.authorization?.slice(7) ?? '';
    const profile = await verifyOperatorJwt(bearer);
    return {
      operator: profile
        ? { email: profile.email, name: profile.name, role: profile.role }
        : { email: 'shared-token', name: 'Operator (shared token)', role: 'admin' },
    };
  });

  /*
   * The allowlist for the panel IS the operators table, managed here.
   * Only an admin may change it. The shared OPERATOR_TOKEN carries no
   * identity and counts as admin: it is the break-glass path that
   * bootstrapped the first account and it stays that way on purpose.
   */
  const callerProfile = async (req: FastifyRequest): Promise<OperatorProfile | null> => {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7) : '';
    return bearer ? verifyOperatorJwt(bearer) : null;
  };
  const requireAdmin = async (req: FastifyRequest, reply: import('fastify').FastifyReply): Promise<OperatorProfile | 'shared' | null> => {
    if (!(await requireOperator(req, reply))) return null;
    const me = await callerProfile(req);
    if (me === null) return 'shared';
    if (me.role !== 'admin') {
      reply.code(403).send({ error: 'admin role required' });
      return null;
    }
    return me;
  };

  app.get('/api/operator/operators', async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return reply;
    return { operators: await listOperators(options.pool) };
  });

  app.post('/api/operator/operators', async (req, reply) => {
    const me = await requireAdmin(req, reply);
    if (!me) return reply;
    const body = (req.body ?? {}) as { email?: string; name?: string; role?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    const name = body.name?.trim() ?? '';
    const role = body.role ?? 'operator';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
      return reply.code(400).send({ error: 'a valid email and a name are required' });
    }
    if (role !== 'admin' && role !== 'operator' && role !== 'moderator') {
      return reply.code(400).send({ error: 'role must be admin, operator or moderator' });
    }
    const op = await upsertOperator(options.pool, { email, name, role });
    await audit('operator.upsert', 'operator', op.id, { email, role, by: me === 'shared' ? 'shared-token' : me.email });
    return op;
  });

  app.post('/api/operator/operators/:id/active', async (req, reply) => {
    const me = await requireAdmin(req, reply);
    if (!me) return reply;
    const { id } = req.params as { id: string };
    const { active } = (req.body ?? {}) as { active?: boolean };
    if (typeof active !== 'boolean') return reply.code(400).send({ error: 'active must be true or false' });
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'bad id' });
    if (!active) {
      // Two guards so nobody can lock the panel: you cannot deactivate
      // yourself, and the last active admin stays.
      if (me !== 'shared' && me.id === id) {
        return reply.code(409).send({ error: 'you cannot deactivate your own account' });
      }
      const admins = await options.pool.query<{ n: number }>(
        `select count(*)::int as n from operators where active and role = 'admin' and id <> $1`, [id],
      );
      const target = await options.pool.query<{ role: string }>(`select role from operators where id = $1`, [id]);
      if (target.rows[0]?.role === 'admin' && (admins.rows[0]?.n ?? 0) === 0) {
        return reply.code(409).send({ error: 'this is the last active admin' });
      }
    }
    const res = await options.pool.query(
      `update operators set active = $2 where id = $1 returning id, email, name, role, active, last_login_at as "lastLoginAt"`,
      [id, active],
    );
    if (res.rows.length === 0) return reply.code(404).send({ error: 'not found' });
    await audit(active ? 'operator.reactivate' : 'operator.deactivate', 'operator', id,
      { by: me === 'shared' ? 'shared-token' : me.email });
    return res.rows[0];
  });

  /*
   * Guaca AI observability. questions and verification_runs hold the
   * outcomes; ai_calls holds what sat under them. These routes turn both
   * into rates a person can watch, and run the standing eval set on demand.
   */
  const aiWindow = (req: FastifyRequest) => {
    const h = Number((req.query as { hours?: string }).hours ?? 24);
    return Number.isFinite(h) && h > 0 && h <= 24 * 30 ? h : 24;
  };

  app.get('/api/operator/ai/overview', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const hours = aiWindow(req);
    const calls = await options.pool.query(
      `select purpose, kind, model,
              count(*)::int as calls,
              count(*) filter (where ok)::int as ok,
              count(*) filter (where error_kind = 'schema')::int as schema_errors,
              count(*) filter (where error_kind = 'timeout')::int as timeouts,
              count(*) filter (where not ok and error_kind not in ('schema','timeout'))::int as other_errors,
              round(avg(latency_ms))::int as avg_ms,
              coalesce(percentile_cont(0.95) within group (order by latency_ms), 0)::int as p95_ms,
              coalesce(sum(tokens_in), 0)::int as tokens_in,
              coalesce(sum(tokens_out), 0)::int as tokens_out
         from ai_calls where ts > now() - make_interval(hours => $1)
        group by 1, 2, 3 order by calls desc`,
      [hours],
    );
    const questions = await options.pool.query(
      `select count(*)::int as total,
              count(*) filter (where answered)::int as answered,
              count(*) filter (where not answered)::int as refused
         from questions where created_at > now() - make_interval(hours => $1)`,
      [hours],
    );
    const refusals = await options.pool.query(
      `select coalesce(refusal_reason, 'UNKNOWN') as reason, count(*)::int as n
         from questions where not answered and created_at > now() - make_interval(hours => $1)
        group by 1 order by n desc limit 10`,
      [hours],
    );
    const verification = await options.pool.query(
      `select decision, decided_by, count(*)::int as n
         from verification_runs where created_at > now() - make_interval(hours => $1)
        group by 1, 2 order by n desc`,
      [hours],
    );
    return {
      hours,
      models: { text: process.env.INFERENCE_MODEL ?? null, vision: process.env.INFERENCE_VISION_MODEL ?? null, baseUrl: process.env.INFERENCE_BASE_URL ?? null },
      calls: calls.rows,
      questions: questions.rows[0],
      refusals: refusals.rows,
      verification: verification.rows,
    };
  });

  app.get('/api/operator/ai/failures', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const failedCalls = await options.pool.query(
      `select id, ts, purpose, kind, model, error_kind, error_message, latency_ms
         from ai_calls where not ok order by ts desc limit 50`,
    );
    const refused = await options.pool.query(
      `select q.id, q.created_at as ts, q.raw_text, q.language, q.refusal_reason, a.name as area
         from questions q left join areas a on a.id = q.area_id
        where not q.answered order by q.created_at desc limit 50`,
    );
    return { failedCalls: failedCalls.rows, refusedQuestions: refused.rows };
  });

  app.get('/api/operator/ai/benchmarks', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const rows = await options.pool.query(
      `select id, ts, model, eval_set, rows_source, prompts, passes, plans, fast_path, refusals, schema_errors, errors,
              avg_ms, p95_ms, tokens_in, tokens_out, triggered_by,
              case when row_number() over (order by ts desc) = 1 then results else null end as results
         from ai_benchmarks order by ts desc limit 30`,
    );
    return { benchmarks: rows.rows, running: benchRunning };
  });

  // A short health signal for infra/monitor.sh: enough calls to judge, and
  // the failure rate among them.
  app.get('/api/operator/ai/health', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const r = await options.pool.query(
      `select count(*)::int as calls,
              count(*) filter (where not ok)::int as failed,
              count(*) filter (where error_kind = 'schema')::int as schema_errors
         from ai_calls where ts > now() - interval '1 hour'`,
    );
    const row = r.rows[0] as { calls: number; failed: number; schema_errors: number };
    return { calls: row.calls, failed: row.failed, schemaErrors: row.schema_errors, errorRate: row.calls ? row.failed / row.calls : 0 };
  });

  let benchRunning: { model: string; startedAt: string } | null = null;
  app.post('/api/operator/ai/bench', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    if (benchRunning) return reply.code(409).send({ error: `a benchmark is already running (${benchRunning.model})`, running: benchRunning });
    const body = (req.body ?? {}) as { model?: string };
    const model = body.model?.trim() || (process.env.INFERENCE_MODEL ?? '');
    if (!/^[\w./-]{3,120}$/.test(model)) return reply.code(400).send({ error: 'model id required' });
    const me = await callerProfile(req);
    const triggeredBy = me?.email ?? 'shared-token';
    benchRunning = { model, startedAt: new Date().toISOString() };
    void (async () => {
      try {
        const agents = await import('@guaca/agents');
        // Real verified rows from the best-covered area, or the fixture when
        // coverage is still thin. The row says which, so runs stay comparable.
        const area = await options.pool.query<{ id: string; slug: string; n: number }>(
          `select a.id, a.slug, count(p.id)::int as n from areas a
             join places p on p.area_id = a.id and p.verification_status = 'verified' and p.witness_count >= 2
            group by a.id, a.slug order by n desc limit 1`,
        );
        let places: import('@guaca/agents').CatalogPlace[] = [];
        let rowsSource = 'fixture';
        let origin: { lat: number; lon: number } | undefined;
        if (area.rows[0] && area.rows[0].n >= 12) {
          const pr = await options.pool.query(
            `select id, name, category, landmark_description, st_y(geom::geometry) as lat, st_x(geom::geometry) as lon, verification_status, witness_count from places
              where area_id = $1 and verification_status = 'verified' and witness_count >= 2 order by name`,
            [area.rows[0].id],
          );
          places = pr.rows.map((r) => ({
            id: r.id as string, name: r.name as string, category: r.category as string, landmarkDescription: r.landmark_description as string | null,
            lat: Number(r.lat), lon: Number(r.lon), verificationStatus: r.verification_status as string, witnessCount: r.witness_count as number,
          }));
          origin = { lat: places.reduce((a, p) => a + p.lat, 0) / places.length, lon: places.reduce((a, p) => a + p.lon, 0) / places.length };
          rowsSource = `verified:${area.rows[0].slug}`;
        } else {
          places = [...agents.FIXTURE_ROWS];
        }
        const inference = agents.createProvider({
          INFERENCE_BASE_URL: process.env.INFERENCE_BASE_URL ?? 'http://localhost:8000/v1',
          INFERENCE_API_KEY: process.env.INFERENCE_API_KEY ?? 'changeme',
          INFERENCE_MODEL: model,
          INFERENCE_TIMEOUT_MS: '90000',
          INFERENCE_MAX_RETRIES: '1',
        });
        const summary = await agents.runPlannerEval({
          places, inference, model, ...(origin ? { origin } : {}),
          minCandidates: options.minCandidates ?? Number(process.env.PLANNER_MIN_CANDIDATES ?? 3),
        });
        await options.pool.query(
          `insert into ai_benchmarks (model, eval_set, rows_source, prompts, passes, plans, fast_path, refusals, schema_errors, errors, avg_ms, p95_ms, tokens_in, tokens_out, triggered_by, results)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)`,
          [summary.model, summary.evalSet, rowsSource, summary.prompts, summary.passes, summary.plans, summary.fastPath, summary.refusals, summary.schemaErrors, summary.errors, summary.avgMs, summary.p95Ms, summary.tokensIn, summary.tokensOut, triggeredBy, JSON.stringify(summary.results)],
        );
        await audit('ai.benchmark', 'ai', '00000000-0000-0000-0000-000000000000', { model, passes: summary.passes, prompts: summary.prompts, by: triggeredBy });
      } catch (err) {
        console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'ai.benchmark.failed', detail: { model, error: String(err) } }));
      } finally {
        benchRunning = null;
      }
    })();
    return reply.code(202).send({ started: true, model, triggeredBy });
  });

  app.post('/api/operator/auth/register', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const body = (req.body ?? {}) as { email?: string; name?: string; role?: string };
    if (!body.email?.trim() || !body.name?.trim()) {
      return reply.code(400).send({ error: 'email and name required' });
    }
    const op = await upsertOperator(options.pool, {
      email: body.email, name: body.name,
      ...(body.role ? { role: body.role } : {}),
    });
    return op;
  });

  app.get('/api/operator/overview', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const one = async (sql: string): Promise<number> => {
      const r = await options.pool.query<{ n: number }>(sql);
      return Number(r.rows[0]?.n ?? 0);
    };
    return {
      verifiedPlaces: await one(`select count(*)::int as n from places where verification_status='verified' and witness_count>=2`),
      candidates: await one(`select count(*)::int as n from places where source='osm_candidate'`),
      openGaps: await one(`select count(*)::int as n from gaps where status='open'`),
      offeredMissions: await one(`select count(*)::int as n from missions where status='offered'`),
      verifiedMissions: await one(`select count(*)::int as n from missions where status='verified'`),
      activeSpotters: await one(`select count(*)::int as n from spotters where active`),
      properties: await one(`select count(*)::int as n from properties`),
      questions30d: await one(`select count(*)::int as n from questions where created_at > now() - interval '30 days'`),
      pendingDrafts: await one(`select count(*)::int as n from candidate_drafts where status='pending'`),
      pendingEscalations: await one(`select count(*)::int as n from verification_runs where decision='escalated'`),
      reportedPosts: await one(`select count(*)::int as n from place_post_reports r join place_posts p on p.id=r.post_id where p.status='visible'`),
      pendingRegistrations: await one(`select count(*)::int as n from registrations where handled_at is null`),
      // Movement, not just totals: the panel shows these next to the counts.
      deltas: {
        verifiedWeek: await one(`select count(*)::int as n from places where verification_status='verified' and verified_at > now() - interval '7 days'`),
        gapsWeek: await one(`select count(*)::int as n from gaps where created_at > now() - interval '7 days'`),
        missionsWeek: await one(`select count(*)::int as n from missions where offered_at > now() - interval '7 days'`),
        waitlistToday: await one(`select count(*)::int as n from registrations where created_at >= date_trunc('day', now())`),
        conflictsResolvedWeek: await one(`select count(*)::int as n from operator_actions where created_at > now() - interval '7 days' and (action like 'escalation.%' or action like 'post.%' or action like 'override%')`),
        actionsWeek: await one(`select count(*)::int as n from operator_actions where created_at > now() - interval '7 days'`),
      },
    };
  });

  app.get('/api/operator/gaps', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    return { gaps: await rankedGaps(options.pool) };
  });

  app.post('/api/operator/gaps/:id/commission', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { spotterId?: string; rewardMinor?: number; note?: string };
    const gap = (await rankedGaps(options.pool)).find((g) => g.id === id);
    if (!gap) return reply.code(404).send({ error: 'gap not found' });
    // Default spotter: the first active candidate (the CLI demands a choice;
    // the panel offers one so a tired operator isn't blocked).
    let spotterId = body.spotterId ?? null;
    if (!spotterId) {
      const first = await options.pool.query<{ id: string }>(
        `select id from spotters where active order by level desc limit 1`,
      );
      spotterId = first.rows[0]?.id ?? null;
    }
    if (!spotterId) return reply.code(409).send({ error: 'no active spotter' });
    const res = await operatorCommission(options.pool, {
      gapId: id,
      spotterId,
      brief: `Mission operador para ${gap.category}`,
      targetCategory: gap.category,
      targetH3: gap.h3_8,
      rewardMinor: body.rewardMinor ?? 300,
    });
    await audit('gap.commission', 'gap', id, { ...res, note: body.note });
    return res;
  });

  app.get('/api/operator/missions', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { status } = req.query as { status?: string };
    return { missions: await listMissions(options.pool, status) };
  });

  app.post('/api/operator/missions/:id/cancel', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { reason?: string };
    const res = await cancelMission(options.pool, id, 'operator', body.reason ?? 'admin panel');
    if (!res.ok) return reply.code(404).send({ error: res.reason });
    return res; // cancelMission writes its own audit row
  });

  app.post('/api/operator/missions/:id/pay', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    const m = await options.pool.query<{ spotter_id: string; reward_minor: number; currency: string; status: string }>(
      `select spotter_id, reward_minor, currency, status from missions where id = $1`,
      [id],
    );
    if (m.rows.length === 0) return reply.code(404).send({ error: 'mission not found' });
    const row = m.rows[0]!;
    const res = await payMission(options.pool, {
      missionId: id,
      spotterId: row.spotter_id,
      amountMinor: row.reward_minor,
      currency: row.currency,
    });
    await audit('mission.pay', 'mission', id, { status: res.status });
    return res;
  });

  app.get('/api/operator/spotters', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    return { spotters: await listSpotters(options.pool) };
  });

  app.post('/api/operator/spotters', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const body = (req.body ?? {}) as { name?: string; email?: string; phone?: string; areaId?: string; language?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    if (!body.name?.trim() || !body.phone?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.code(400).send({ error: 'name, a valid email and a phone are required' });
    }
    if (await findSpotterByEmail(options.pool, email)) {
      return reply.code(409).send({ error: 'a spotter with this email already exists' });
    }
    const areaId = body.areaId ?? '00000000-0000-4000-8000-00000000000a';
    const language = body.language === 'en' ? 'en' : 'es';
    const spotter = await addSpotter(options.pool, {
      name: body.name.trim(),
      email,
      phone: body.phone.trim(),
      areaId,
      language,
    });
    await audit('spotter.add', 'spotter', spotter.id, { name: body.name, email, areaId });
    // Tell them they are on the roster and how to get in. Best effort: the
    // roster row is the thing that matters, and mail can fail.
    if (emailSender.sendSpotterWelcome) {
      try { await emailSender.sendSpotterWelcome(email, body.name.trim(), language); }
      catch (err) { console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'spotter.welcome.failed', detail: { spotterId: spotter.id, error: String(err) } })); }
    }
    return spotter;
  });

  app.post('/api/operator/spotters/:id/code', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    // Generate here, store only the hash — the API never learns the codes
    // it did not create, and the panel shows it once for in-person delivery.
    const { randomInt, createHash } = await import('node:crypto');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = createHash('sha256').update(code).digest('hex');
    const issued = await issueLoginCode(options.pool, id, codeHash);
    if (!issued) return reply.code(404).send({ error: 'spotter not found or inactive' });
    await audit('spotter.issue_code', 'spotter', id, {});
    return { code }; // shown once — the operator delivers it in person
  });

  app.get('/api/operator/queue', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    return { queue: await pendingOperatorQueue(options.pool) };
  });

  app.post('/api/operator/verify/:id', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { decision?: string; note?: string };
    if (body.decision !== 'approve' && body.decision !== 'reject') {
      return reply.code(400).send({ error: 'decision must be approve or reject' });
    }
    const res = await operatorVerify(options.pool, id, body.decision === 'approve' ? 'APPROVE' : 'REJECT', 'operator', body.note);
    return res; // operatorVerify writes its own audit row
  });

  app.get('/api/operator/registrations', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const res = await options.pool.query(
      `select id, role, name, contact, details, created_at from registrations
        where handled_at is null order by created_at asc limit 50`,
    );
    return { registrations: res.rows };
  });

  /*
   * The waitlist as demand data: every registration, handled or not, with
   * counts by role and country and the filters the panel needs. The inbox
   * endpoint above is for "what needs a hand"; this one is for "who wants
   * us where", which is what decides the next community to open.
   */
  app.get('/api/operator/waitlist', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const q = req.query as { status?: string; role?: string; q?: string };
    const status = q.status === 'pending' || q.status === 'handled' ? q.status : 'all';
    const role = q.role === 'traveler' || q.role === 'spotter' || q.role === 'owner' ? q.role : null;
    const search = q.q?.trim() ? `%${q.q.trim().slice(0, 80)}%` : null;
    const rows = await options.pool.query(
      `select id, role, name, contact, language,
              coalesce(details->>'where', '') as country,
              coalesce(details->>'countryCode', '') as country_code,
              created_at, handled_at, operator_note
         from registrations
        where ($1 = 'all'
               or ($1 = 'pending' and handled_at is null)
               or ($1 = 'handled' and handled_at is not null))
          and ($2::text is null or role = $2)
          and ($3::text is null or name ilike $3 or contact ilike $3 or details->>'where' ilike $3)
        order by created_at desc
        limit 500`,
      [status, role, search],
    );
    const counts = await options.pool.query(
      `select count(*)::int as total,
              count(*) filter (where handled_at is null)::int as pending,
              count(*) filter (where role = 'traveler')::int as traveler,
              count(*) filter (where role = 'spotter')::int as spotter,
              count(*) filter (where role = 'owner')::int as owner
         from registrations`,
    );
    const byCountry = await options.pool.query(
      `select coalesce(nullif(details->>'where', ''), 'Unknown') as country, count(*)::int as n
         from registrations group by 1 order by n desc, 1 limit 12`,
    );
    return { rows: rows.rows, counts: counts.rows[0], byCountry: byCountry.rows };
  });

  // Whole waitlist as CSV, for the CRM. Exports are audited: they are the
  // one action here that moves personal data out of our database.
  app.get('/api/operator/waitlist.csv', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const res = await options.pool.query(
      `select role, name, contact, language,
              coalesce(details->>'where', '') as country,
              coalesce(details->>'countryCode', '') as country_code,
              created_at, handled_at, coalesce(operator_note, '') as note
         from registrations order by created_at desc`,
    );
    const header = ['role', 'name', 'contact', 'language', 'country', 'country_code', 'created_at', 'handled_at', 'note'];
    const cell = (v: unknown) => {
      const str = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [
      header.join(','),
      ...res.rows.map((r) => header.map((h) => cell((r as Record<string, unknown>)[h])).join(',')),
    ];
    // operator_actions.target_id is a uuid; the nil uuid is the documented
    // target for an action on the whole table rather than one row.
    await audit('waitlist.export', 'waitlist', '00000000-0000-0000-0000-000000000000', { rows: res.rows.length });
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="guaca-waitlist.csv"')
      .send(lines.join('\r\n'));
  });

  app.post('/api/operator/registrations/:id/handle', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { note?: string };
    const res = await options.pool.query(
      `update registrations set handled_at = now(), operator_note = $2 where id = $1 returning id`,
      [id, body.note ?? null],
    );
    if (res.rows.length === 0) return reply.code(404).send({ error: 'not found' });
    await audit('registration.handle', 'registration', id, { note: body.note });
    return { ok: true };
  });

  app.get('/api/operator/posts/reported', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const res = await options.pool.query(
      `select p.id, p.body, p.status, count(r.id)::int as reports,
              coalesce(t.email, s.name, 'spotter') as author
         from place_post_reports r
         join place_posts p on p.id = r.post_id
         left join tourists t on t.id = p.tourist_id
         left join spotters s on s.id = p.spotter_id
        where p.status = 'visible'
        group by p.id, p.body, p.status, t.email, s.name
        order by reports desc limit 50`,
    );
    return { posts: res.rows };
  });

  app.post('/api/operator/posts/:id/hide', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    await options.pool.query(`update place_posts set status = 'hidden' where id = $1`, [id]);
    await audit('post.hide', 'post', id, {});
    return { ok: true };
  });

  app.post('/api/operator/posts/:id/show', async (req, reply) => {
    if (!(await requireOperator(req, reply))) return reply;
    const { id } = req.params as { id: string };
    await options.pool.query(`update place_posts set status = 'visible' where id = $1`, [id]);
    await audit('post.show', 'post', id, {});
    return { ok: true };
  });

  // Grounded recommendations: verified places with honestly-earned trend
  // badges near the caller. Empty list beats a guess — always.
  app.get('/api/suggestions', async (req, reply) => {    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) return reply.code(401).send({ error: 'login required' });
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) return reply.code(401).send({ error: 'login required' });
    const { lat, lon } = req.query as { lat?: string; lon?: string };
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return reply.code(400).send({ error: 'lat and lon are required' });
    }
    return reply.send({
      suggestions: await suggestionsNear(options.pool, { lat: latNum, lon: lonNum }),
    });
  });

  /*
   * The form is public and now triggers outbound mail, so an unthrottled
   * endpoint is a way to burn the Resend quota and to mail addresses an
   * attacker chose. Keyed by IP, not contact: the contact is the thing
   * being varied in a flood.
   */
  const registerLimiter = rateLimiter(5, 60 * 60 * 1000);

  app.post('/api/register', async (req, reply) => {
    if (!registerLimiter(clientIp(req))) {
      return reply.code(429).send({ error: 'too many signups from this connection — try again later' });
    }
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
    /*
     * Confirmation is best-effort by design: the row is the valuable thing,
     * and a mail outage must never turn a captured signup into a 500 that
     * the person reads as "it didn't work". Only for an email contact —
     * the form also accepts a phone, where there is nothing to write to.
     */
    if (contact.includes('@') && emailSender.sendWaitlistConfirmation) {
      try {
        await emailSender.sendWaitlistConfirmation(contact, role, body.language === 'es' ? 'es' : 'en');
      } catch (err) {
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          level: 'warn',
          event: 'waitlist.confirmation.failed',
          detail: { registrationId: recorded.id, error: String(err) },
        }));
      }
    }
    return reply.code(201).send({ ok: true, id: recorded.id, role: recorded.role });
  });

  // Brute force on a 8-char operator code was unlimited; the tourist gate
  // has always been limited.
  const spotterLoginLimiter = rateLimiter(
    process.env.NODE_ENV === 'production' ? 10 : 200,
    15 * 60 * 1000,
  );

  /*
   * The spotter door: email, then a one-time code, exactly like tourists
   * and operators. The roster is the allowlist. An email that is not on it
   * gets an explicit 403 rather than a silent 200: this is an invited
   * group, and a spotter who typo'd their email should not wait for a
   * code that will never come.
   */
  const spotterDb = {
    findSpotterByEmail: (email: string) => findSpotterByEmail(options.pool, email),
    setLoginCode: (email: string, hash: string, expiresAt: Date) => setSpotterLoginCode(options.pool, email, hash, expiresAt),
  };

  app.post('/api/spotter/auth/request-code', async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'valid email required' });
    if (!codeLimiter(email)) {
      return reply.code(429).send({ error: 'too many codes requested — wait a few minutes' });
    }
    const result = await requestSpotterCode(spotterDb, emailSender, { email });
    if (!result.ok) return reply.code(403).send({ error: 'this email is not registered as a spotter' });
    return { ok: true };
  });

  const spotterVerify = async (req: FastifyRequest, reply: import('fastify').FastifyReply) => {
    const body = (req.body ?? {}) as { email?: string; code?: string };
    if (!body.email || !body.code) {
      return reply.code(400).send({ error: 'email and code required' });
    }
    if (!spotterLoginLimiter(body.email.trim().toLowerCase())) {
      return reply.code(429).send({ error: 'too many attempts — wait a few minutes' });
    }
    const result = await spotterLogin(spotterDb, { email: body.email, code: body.code }, sessionSecret());
    if (!result.ok) return reply.code(401).send({ error: result.reason });
    // Single use: a code that signed someone in must never work again.
    await clearSpotterLoginCode(options.pool, result.spotter.id);
    return reply
      .setCookie('guaca_spotter', result.token, {
        ...sessionCookie(),
        // Without maxAge the 7-day JWT died with the WebView process.
        maxAge: 7 * 24 * 60 * 60,
      })
      .send({ ok: true, name: result.spotter.name });
  };
  app.post('/api/spotter/auth/verify', spotterVerify);
  // The old path, kept so an installed wrapper built before this change
  // still reaches the same door.
  app.post('/api/spotter/login', spotterVerify);

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
      `select s.id, s.name, s.language, s.photo_url, s.level,
              coalesce((select sum(m.reward_minor)::int from missions m
                        where m.spotter_id = s.id and m.status in ('verified','paid')), 0)
                as total_points
       from spotters s where s.id = $1 and s.active`,
      [spotterId],
    );
    const row = res.rows[0];
    if (!row) return reply.code(401).send({ error: 'unauthorized' });
    return {
      id: row.id,
      name: row.name,
      language: row.language,
      photoUrl: row.photo_url ?? null,
      level: row.level,
      totalPoints: row.total_points,
    };
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

  /*
   * Monthly ranking — spotters compete on POINTS, not money. Points are
   * the mission reward values of verified/paid missions, attributed to
   * the month they were completed in. Rank is computed over the whole
   * roster so "me" is correct even outside the top list.
   */
  app.get('/api/spotter/ranking', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const res = await options.pool.query(
      `with month_points as (
         select m.spotter_id, sum(m.reward_minor)::int as points, count(*)::int as missions
         from missions m
         where m.status in ('verified', 'paid')
           and coalesce(m.paid_at, m.submitted_at, m.offered_at) >= date_trunc('month', now())
         group by m.spotter_id
       ),
       ranked as (
         select s.id, s.name, s.photo_url, s.level,
                coalesce(mp.points, 0) as points,
                coalesce(mp.missions, 0) as missions,
                rank() over (order by coalesce(mp.points, 0) desc) as rank
         from spotters s
         left join month_points mp on mp.spotter_id = s.id
         where s.active
       )
       select * from ranked where rank <= 10 or id = $1
       order by rank asc, name asc`,
      [spotterId],
    );
    const rows = res.rows as Array<{
      id: string; name: string; photo_url: string | null; level: number;
      points: number; missions: number; rank: string | number;
    }>;
    const me = rows.find((r) => r.id === spotterId) ?? null;
    return {
      month: new Date().toISOString().slice(0, 7),
      ranking: rows.filter((r) => Number(r.rank) <= 10).map((r) => ({ ...r, rank: Number(r.rank) })),
      me: me ? { rank: Number(me.rank), points: me.points, missions: me.missions } : null,
    };
  });

  /** The pins that carry this spotter's name — their body of work. */
  app.get('/api/spotter/places', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const res = await options.pool.query(
      `select id, name, category, verified_at,
              ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon
       from places
       where created_by_spotter_id = $1 and verification_status = 'verified'
       order by verified_at desc nulls last
       limit 50`,
      [spotterId],
    );
    return { places: res.rows };
  });

  /**
   * Quality record — the counterweight to points: being right matters more
   * than being fast. Counts decisive verification runs on this spotter's
   * own submissions.
   */
  app.get('/api/spotter/stats', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const res = await options.pool.query(
      `select
         count(*) filter (where p.verification_status = 'verified')::int as verified,
         count(*) filter (where p.verification_status = 'rejected')::int as rejected,
         count(*) filter (where p.verification_status = 'provisional')::int as awaiting,
         (select count(*)::int from verification_runs vr
           join places p2 on p2.id = vr.place_id
          where p2.created_by_spotter_id = $1 and vr.decision = 'rejected') as rejected_runs,
         (select count(*)::int from places p3
           where p3.confirmed_by_spotter_id = $1) as confirmed_for_others
       from places p
       where p.created_by_spotter_id = $1`,
      [spotterId],
    );
    const r = res.rows[0] as {
      verified: number; rejected: number; awaiting: number;
      rejected_runs: number; confirmed_for_others: number;
    };
    const decided = r.verified + r.rejected_runs;
    return {
      verified: r.verified,
      rejected: r.rejected_runs,
      awaiting: r.awaiting,
      confirmedForOthers: r.confirmed_for_others,
      firstPassRate: decided > 0 ? Math.round((r.verified / decided) * 100) : null,
    };
  });

  /** Their face rides every pin they verify — let them set it themselves. */
  app.post('/api/spotter/me/photo', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const body = req.body as { imageBase64?: string };
    if (!body.imageBase64) return reply.code(400).send({ error: 'imageBase64 is required' });
    const bytes = Buffer.from(body.imageBase64, 'base64');
    if (bytes.byteLength === 0 || bytes.byteLength > 4_000_000) {
      return reply.code(400).send({ error: 'image must be 1 byte to 4 MB' });
    }
    const key = `spotters/${spotterId}.jpg`;
    await objectStore.put(key, bytes, 'image/jpeg');
    // Cache-busting suffix so the new face shows up immediately.
    const url = `/api/spotter/${spotterId}/photo?v=${Date.now()}`;
    await options.pool.query(`update spotters set photo_url = $1 where id = $2`, [url, spotterId]);
    return reply.code(201).send({ ok: true, photoUrl: url });
  });

  /** Public: spotter faces appear on pins and in the posts feed. */
  app.get('/api/spotter/:id/photo', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: 'bad id' });
    const bytes = await objectStore.get(`spotters/${id}.jpg`);
    if (!bytes) return reply.code(404).send({ error: 'not found' });
    return reply
      .header('content-type', 'image/jpeg')
      .header('cache-control', 'public, max-age=86400')
      .send(bytes);
  });

  /*
   * Images the transactional emails reference. They live in the object
   * store rather than on the marketing site so an email never depends on a
   * web deploy having happened, and they are served from this origin, which
   * is already public. The allowlist is the whole security model: nothing
   * outside it can be addressed, so no traversal and no enumeration.
   */
  const EMAIL_ASSETS: Record<string, string> = {
    'hero-app.jpg': 'image/jpeg',
    'wordmark.png': 'image/png',
  };
  app.get('/api/assets/email/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const mime = EMAIL_ASSETS[name];
    if (!mime) return reply.code(404).send({ error: 'not found' });
    const bytes = await objectStore.get(`email-assets/${name}`);
    if (!bytes) return reply.code(404).send({ error: 'not found' });
    return reply
      .header('content-type', mime)
      .header('cache-control', 'public, max-age=604800, immutable')
      .send(bytes);
  });

  /*
   * Spotter map: earning opportunities with real coordinates. Mission
   * targets come from the gap's h3 cell centre (h3-pg does the inverse of
   * the clustering function); confirmables carry the place's own point.
   */
  app.get('/api/spotter/opportunities', async (req, reply) => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) return reply.code(401).send({ error: 'unauthorized' });
    const res = await options.pool.query(
      `select m.id, m.status, m.target_category as category, m.reward_minor,
              g.question_count,
              (h3_cell_to_lat_lng(g.h3_8::h3index))[1] as lat,
              (h3_cell_to_lat_lng(g.h3_8::h3index))[0] as lon
       from missions m
       join gaps g on g.id = m.gap_id
       where m.spotter_id = $1 and m.status in ('offered', 'accepted')`,
      [spotterId],
    );
    return { opportunities: res.rows };
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
      /** Promote this open-data candidate instead of a fresh row. */
      candidateId?: string;
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
      ...(body.candidateId ? { candidateId: body.candidateId } : {}),
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
    /*
     * "A second local confirms it ON THE GROUND" is the product's core
     * claim, and it was enforced nowhere: the route took no coordinates,
     * so a place 120 km away could be confirmed. The confirming spotter
     * must now prove proximity, server-side, exactly like the L2 rung.
     */
    const body = (req.body ?? {}) as { lat?: number; lon?: number };
    if (typeof body.lat !== 'number' || typeof body.lon !== 'number') {
      return reply.code(400).send({ error: 'LOCATION_REQUIRED' });
    }
    const near = await options.pool.query(
      `select ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3) as ok
       from places where id = $4`,
      [body.lat, body.lon, CONFIRM_RADIUS_M, id],
    );
    if (near.rows.length === 0) return reply.code(404).send({ error: 'place not found' });
    if (!near.rows[0]!.ok) return reply.code(422).send({ error: 'TOO_FAR_TO_CONFIRM' });
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
          `update question_notifications qn
              set notified_at = now()
             from questions qu, tourists t
            where qu.id = qn.question_id
              and t.id = qn.tourist_id
              and qn.notified_at is null
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
         p.public_phone, p.public_website, p.public_socials, p.public_address, p.public_source, p.public_subcategory, p.contact_confirmed_at,
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
