import { describe, expect, it } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import {
  spotterLogin,
  verifySpotterToken,
  LoginResult,
} from '../../src/spotterAuth.ts';
import { createHash } from 'node:crypto';

const SECRET = new TextEncoder().encode('test-secret-at-least-32-bytes-long!!');
const SPOTTER_ID = '00000000-0000-4000-8000-0000000000c1';
const PHONE = '+58 412 000 0001';

function codeHash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

const db = {
  findSpotterByPhone: async (phone: string) =>
    phone === PHONE
      ? { id: SPOTTER_ID, phone, name: 'Yorman', loginCodeHash: codeHash('ABCD1234') }
      : null,
};

describe('T7.1 — spotter login (phone + code → httpOnly JWT)', () => {
  it('rejects a wrong code', async () => {
    const r: LoginResult = await spotterLogin(db, { phone: PHONE, code: 'WRONG' }, SECRET);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('BAD_CODE');
  });

  it('rejects an unknown phone', async () => {
    const r: LoginResult = await spotterLogin(db, { phone: '+58 999', code: 'ABCD1234' }, SECRET);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NOT_FOUND');
  });

  it('issues a JWT for the correct code', async () => {
    const r: LoginResult = await spotterLogin(db, { phone: PHONE, code: 'ABCD1234' }, SECRET);
    expect(r.ok).toBe(true);
    expect(r.token).toBeTruthy();
    const { payload } = await jwtVerify(r.token!, SECRET);
    expect(payload.sub).toBe(SPOTTER_ID);
  });

  it('verifySpotterToken accepts a valid token and rejects a tampered one', async () => {
    const r = await spotterLogin(db, { phone: PHONE, code: 'ABCD1234' }, SECRET);
    const ok = await verifySpotterToken(r.token!, SECRET);
    expect(ok.spotterId).toBe(SPOTTER_ID);

    const forged = await new SignJWT({ sub: SPOTTER_ID })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new TextEncoder().encode('wrong-secret'));
    const bad = await verifySpotterToken(forged, SECRET);
    expect(bad.spotterId).toBeNull();
  });

  it('rejects a tourist token — roles never cross', async () => {
    const touristToken = await new SignJWT({ sub: SPOTTER_ID, role: 'tourist' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(SECRET);
    const crossed = await verifySpotterToken(touristToken, SECRET);
    expect(crossed.spotterId).toBeNull();
  });
});

describe('dev bypass — 000000 signs in any known spotter outside production', () => {
  it('accepts 000000 in dev even with a different minted code', async () => {
    const r = await spotterLogin(db, { phone: PHONE, code: '000000' }, SECRET);
    expect(r.ok).toBe(true);
  });

  it('accepts 000000 in dev even when no code was minted', async () => {
    const noCodeDb = {
      findSpotterByPhone: async () => ({
        id: SPOTTER_ID,
        phone: PHONE,
        name: 'Yorman',
        loginCodeHash: null,
      }),
    };
    const r = await spotterLogin(noCodeDb, { phone: PHONE, code: '000000' }, SECRET);
    expect(r.ok).toBe(true);
  });

  it('never bypasses in production', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const r = await spotterLogin(db, { phone: PHONE, code: '000000' }, SECRET);
      expect(r.ok).toBe(false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('still requires a known phone', async () => {
    const r = await spotterLogin(db, { phone: '+58 999 999 9999', code: '000000' }, SECRET);
    expect(r.ok).toBe(false);
  });
});
