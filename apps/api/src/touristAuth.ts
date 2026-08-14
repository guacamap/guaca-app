import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomInt } from 'node:crypto';
import type { EmailSender } from './email.js';

export interface TouristAuthDb {
  upsertLoginCode(input: {
    email: string;
    language?: string;
    attributedPropertyId?: string | null;
    codeHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }>;
  consumeLoginCode(email: string, codeHash: string): Promise<{
    id: string;
    email: string;
    language: string;
    attributedPropertyId: string | null;
  } | null>;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * §4.1 — tourist email one-time code, mirroring the spotter flow: the code
 * is compared by hash only and consumed on use. The sender is injected so
 * tests capture codes instead of sending mail.
 */
export async function requestTouristCode(
  db: TouristAuthDb,
  input: { email: string; language?: string; attributedPropertyId?: string | null },
  sender: EmailSender,
): Promise<{ ok: true } | { ok: false; reason: 'BAD_EMAIL' }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, reason: 'BAD_EMAIL' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const language = input.language === 'es' ? 'es' : 'en';
  await db.upsertLoginCode({
    email,
    language,
    attributedPropertyId: input.attributedPropertyId ?? null,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  await sender.sendLoginCode(email, code, language);
  return { ok: true };
}

export type TouristLoginResult =
  | { ok: true; token: string; tourist: { id: string; email: string; language: string } }
  | { ok: false; reason: 'BAD_CODE' };

export async function verifyTouristLogin(
  db: TouristAuthDb,
  input: { email: string; code: string },
  secret: Uint8Array,
): Promise<TouristLoginResult> {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'BAD_CODE' };

  const tourist = await db.consumeLoginCode(email, hashCode(code));
  if (!tourist) return { ok: false, reason: 'BAD_CODE' };

  const token = await new SignJWT({ sub: tourist.id, role: 'tourist' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
  return {
    ok: true,
    token,
    tourist: { id: tourist.id, email: tourist.email, language: tourist.language },
  };
}

export async function verifyTouristToken(
  token: string,
  secret: Uint8Array,
): Promise<{ touristId: string | null }> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'tourist') return { touristId: null };
    return { touristId: typeof payload.sub === 'string' ? payload.sub : null };
  } catch {
    return { touristId: null };
  }
}
