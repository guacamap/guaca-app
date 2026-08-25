import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomInt } from 'node:crypto';

export interface SpotterLookup {
  id: string;
  email: string;
  name: string;
  language: string;
  loginCodeHash: string | null;
  loginCodeExpiresAt: Date | null;
}

export interface SpotterAuthDb {
  findSpotterByEmail(email: string): Promise<SpotterLookup | null>;
  setLoginCode(email: string, codeHash: string, expiresAt: Date): Promise<void>;
}

export interface SpotterCodeSender {
  mode?: 'dev' | 'live';
  sendLoginCode(email: string, code: string, language: string): Promise<void>;
}

export type RequestResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' };

export type LoginResult =
  | { ok: true; token: string; spotter: { id: string; name: string } }
  | { ok: false; reason: 'NOT_FOUND' | 'BAD_CODE' | 'NO_CODE' | 'EXPIRED' };

const CODE_TTL_MS = 10 * 60_000;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Spotter sign-in is the same door tourists and operators use: email, then a
 * six digit code that lives ten minutes and is used once. What differs is the
 * allowlist behind it. A tourist email creates an account; a spotter email
 * must already be on the roster, put there by an operator. Nobody becomes a
 * witness by signing in.
 */
export async function requestSpotterCode(
  db: SpotterAuthDb,
  sender: SpotterCodeSender,
  input: { email: string },
): Promise<RequestResult> {
  const email = normalise(input.email);
  const spotter = await db.findSpotterByEmail(email);
  if (!spotter) return { ok: false, reason: 'NOT_FOUND' };

  const devBypass = sender.mode === 'dev' && process.env.NODE_ENV !== 'production';
  const reviewEmail = process.env.REVIEW_SPOTTER_EMAIL?.trim().toLowerCase();
  const reviewCode = process.env.REVIEW_CODE?.trim();
  const isReview = Boolean(reviewEmail && reviewCode && email === reviewEmail);

  const code = isReview
    ? reviewCode!
    : devBypass
      ? '000000'
      : String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.setLoginCode(email, hashCode(code), new Date(Date.now() + CODE_TTL_MS));
  // The store reviewer's code is fixed and known to them; mailing it to a
  // mailbox nobody reads would only bounce.
  if (!isReview) await sender.sendLoginCode(email, code, spotter.language);
  return { ok: true };
}

export async function spotterLogin(
  db: Pick<SpotterAuthDb, 'findSpotterByEmail'>,
  input: { email: string; code: string },
  secret: Uint8Array,
): Promise<LoginResult> {
  const email = normalise(input.email);
  const spotter = await db.findSpotterByEmail(email);
  if (!spotter) return { ok: false, reason: 'NOT_FOUND' };

  // Dev bypass, mirroring the tourist gate: 000000 signs in any roster
  // spotter outside production. Production always requires a real code.
  const devBypass = process.env.NODE_ENV !== 'production' && input.code === '000000';
  const reviewEmail = process.env.REVIEW_SPOTTER_EMAIL?.trim().toLowerCase();
  const reviewCode = process.env.REVIEW_CODE?.trim();
  const isReview = Boolean(reviewEmail && reviewCode && email === reviewEmail && input.code === reviewCode);

  if (!devBypass && !isReview) {
    if (!spotter.loginCodeHash) return { ok: false, reason: 'NO_CODE' };
    if (spotter.loginCodeExpiresAt && spotter.loginCodeExpiresAt < new Date()) {
      return { ok: false, reason: 'EXPIRED' };
    }
    if (hashCode(input.code.trim()) !== spotter.loginCodeHash) return { ok: false, reason: 'BAD_CODE' };
  }

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
