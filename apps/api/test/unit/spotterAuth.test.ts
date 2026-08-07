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
});
