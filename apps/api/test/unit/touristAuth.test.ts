import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import {
  requestTouristCode,
  verifyTouristLogin,
  verifyTouristToken,
  type TouristAuthDb,
} from '../../src/touristAuth.ts';
import type { EmailSender } from '../../src/email.ts';

const SECRET = new TextEncoder().encode('test-secret-at-least-32-bytes-long!!');
const TOURIST_ID = '00000000-0000-4000-8000-0000000000e1';

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** In-memory TouristAuthDb mirroring the SQL semantics (single-use, expiry). */
function memoryDb() {
  const rows = new Map<
    string,
    { codeHash: string; expiresAt: Date; attributedPropertyId: string | null }
  >();
  const db: TouristAuthDb = {
    async upsertLoginCode(input) {
      rows.set(input.email, {
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        attributedPropertyId: input.attributedPropertyId ?? null,
      });
      return { id: TOURIST_ID };
    },
    async consumeLoginCode(email, codeHash) {
      const row = rows.get(email);
      if (!row || row.codeHash !== codeHash || row.expiresAt <= new Date()) return null;
      rows.delete(email); // single use
      return { id: TOURIST_ID, email, language: 'en', attributedPropertyId: row.attributedPropertyId };
    },
  };
  return { db, rows };
}

function capture(): { sender: EmailSender; last: () => string | undefined } {
  let code: string | undefined;
  return {
    sender: {
      async sendLoginCode(_email, c) {
        code = c;
      },
    },
    last: () => code,
  };
}

describe('§4.1 — tourist email one-time code', () => {
  it('rejects a malformed email without sending anything', async () => {
    const { db } = memoryDb();
    const cap = capture();
    const r = await requestTouristCode(db, { email: 'not-an-email' }, cap.sender);
    expect(r.ok).toBe(false);
    expect(cap.last()).toBeUndefined();
  });

  it('issues a 6-digit code and logs in with it exactly once', async () => {
    const { db } = memoryDb();
    const cap = capture();
    const r = await requestTouristCode(db, { email: 'Ana@Example.COM ' }, cap.sender);
    expect(r.ok).toBe(true);
    const code = cap.last()!;
    expect(code).toMatch(/^\d{6}$/);

    const login = await verifyTouristLogin(db, { email: 'ana@example.com', code }, SECRET);
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    const { touristId } = await verifyTouristToken(login.token, SECRET);
    expect(touristId).toBe(TOURIST_ID);

    // Single use: the same code cannot log in twice.
    const again = await verifyTouristLogin(db, { email: 'ana@example.com', code }, SECRET);
    expect(again.ok).toBe(false);
  });

  it('rejects a wrong code', async () => {
    const { db } = memoryDb();
    const cap = capture();
    await requestTouristCode(db, { email: 'ana@example.com' }, cap.sender);
    const r = await verifyTouristLogin(db, { email: 'ana@example.com', code: '000000' }, SECRET);
    // Vanishingly unlikely collision with the real code aside, this must fail.
    if (cap.last() !== '000000') expect(r.ok).toBe(false);
  });

  it('rejects an expired code', async () => {
    const { db, rows } = memoryDb();
    const cap = capture();
    await requestTouristCode(db, { email: 'ana@example.com' }, cap.sender);
    const row = rows.get('ana@example.com')!;
    rows.set('ana@example.com', { ...row, expiresAt: new Date(Date.now() - 1000) });
    const r = await verifyTouristLogin(db, { email: 'ana@example.com', code: cap.last()! }, SECRET);
    expect(r.ok).toBe(false);
  });

  it('rejects a non-tourist JWT (a spotter token cannot ask)', async () => {
    const spotterish = await new SignJWT({ sub: TOURIST_ID })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(SECRET);
    const { touristId } = await verifyTouristToken(spotterish, SECRET);
    expect(touristId).toBeNull();
  });
});

describe('dev bypass — fixed 000000 code without real email delivery', () => {
  function devCapture(): { sender: EmailSender; last: () => string | undefined } {
    let code: string | undefined;
    return {
      sender: {
        mode: 'dev',
        async sendLoginCode(_email, c) {
          code = c;
        },
      },
      last: () => code,
    };
  }

  it('a dev-mode sender always issues 000000 and it logs in', async () => {
    const { db } = memoryDb();
    const cap = devCapture();
    await requestTouristCode(db, { email: 'tester@example.com' }, cap.sender);
    expect(cap.last()).toBe('000000');
    const login = await verifyTouristLogin(db, { email: 'tester@example.com', code: '000000' }, SECRET);
    expect(login.ok).toBe(true);
  });

  it('a live-mode sender never gets the bypass', async () => {
    const { db } = memoryDb();
    let code: string | undefined;
    const sender: EmailSender = {
      mode: 'live',
      async sendLoginCode(_email, c) {
        code = c;
      },
    };
    // 20 requests: a fixed bypass would repeat 000000 every time.
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      await requestTouristCode(db, { email: 'tester@example.com' }, sender);
      seen.add(code!);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('production never gets the bypass even with a dev sender', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { db } = memoryDb();
      const cap = devCapture();
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) {
        await requestTouristCode(db, { email: 'tester@example.com' }, cap.sender);
        seen.add(cap.last()!);
      }
      expect(seen.size).toBeGreaterThan(1);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('store-review account', () => {
  it('is inert unless both env vars are set', async () => {
    const { db } = memoryDb();
    const cap = capture();
    await requestTouristCode(db, { email: 'review@example.com' }, cap.sender);
    expect(cap.last()).toMatch(/^\d{6}$/);
    expect(cap.last()).not.toBe('424242');
  });

  it('gives exactly the configured address the configured code', async () => {
    const prevEmail = process.env.REVIEW_EMAIL;
    const prevCode = process.env.REVIEW_CODE;
    const prevEnv = process.env.NODE_ENV;
    process.env.REVIEW_EMAIL = 'review@example.com';
    process.env.REVIEW_CODE = '424242';
    process.env.NODE_ENV = 'production';
    try {
      const { db } = memoryDb();
      const cap = capture();
      await requestTouristCode(db, { email: 'Review@Example.com' }, cap.sender);
      expect(cap.last()).toBe('424242');
      const login = await verifyTouristLogin(
        db,
        { email: 'review@example.com', code: '424242' },
        SECRET,
      );
      expect(login.ok).toBe(true);

      // Anyone else still gets a random code.
      const other = capture();
      await requestTouristCode(db, { email: 'someone@example.com' }, other.sender);
      expect(other.last()).not.toBe('424242');
    } finally {
      process.env.REVIEW_EMAIL = prevEmail;
      process.env.REVIEW_CODE = prevCode;
      process.env.NODE_ENV = prevEnv;
    }
  });
});
