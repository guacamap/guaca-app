import { describe, expect, it } from 'vitest';
import { createEmailSender } from '../../src/email.js';

/** A login code is a sign-in credential. Printing one to stdout in production
 *  hands account takeover to anyone who can read the container log, so the
 *  misconfigured-production path must refuse rather than log. */
describe('createEmailSender', () => {
  it('refuses to send in production when no API key is configured', async () => {
    const sender = createEmailSender({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    await expect(sender.sendLoginCode('tourist@example.com', '123456', 'en')).rejects.toThrow(
      /not configured/,
    );
  });

  it('does not report itself as a dev sender in production', async () => {
    // touristAuth enables its fixed-code bypass on `mode === 'dev'`; a
    // misconfigured production sender must never look like one.
    const sender = createEmailSender({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    expect(sender.mode).not.toBe('dev');
  });

  it('still logs the code outside production, where visibility is the point', async () => {
    const sender = createEmailSender({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    expect(sender.mode).toBe('dev');
    await expect(sender.sendLoginCode('tourist@example.com', '123456', 'en')).resolves
      .toBeUndefined();
  });

  it('uses the live sender when an API key is present', () => {
    const sender = createEmailSender({
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_test_key',
    } as NodeJS.ProcessEnv);
    expect(sender.mode).toBe('live');
  });
});
