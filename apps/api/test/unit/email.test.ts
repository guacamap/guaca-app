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

  it('sends a genuinely different email per role, in both languages', async () => {
    const { waitlistConfirmation } = await import('../../src/emailTemplates.js');
    for (const language of ['en', 'es']) {
      const t = waitlistConfirmation({ role: 'traveler', language, siteUrl: 'https://guaca.live' });
      const s = waitlistConfirmation({ role: 'spotter', language, siteUrl: 'https://guaca.live' });
      const o = waitlistConfirmation({ role: 'owner', language, siteUrl: 'https://guaca.live' });
      // subject, headline and props all differ
      expect(new Set([t.subject, s.subject, o.subject]).size).toBe(3);
      expect(new Set([t.text.split('\n')[0], s.text.split('\n')[0], o.text.split('\n')[0]]).size).toBe(3);
      // the promise paragraph is the one thing shared by all three
      const promise = language === 'es' ? 'Gracias por unirte a Guaca.' : 'Thanks for joining Guaca.';
      for (const b of [t, s, o]) expect(b.text).toContain(promise);
    }
  });

  it('tells a spotter about missions and two witnesses, and a business about claiming', async () => {
    const { waitlistConfirmation } = await import('../../src/emailTemplates.js');
    const s = waitlistConfirmation({ role: 'spotter', language: 'en', siteUrl: 'https://guaca.live' });
    const o = waitlistConfirmation({ role: 'owner', language: 'en', siteUrl: 'https://guaca.live' });
    expect(s.text).toMatch(/missions/i);
    expect(s.text).toMatch(/two spotters confirm/i);
    expect(o.text).toMatch(/claim your place/i);
    expect(o.text).not.toMatch(/missions/i);
  });

  it('treats an unknown role as a traveller instead of throwing', async () => {
    const { waitlistConfirmation } = await import('../../src/emailTemplates.js');
    const weird = waitlistConfirmation({ role: '<img onerror=x>', language: 'en', siteUrl: 'https://guaca.live' });
    expect(weird.text).toContain('You joined as a traveller.');
    expect(weird.html).not.toContain('<img onerror');
  });

  it('keeps the plain-text part free of markup', async () => {
    const { waitlistConfirmation } = await import('../../src/emailTemplates.js');
    const b = waitlistConfirmation({ role: 'traveler', language: 'en', siteUrl: 'https://guaca.live' });
    expect(b.text).not.toMatch(/<[a-z]/i);
  });
});
