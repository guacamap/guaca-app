/**
 * §4.1 — the ~20-line EmailSender seam. Dev prints the code (ops stream +
 * stdout); prod uses Resend when RESEND_API_KEY is set. Swapping providers
 * is a config change, never a code change elsewhere.
 */
import { waitlistConfirmation } from './emailTemplates.js';

export interface EmailSender {
  /** 'dev' = codes are logged, not delivered — enables the local bypass. */
  mode?: 'dev' | 'live';
  sendLoginCode(email: string, code: string, language: string): Promise<void>;
  /** "Tell me when it's verified" — fired when a matching place goes live. */
  sendPlaceVerified?(email: string, placeName: string, language: string): Promise<void>;
  /** Waitlist signup on the marketing site — confirms we will be in touch. */
  sendWaitlistConfirmation?(email: string, role: string, language: string): Promise<void>;
  /** An operator put this person on the spotter roster. */
  sendSpotterWelcome?(email: string, name: string, language: string): Promise<void>;
}

export function createEmailSender(env: NodeJS.ProcessEnv = process.env): EmailSender {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // Printing a live login code is a sign-in credential in the clear: in
    // production anyone who can read the container log could take over any
    // account inside the 10-minute window. Outside production that visibility
    // is the point, so the seam refuses only where the risk is real.
    if (env.NODE_ENV === 'production') {
      console.warn('[email] RESEND_API_KEY is not set — login codes will be REFUSED, not logged');
      return {
        mode: 'live',
        async sendLoginCode() {
          throw new Error('email is not configured (RESEND_API_KEY missing) — refusing to log a login code');
        },
        async sendPlaceVerified() {
          throw new Error('email is not configured (RESEND_API_KEY missing)');
        },
        async sendWaitlistConfirmation() {
          throw new Error('email is not configured (RESEND_API_KEY missing)');
        },
        async sendSpotterWelcome() {
          throw new Error('email is not configured (RESEND_API_KEY missing)');
        },
      };
    }
    return {
      mode: 'dev',
      async sendLoginCode(email, code) {
        // Visible in `guaca tail` and the API log — dev/staging only.
        console.log(`[email] login code for ${email}: ${code}`);
      },
      async sendPlaceVerified(email, placeName) {
        console.log(`[email] place verified for ${email}: ${placeName}`);
      },
      async sendWaitlistConfirmation(email, role) {
        console.log(`[email] waitlist confirmation for ${email} (${role})`);
      },
      async sendSpotterWelcome(email, name) {
        console.log(`[email] spotter welcome for ${email} (${name})`);
      },
    };
  }
  /*
   * One address per purpose, so a reader can tell why Guaca is writing
   * from the sender alone, and can filter codes away from news:
   *   login@  codes only (tourist and operator sign-in)
   *   hola@   everything a person might answer: waitlist, place verified,
   *           news. The same address the site and legal pages print.
   * Replies to either go to hola@. EMAIL_FROM is the legacy single sender
   * and still works as the fallback for both.
   */
  const legacy = env.EMAIL_FROM;
  const FROM = {
    login: env.EMAIL_FROM_LOGIN ?? legacy ?? 'Guaca <login@guaca.live>',
    hello: env.EMAIL_FROM_HELLO ?? legacy ?? 'Guaca <hola@guaca.live>',
  } as const;
  const replyTo = env.EMAIL_REPLY_TO ?? 'hola@guaca.live';
  const send = async (kind: keyof typeof FROM, to: string, subject: string, text: string, html?: string) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      // Always ship the text part too: it is what strict clients, watches
      // and screen readers show, and it keeps spam scoring honest.
      body: JSON.stringify({
        from: FROM[kind], to: [to], reply_to: replyTo, subject, text, ...(html ? { html } : {}),
      }),
    });
    if (!res.ok) throw new Error(`resend failed: ${res.status}`);
  };
  return {
    mode: 'live',
    async sendLoginCode(email, code, language) {
      const es = language === 'es';
      await send(
        'login',
        email,
        es ? `${code} es tu código de Guaca` : `${code} is your Guaca code`,
        es
          ? `Tu código de acceso es ${code}. Vence en 10 minutos.`
          : `Your login code is ${code}. It expires in 10 minutes.`,
      );
    },
    async sendPlaceVerified(email, placeName, language) {
      const es = language === 'es';
      await send(
        'hello',
        email,
        es ? `Un local verificó: ${placeName}` : `A local just verified: ${placeName}`,
        es
          ? `Preguntaste por algo que nadie había comprobado. Un local fue a verificarlo: ${placeName} ya está en tu mapa. Ábrelo en https://app.guaca.live`
          : `You asked about something nobody had checked. A local went and verified it: ${placeName} is now on your map. Open it at https://app.guaca.live`,
      );
    },
    async sendWaitlistConfirmation(email, role, language) {
      const body = waitlistConfirmation({
        role,
        language,
        siteUrl: env.NEXT_PUBLIC_LANDING_URL ?? env.LANDING_URL ?? 'https://guaca.live',
        // The API is where the images are served from (see /api/assets/email).
        assetUrl: env.PUBLIC_API_URL ?? 'https://api.guaca.live',
      });
      await send('hello', email, body.subject, body.text, body.html);
    },
    async sendSpotterWelcome(email, name, language) {
      const es = language === 'es';
      const app = env.NEXT_PUBLIC_APP_URL ?? env.APP_URL ?? 'https://app.guaca.live';
      await send(
        'hello',
        email,
        es ? `${name}, ya eres Spotter de Guaca 📍` : `${name}, you're a Guaca Spotter 📍`,
        es
          ? `Un operador te añadió al roster de Spotters. Para entrar, abre ${app}, elige Spotter y escribe este correo: te enviaremos un código de un solo uso cada vez que entres. Tus misiones te esperan.`
          : `An operator added you to the Spotter roster. To get in, open ${app}, choose Spotter and enter this email: we'll send you a one-time code every time you sign in. Your missions are waiting.`,
      );
    },
  };
}
