import { createHmac, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

export const SHOWCASE_EMAIL = 'viajero@guaca.live';
export const SHOWCASE_SPOTTER_ID = '1355c71b-c085-48bb-a170-4f5bf38ff417';
const TTL_SECONDS = 8 * 60 * 60;

/** Server-only, explicit opt-in. No universal code, frontend secret, or roster bypass. */
function config() {
  const code = process.env.SHOWCASE_ACCESS_CODE ?? '';
  const secret = process.env.SESSION_SECRET ?? '';
  if (process.env.SHOWCASE_ACCESS_ENABLED !== 'true' || !/^[0-9]{6}$/.test(code)
    || /^(\d)\1{5}$/.test(code) || secret.length < 32) return null;
  return { code, secret, version: createHmac('sha256', secret).update(`showcase:${code}`).digest('hex') };
}

export function installShowcaseAccess(app: FastifyInstance, pool: Pool) {
  // Shared between both roles and aliases: distributing guesses doesn't reset the budget.
  // This deployment runs one API process; multiple replicas require a shared limiter.
  let failures = 0;
  let windowStart = Date.now();
  app.addHook('preHandler', async (req, reply) => {
    const path = req.routeOptions.url ?? req.url.split('?')[0]!;
    const auth = /^\/api\/(tourist|spotter)\/auth\/(request-code|verify)$/.exec(path);
    const legacy = path === '/api/spotter/login';
    const logout = path === '/api/spotter/logout' || path === '/api/tourist/logout';
    const cfg = config();
    const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const tokens = new Set([req.cookies?.guaca_spotter, req.cookies?.guaca_tourist, bearer].filter((s): s is string => !!s));

    // Guard every route (cookie AND bearer), not just today's submit/confirm endpoints.
    for (const token of tokens) {
      let payload;
      try { payload = (await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET ?? ''))).payload; }
      catch { continue; } // The ordinary route still performs its own authentication.
      if (typeof payload.showcaseVersion !== 'string') continue;
      if (auth || legacy || logout) continue;
      if (!cfg || payload.showcaseVersion !== cfg.version) {
        return reply.code(401).send({ error: 'Access has expired. Sign in again.' });
      }
      if (payload.role === 'spotter') {
        if (!['GET', 'HEAD'].includes(req.method)) {
          return reply.code(403).send({ error: 'This account has read-only Spotter access.' });
        }
        if (path === '/api/spotter/me') {
          return reply.send({ id: SHOWCASE_SPOTTER_ID, name: 'Viajero', language: 'es', photoUrl: null, level: 1, totalPoints: 0, readOnly: true });
        }
      } else if (payload.role === 'tourist' && !['GET', 'HEAD'].includes(req.method)) {
        const safeWrite = (req.method === 'POST' && ['/api/ask', '/api/plan', '/api/tourist/hello'].includes(path))
          || (['POST', 'DELETE'].includes(req.method) && path === '/api/places/:id/favorite')
          || (req.method === 'PATCH' && path === '/api/tourist/me');
        if (!safeWrite) return reply.code(403).send({ error: 'This action is not available for this account.' });
      }
    }

    if ((!auth && !legacy) || req.method !== 'POST') return;
    const body = (req.body ?? {}) as { email?: unknown; code?: unknown; language?: unknown };
    if (typeof body.email !== 'string' || body.email.trim().toLowerCase() !== SHOWCASE_EMAIL || !cfg) return;
    if (auth?.[2] === 'request-code') return reply.send({ ok: true, delivery: 'access-code' });

    if (Date.now() - windowStart >= 15 * 60_000) { failures = 0; windowStart = Date.now(); }
    if (failures >= 5) return reply.code(429).send({ error: 'Too many attempts. Try again in 15 minutes.' });
    if (typeof body.code !== 'string' || !/^[0-9]{6}$/.test(body.code)
      || !timingSafeEqual(Buffer.from(body.code), Buffer.from(cfg.code))) {
      failures++;
      return reply.code(401).send({ error: 'Invalid access code.' });
    }

    const role = legacy ? 'spotter' : auth![1]!;
    let id = SHOWCASE_SPOTTER_ID;
    let language = body.language === 'en' ? 'en' : 'es';
    if (role === 'tourist') {
      const result = await pool.query<{ id: string; language: string }>(
        `insert into tourists (email, language, last_login_at) values ($1, $2, now())
         on conflict (email) do update set last_login_at = now() returning id, language`,
        [SHOWCASE_EMAIL, language],
      );
      id = result.rows[0]!.id;
      language = result.rows[0]!.language;
    } else {
      // No synthetic witness row: never eligible for commissioning, verification, or payout.
      const collision = await pool.query('select id from spotters where id = $1', [SHOWCASE_SPOTTER_ID]);
      if (collision.rows.length) return reply.code(503).send({ error: 'Access configuration needs attention.' });
    }
    const token = await new SignJWT({ sub: id, role, ...(role === 'spotter' ? { name: 'Viajero' } : {}), showcaseVersion: cfg.version })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${TTL_SECONDS}s`)
      .sign(new TextEncoder().encode(cfg.secret));
    return reply
      .clearCookie(role === 'tourist' ? 'guaca_spotter' : 'guaca_tourist', cookieOptions)
      .setCookie(`guaca_${role}`, token, { ...cookieOptions, maxAge: TTL_SECONDS })
      .send({ ok: true, language, ...(role === 'spotter' ? { name: 'Viajero', readOnly: true } : {}) });
  });
}
