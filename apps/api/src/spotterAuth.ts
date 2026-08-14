import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';

export interface SpotterLookup {
  id: string;
  phone: string;
  name: string;
  loginCodeHash: string | null;
}

export interface SpotterAuthDb {
  findSpotterByPhone(phone: string): Promise<SpotterLookup | null>;
}

export type LoginResult =
  | { ok: true; token: string; spotter: { id: string; name: string } }
  | { ok: false; reason: 'NOT_FOUND' | 'BAD_CODE' | 'NO_CODE' };

/**
 * T7.1 — spotter login with phone + operator-issued one-time code. The code
 * is compared by hash only; a successful login issues a JWT meant for an
 * httpOnly cookie (SESSION_SECRET).
 */
export async function spotterLogin(
  db: SpotterAuthDb,
  input: { phone: string; code: string },
  secret: Uint8Array,
): Promise<LoginResult> {
  const spotter = await db.findSpotterByPhone(input.phone);
  if (!spotter) return { ok: false, reason: 'NOT_FOUND' };
  if (!spotter.loginCodeHash) return { ok: false, reason: 'NO_CODE' };

  const hash = createHash('sha256').update(input.code).digest('hex');
  if (hash !== spotter.loginCodeHash) return { ok: false, reason: 'BAD_CODE' };

  const token = await new SignJWT({ sub: spotter.id, name: spotter.name, role: 'spotter' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
  return { ok: true, token, spotter: { id: spotter.id, name: spotter.name } };
}

export async function verifySpotterToken(
  token: string,
  secret: Uint8Array,
): Promise<{ spotterId: string | null }> {
  try {
    const { payload } = await jwtVerify(token, secret);
    // Role-bound: a tourist JWT must never authenticate spotter routes.
    if (payload.role !== 'spotter') return { spotterId: null };
    return { spotterId: typeof payload.sub === 'string' ? payload.sub : null };
  } catch {
    return { spotterId: null };
  }
}
