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

describe('waitlistConfirmation template', () => {
  it('renders both languages with the same structure', async () => {
    const { waitlistConfirmation } = await import('../../src/emailTemplates.js');
    const en = waitlistConfirmation({ role: 'traveler', language: 'en', siteUrl: 'https://guaca.live' });
    const es = waitlistConfirmation({ role: 'traveler', language: 'es', siteUrl: 'https://guaca.live' });
    expect(en.subject).toMatch(/waitlist/i);
    expect(es.subject).toMatch(/lista/i);
    for (const b of [en, es]) {
      expect(b.html).toContain('https://guaca.live/api/assets/email/hero-app.jpg');
      expect(b.html).toContain('https://guaca.live/api/assets/email/wordmark.png');
      expect(b.text.length).toBeGreaterThan(200);
    }
  });

  it('adapts one line to the role and never leaks HTML into it', async () => {
    const { waitlistConfirmation } = await import('../../src/emailTemplates.js');
    const spotter = waitlistConfirmation({ role: 'spotter', language: 'en', siteUrl: 'https://guaca.live' });
    const owner = waitlistConfirmation({ role: 'owner', language: 'en', siteUrl: 'https://guaca.live' });
    expect(spotter.text).toContain('local spotter');
    expect(owner.text).toContain('business');
    // an unknown role falls back rather than throwing
    expect(() => waitlistConfirmation({ role: '<img>', language: 'en', siteUrl: 'https://guaca.live' })).not.toThrow();
  });

  it('keeps the plain-text part free of markup', async () => {
    const { waitlistConfirmation } = await import('../../src/emailTemplates.js');
    const b = waitlistConfirmation({ role: 'traveler', language: 'en', siteUrl: 'https://guaca.live' });
    expect(b.text).not.toMatch(/<[a-z]/i);
  });
});
