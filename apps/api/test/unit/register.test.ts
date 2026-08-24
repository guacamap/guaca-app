import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import type { EmailSender } from '../../src/email.ts';

function fakePool() {
  const calls: { text: string; values: unknown[] }[] = [];
  const pool = {
    query: async (text: string, values: unknown[]) => {
      calls.push({ text, values });
      return {
        rows: [{ id: 'reg-1', role: values[0], created_at: new Date('2026-08-11T00:00:00Z') }],
      };
    },
  } as unknown as Pool;
  return { pool, calls };
}

describe('POST /api/register', () => {
  it('rejects an unknown role', async () => {
    const app = buildApp({ pool: fakePool().pool });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: { role: 'admin', name: 'Ana', contact: 'ana@example.com' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing name or contact', async () => {
    const app = buildApp({ pool: fakePool().pool });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: { role: 'traveler', name: '  ', contact: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('records each valid role and echoes the id', async () => {
    for (const role of ['traveler', 'spotter', 'owner'] as const) {
      const { pool, calls } = fakePool();
      const app = buildApp({ pool });
      const res = await app.inject({
        method: 'POST',
        url: '/api/register',
        payload: {
          role,
          name: 'Ana Pérez',
          contact: 'ana@example.com',
          language: 'es',
          details: { zone: 'Patanemo' },
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ ok: true, id: 'reg-1', role });
      expect(calls).toHaveLength(1);
      expect(calls[0]!.values[0]).toBe(role);
      expect(calls[0]!.values[2]).toBe('ana@example.com');
      expect(calls[0]!.values[3]).toBe('es');
    }
  });

  it('normalizes contact details before recording the waitlist entry', async () => {
    const { pool, calls } = fakePool();
    const app = buildApp({ pool });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        role: 'traveler',
        name: 'Ana Pérez',
        contact: '  ANA@Example.COM ',
        details: { community: 'Curaçao' },
      },
    });

    expect(res.statusCode).toBe(201);
    expect(calls[0]!.values[2]).toBe('ana@example.com');
    expect(calls[0]!.values[4]).toBe(JSON.stringify({ community: 'Curaçao' }));
  });
});

/** Captures what the waitlist confirmation would have sent. */
function recordingSender(overrides: Partial<EmailSender> = {}): {
  sender: EmailSender;
  sent: { to: string; role: string; language: string }[];
} {
  const sent: { to: string; role: string; language: string }[] = [];
  const sender: EmailSender = {
    mode: 'live',
    async sendLoginCode() {},
    async sendWaitlistConfirmation(to, role, language) {
      sent.push({ to, role, language });
    },
    ...overrides,
  };
  return { sender, sent };
}

describe('POST /api/register — waitlist confirmation', () => {
  it('confirms to an email contact', async () => {
    const { sender, sent } = recordingSender();
    const app = buildApp({ pool: fakePool().pool, emailSender: sender });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: { role: 'spotter', name: 'Ana', contact: 'ana@example.com', language: 'es' },
    });
    expect(res.statusCode).toBe(201);
    expect(sent).toEqual([{ to: 'ana@example.com', role: 'spotter', language: 'es' }]);
  });

  it('sends nothing when the contact is a phone number', async () => {
    // The form accepts "email or phone"; there is no address to write to.
    const { sender, sent } = recordingSender();
    const app = buildApp({ pool: fakePool().pool, emailSender: sender });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: { role: 'spotter', name: 'Ana', contact: '+58 412 555 0000' },
    });
    expect(res.statusCode).toBe(201);
    expect(sent).toHaveLength(0);
  });

  it('still records the signup when the confirmation fails to send', async () => {
    // The row is the valuable thing; a mail outage must not lose a signup.
    const { sender } = recordingSender({
      async sendWaitlistConfirmation() {
        throw new Error('resend is down');
      },
    });
    const { pool, calls } = fakePool();
    const app = buildApp({ pool, emailSender: sender });
    const res = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: { role: 'traveler', name: 'Ana', contact: 'ana@example.com' },
    });
    expect(res.statusCode).toBe(201);
    expect(calls).toHaveLength(1);
  });

  it('rate limits a flood from one address', async () => {
    // Open form + outbound mail = a way to burn the Resend quota.
    const { sender } = recordingSender();
    const app = buildApp({ pool: fakePool().pool, emailSender: sender });
    const codes: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/register',
        payload: { role: 'traveler', name: `Ana ${i}`, contact: `ana${i}@example.com` },
      });
      codes.push(res.statusCode);
    }
    expect(codes.filter((c) => c === 201).length).toBe(5);
    expect(codes.filter((c) => c === 429).length).toBe(2);
  });
});
