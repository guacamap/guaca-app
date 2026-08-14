import type { FastifyInstance } from 'fastify';
import type { EmailSender } from '../../src/email.ts';

/** Capture login codes instead of sending mail — the §4.1 EmailSender seam. */
export function captureSender() {
  const codes: Record<string, string> = {};
  const sender: EmailSender = {
    async sendLoginCode(email, code) {
      codes[email] = code;
    },
  };
  return { sender, codes };
}

/** Full email-code login through the real endpoints; returns Bearer headers. */
export async function authTourist(
  app: FastifyInstance,
  codes: Record<string, string>,
  email = 'guest@test.guaca.live',
): Promise<{ authorization: string }> {
  const reqRes = await app.inject({
    method: 'POST',
    url: '/api/tourist/auth/request-code',
    payload: { email },
  });
  if (reqRes.statusCode !== 200) throw new Error(`request-code failed: ${reqRes.body}`);
  const code = codes[email];
  if (!code) throw new Error('no code captured');
  const verifyRes = await app.inject({
    method: 'POST',
    url: '/api/tourist/auth/verify',
    payload: { email, code },
  });
  if (verifyRes.statusCode !== 200) throw new Error(`verify failed: ${verifyRes.body}`);
  const token = (verifyRes.json() as { token: string }).token;
  return { authorization: `Bearer ${token}` };
}
