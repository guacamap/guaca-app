import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import {
  merchantLogin,
  requestMerchantCode,
  verifyMerchantToken,
  type MerchantAuthDb,
  type MerchantLookup,
} from '../../src/merchantAuth.ts';

const SECRET = new TextEncoder().encode('test-secret-at-least-32-bytes-long!!');
const MERCHANT_ID = '00000000-0000-4000-8000-00000000ad01';
const EMAIL = 'elena@scenario.guaca.live';

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function roster(initial: Partial<MerchantLookup> = {}) {
  const row: MerchantLookup = {
    id: MERCHANT_ID,
    email: EMAIL,
    name: 'Elena Vargas',
    language: 'es',
    loginCodeHash: null,
    loginCodeExpiresAt: null,
    ...initial,
  };
  const db: MerchantAuthDb = {
    findByEmail: async (email) => (email === EMAIL ? { ...row } : null),
    setLoginCode: async (_email, codeHash, expiresAt) => {
      row.loginCodeHash = codeHash;
      row.loginCodeExpiresAt = expiresAt;
    },
    clearLoginCode: async () => {
      row.loginCodeHash = null;
      row.loginCodeExpiresAt = null;
    },
  };
  return { db, row };
}

function sender(mode: 'dev' | 'live' = 'live') {
  const sent: Array<{ email: string; code: string; language: string }> = [];
  return {
    sent,
    sender: {
      mode,
      sendLoginCode: async (email: string, code: string, language: string) => {
        sent.push({ email, code, language });
      },
    },
  };
}

describe('merchant email door', () => {
  it('refuses an email that is not on the merchant list', async () => {
    const { db } = roster();
    const { sender: s, sent } = sender();
    const r = await requestMerchantCode(db, s, { email: 'stranger@example.com' });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(sent).toHaveLength(0);
  });

  it('issues a hashed six-digit code in the merchant language', async () => {
    const { db, row } = roster();
    const { sender: s, sent } = sender();
    const r = await requestMerchantCode(db, s, { email: ' Elena@Scenario.Guaca.Live ' });
    expect(r.ok).toBe(true);
    expect(sent[0]!.code).toMatch(/^\d{6}$/);
    expect(sent[0]!.language).toBe('es');
    expect(row.loginCodeHash).toBe(hash(sent[0]!.code));
  });

  it('signs a merchant JWT and rejects a tourist role token', async () => {
    const { db } = roster();
    const { sender: s, sent } = sender();
    await requestMerchantCode(db, s, { email: EMAIL });
    const login = await merchantLogin(db, { email: EMAIL, code: sent[0]!.code }, SECRET);
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    const { payload } = await jwtVerify(login.token, SECRET);
    expect(payload.role).toBe('merchant');
    expect(payload.sub).toBe(MERCHANT_ID);
    const ok = await verifyMerchantToken(login.token, SECRET);
    expect(ok.merchantId).toBe(MERCHANT_ID);

    const tourist = await new SignJWT({ sub: MERCHANT_ID, role: 'tourist' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(SECRET);
    expect(await verifyMerchantToken(tourist, SECRET)).toEqual({ merchantId: null });
  });
});
