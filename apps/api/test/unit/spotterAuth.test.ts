import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import {
  requestSpotterCode,
  spotterLogin,
  verifySpotterToken,
  type SpotterAuthDb,
  type SpotterLookup,
} from '../../src/spotterAuth.ts';

const SECRET = new TextEncoder().encode('test-secret-at-least-32-bytes-long!!');
const SPOTTER_ID = '00000000-0000-4000-8000-0000000000c1';
const EMAIL = 'yorman@example.com';

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** An in-memory roster with one spotter; mirrors what the db module does. */
function roster(initial: Partial<SpotterLookup> = {}) {
  const row: SpotterLookup = {
    id: SPOTTER_ID, email: EMAIL, name: 'Yorman', language: 'es',
    loginCodeHash: null, loginCodeExpiresAt: null, ...initial,
  };
  const db: SpotterAuthDb = {
    findSpotterByEmail: async (email) => (email === EMAIL ? { ...row } : null),
    setLoginCode: async (_email, codeHash, expiresAt) => { row.loginCodeHash = codeHash; row.loginCodeExpiresAt = expiresAt; },
  };
  return { db, row };
}

function sender(mode: 'dev' | 'live' = 'live') {
  const sent: Array<{ email: string; code: string; language: string }> = [];
  return { sent, sender: { mode, sendLoginCode: async (email: string, code: string, language: string) => { sent.push({ email, code, language }); } } };
}

describe('spotter email door: request a code', () => {
  it('refuses an email that is not on the roster, and sends nothing', async () => {
    const { db } = roster();
    const { sender: s, sent } = sender();
    const r = await requestSpotterCode(db, s, { email: 'stranger@example.com' });
    expect(r).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(sent).toHaveLength(0);
  });

  it('stores a hash with a ten minute expiry and emails a six digit code in the spotter language', async () => {
    const { db, row } = roster();
    const { sender: s, sent } = sender();
    const before = Date.now();
    const r = await requestSpotterCode(db, s, { email: ' Yorman@Example.com ' });
    expect(r.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.email).toBe(EMAIL);
    expect(sent[0]!.language).toBe('es');
    expect(sent[0]!.code).toMatch(/^\d{6}$/);
    expect(row.loginCodeHash).toBe(hash(sent[0]!.code));
    const ttl = row.loginCodeExpiresAt!.getTime() - before;
    expect(ttl).toBeGreaterThan(9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000 + 1000);
  });

  it('never puts the plaintext code in the database', async () => {
    const { db, row } = roster();
    const { sender: s, sent } = sender();
    await requestSpotterCode(db, s, { email: EMAIL });
    expect(row.loginCodeHash).not.toBe(sent[0]!.code);
  });
});

describe('spotter email door: verify', () => {
  it('signs in with the emailed code, once', async () => {
    const { db } = roster();
    const { sender: s, sent } = sender();
    await requestSpotterCode(db, s, { email: EMAIL });
    const r = await spotterLogin(db, { email: EMAIL, code: sent[0]!.code }, SECRET);
    expect(r.ok).toBe(true);
    const { payload } = await jwtVerify((r as { token: string }).token, SECRET);
    expect(payload.sub).toBe(SPOTTER_ID);
    expect(payload.role).toBe('spotter');
  });

  it('rejects a wrong code, an unknown email, and a missing code', async () => {
    const { db } = roster({ loginCodeHash: hash('123456'), loginCodeExpiresAt: new Date(Date.now() + 60_000) });
    expect((await spotterLogin(db, { email: EMAIL, code: '654321' }, SECRET))).toMatchObject({ ok: false, reason: 'BAD_CODE' });
    expect((await spotterLogin(db, { email: 'nobody@example.com', code: '123456' }, SECRET))).toMatchObject({ ok: false, reason: 'NOT_FOUND' });
    const { db: empty } = roster();
    expect((await spotterLogin(empty, { email: EMAIL, code: '123456' }, SECRET))).toMatchObject({ ok: false, reason: 'NO_CODE' });
  });

  it('rejects an expired code', async () => {
    const { db } = roster({ loginCodeHash: hash('123456'), loginCodeExpiresAt: new Date(Date.now() - 1000) });
    expect((await spotterLogin(db, { email: EMAIL, code: '123456' }, SECRET))).toMatchObject({ ok: false, reason: 'EXPIRED' });
  });

  it('verifySpotterToken accepts a valid token and rejects a tampered one', async () => {
    const { db } = roster({ loginCodeHash: hash('123456'), loginCodeExpiresAt: new Date(Date.now() + 60_000) });
    const r = await spotterLogin(db, { email: EMAIL, code: '123456' }, SECRET) as { token: string };
    expect((await verifySpotterToken(r.token, SECRET)).spotterId).toBe(SPOTTER_ID);
    const forged = await new SignJWT({ sub: SPOTTER_ID, role: 'spotter' }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode('wrong-secret'));
    expect((await verifySpotterToken(forged, SECRET)).spotterId).toBeNull();
  });

  it('rejects a tourist token: roles never cross', async () => {
    const touristToken = await new SignJWT({ sub: SPOTTER_ID, role: 'tourist' })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(SECRET);
    expect((await verifySpotterToken(touristToken, SECRET)).spotterId).toBeNull();
  });
});

describe('dev bypass and review account', () => {
  let prevEnv: string | undefined;
  beforeEach(() => { prevEnv = process.env.NODE_ENV; });
  afterEach(() => { process.env.NODE_ENV = prevEnv; delete process.env.REVIEW_SPOTTER_EMAIL; delete process.env.REVIEW_CODE; });

  it('000000 signs in any roster email outside production, even with no code minted', async () => {
    process.env.NODE_ENV = 'development';
    const { db } = roster();
    expect((await spotterLogin(db, { email: EMAIL, code: '000000' }, SECRET)).ok).toBe(true);
  });

  it('a dev sender hands out 000000 so the bypass and the emailed code agree', async () => {
    process.env.NODE_ENV = 'development';
    const { db } = roster();
    const { sender: s, sent } = sender('dev');
    await requestSpotterCode(db, s, { email: EMAIL });
    expect(sent[0]!.code).toBe('000000');
  });

  it('never bypasses in production, and still requires a roster email', async () => {
    process.env.NODE_ENV = 'production';
    const { db } = roster();
    expect((await spotterLogin(db, { email: EMAIL, code: '000000' }, SECRET)).ok).toBe(false);
    expect((await spotterLogin(db, { email: 'x@example.com', code: '000000' }, SECRET)).ok).toBe(false);
  });

  it('the review account uses its fixed code and is never emailed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REVIEW_SPOTTER_EMAIL = EMAIL;
    process.env.REVIEW_CODE = '424242';
    const { db } = roster();
    const { sender: s, sent } = sender();
    await requestSpotterCode(db, s, { email: EMAIL });
    expect(sent).toHaveLength(0);
    expect((await spotterLogin(db, { email: EMAIL, code: '424242' }, SECRET)).ok).toBe(true);
    expect((await spotterLogin(db, { email: EMAIL, code: '111111' }, SECRET)).ok).toBe(false);
  });
});
