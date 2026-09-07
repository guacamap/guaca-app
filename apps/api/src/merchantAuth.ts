import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomInt } from 'node:crypto';

export interface MerchantLookup {
  id: string;
  email: string;
  name: string;
  language: string;
  loginCodeHash: string | null;
  loginCodeExpiresAt: Date | null;
}

export interface MerchantAuthDb {
  findByEmail(email: string): Promise<MerchantLookup | null>;
  setLoginCode(email: string, codeHash: string, expiresAt: Date): Promise<void>;
  clearLoginCode(merchantId: string): Promise<void>;
}

export interface MerchantCodeSender {
  mode?: 'dev' | 'live';
  sendLoginCode(email: string, code: string, language: string): Promise<void>;
}

export type MerchantRequestResult = { ok: true } | { ok: false; reason: 'NOT_FOUND' };

export type MerchantLoginResult =
  | { ok: true; token: string; merchant: { id: string; name: string; email: string } }
  | { ok: false; reason: 'NOT_FOUND' | 'BAD_CODE' | 'NO_CODE' | 'EXPIRED' };

const CODE_TTL_MS = 10 * 60_000;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Venue-scoped merchant door. Same email-code pattern as operators and
 * spotters. The merchant_accounts table is the allowlist: an unknown
 * address does not create an account.
 */
export async function requestMerchantCode(
  db: MerchantAuthDb,
  sender: MerchantCodeSender,
  input: { email: string },
): Promise<MerchantRequestResult> {
  const email = normalise(input.email);
  const merchant = await db.findByEmail(email);
  if (!merchant) return { ok: false, reason: 'NOT_FOUND' };

  const devBypass = sender.mode === 'dev' && process.env.NODE_ENV !== 'production';
  const code = devBypass ? '000000' : String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.setLoginCode(email, hashCode(code), new Date(Date.now() + CODE_TTL_MS));
  await sender.sendLoginCode(email, code, merchant.language);
  return { ok: true };
}

export async function merchantLogin(
  db: Pick<MerchantAuthDb, 'findByEmail' | 'clearLoginCode'>,
  input: { email: string; code: string },
  secret: Uint8Array,
): Promise<MerchantLoginResult> {
  const email = normalise(input.email);
  const merchant = await db.findByEmail(email);
  if (!merchant) return { ok: false, reason: 'NOT_FOUND' };

  const devBypass = process.env.NODE_ENV !== 'production' && input.code === '000000';
  if (!devBypass) {
    if (!merchant.loginCodeHash) return { ok: false, reason: 'NO_CODE' };
    if (merchant.loginCodeExpiresAt && merchant.loginCodeExpiresAt < new Date()) {
      return { ok: false, reason: 'EXPIRED' };
    }
    if (hashCode(input.code.trim()) !== merchant.loginCodeHash) {
      return { ok: false, reason: 'BAD_CODE' };
    }
  }

  const token = await new SignJWT({ sub: merchant.id, name: merchant.name, role: 'merchant' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
  await db.clearLoginCode(merchant.id);
  return {
    ok: true,
    token,
    merchant: { id: merchant.id, name: merchant.name, email: merchant.email },
  };
}

export async function verifyMerchantToken(
  token: string,
  secret: Uint8Array,
): Promise<{ merchantId: string | null }> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'merchant') return { merchantId: null };
    return { merchantId: typeof payload.sub === 'string' ? payload.sub : null };
  } catch {
    return { merchantId: null };
  }
}
