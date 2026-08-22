/**
 * §4.1 — the ~20-line EmailSender seam. Dev prints the code (ops stream +
 * stdout); prod uses Resend when RESEND_API_KEY is set. Swapping providers
 * is a config change, never a code change elsewhere.
 */
export interface EmailSender {
  /** 'dev' = codes are logged, not delivered — enables the local bypass. */
  mode?: 'dev' | 'live';
  sendLoginCode(email: string, code: string, language: string): Promise<void>;
  /** "Tell me when it's verified" — fired when a matching place goes live. */
  sendPlaceVerified?(email: string, placeName: string, language: string): Promise<void>;
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
    };
  }
  const from = env.EMAIL_FROM ?? 'Guaca <login@guaca.live>';
  const send = async (to: string, subject: string, text: string) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`resend failed: ${res.status}`);
  };
  return {
    mode: 'live',
    async sendLoginCode(email, code, language) {
      const es = language === 'es';
      await send(
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
        email,
        es ? `Un local verificó: ${placeName}` : `A local just verified: ${placeName}`,
        es
          ? `Preguntaste por algo que nadie había comprobado. Un local fue a verificarlo: ${placeName} ya está en tu mapa. Ábrelo en https://app.guaca.live`
          : `You asked about something nobody had checked. A local went and verified it: ${placeName} is now on your map. Open it at https://app.guaca.live`,
      );
    },
  };
}
