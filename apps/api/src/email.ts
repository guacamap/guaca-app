/**
 * §4.1 — the ~20-line EmailSender seam. Dev prints the code (ops stream +
 * stdout); prod uses Resend when RESEND_API_KEY is set. Swapping providers
 * is a config change, never a code change elsewhere.
 */
export interface EmailSender {
  sendLoginCode(email: string, code: string, language: string): Promise<void>;
}

export function createEmailSender(env: NodeJS.ProcessEnv = process.env): EmailSender {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      async sendLoginCode(email, code) {
        // Visible in `guaca tail` and the API log — dev/staging only.
        console.log(`[email] login code for ${email}: ${code}`);
      },
    };
  }
  const from = env.EMAIL_FROM ?? 'Guaca <login@guaca.live>';
  return {
    async sendLoginCode(email, code, language) {
      const es = language === 'es';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [email],
          subject: es ? `${code} es tu código de Guaca` : `${code} is your Guaca code`,
          text: es
            ? `Tu código de acceso es ${code}. Vence en 10 minutos.`
            : `Your login code is ${code}. It expires in 10 minutes.`,
        }),
      });
      if (!res.ok) throw new Error(`resend failed: ${res.status}`);
    },
  };
}
