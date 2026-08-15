import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { MailPlus, ShieldCheck } from 'lucide-react'
import { Button, GuacaLogo, Input, useLanguage } from '@guaca/ui'
import { appCopy, loadAttribution } from '../lib/copy'

type Step = 'checking' | 'email' | 'code' | 'authed'

/**
 * §4.1 — the tourist account gate: email → 6-digit code → in. The cookie is
 * set by the API (same-origin via the /api proxy), so children can fetch
 * gated endpoints with credentials: 'include'.
 */
export function TouristGate({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].gate
  const [step, setStep] = useState<Step>('checking')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/tourist/me', { credentials: 'include' })
      .then((r) => setStep(r.ok ? 'authed' : 'email'))
      .catch(() => setStep('email'))
  }, [])

  if (step === 'authed') return <>{children}</>
  if (step === 'checking') {
    return <div className="flex min-h-full flex-1 items-center justify-center p-8" aria-busy="true" />
  }

  const requestCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const attribution = loadAttribution()
      const res = await fetch('/api/tourist/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          language: lang,
          ...(attribution ? { propertyId: attribution.propertyId } : {}),
        }),
      })
      if (res.status === 429) setError(t.rateLimited)
      else if (!res.ok) setError(t.invalidEmail)
      else setStep('code')
    } catch {
      setError(t.networkError)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/tourist/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      })
      if (res.ok) setStep('authed')
      else setError(t.badCode)
    } catch {
      setError(t.networkError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-7">
      <GuacaLogo className="h-14" />
      <div className="w-full rounded-3xl guaca-card p-6">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.1em] text-guaca-teal">
          <ShieldCheck className="h-4 w-4" /> {t.title}
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-guaca-ink/60">{t.lede}</p>

        {step === 'email' && (
          <form onSubmit={requestCode} className="mt-5 space-y-3">
            <label className="block text-xs font-black text-guaca-ink/70" htmlFor="gate-email">
              {t.emailLabel}
            </label>
            <Input
              id="gate-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana@example.com"
            />
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-guaca-teal font-black text-white hover:bg-guaca-teal-dark">
              <MailPlus className="mr-2 h-4 w-4" /> {t.emailCta}
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify} className="mt-5 space-y-3">
            <p className="text-xs font-bold text-guaca-ink/55">
              {t.codeLede} <span className="text-guaca-ink">{email}</span>
            </p>
            {process.env.NODE_ENV !== 'production' && (
              <p className="text-xs font-bold text-guaca-mango-dark">{t.devCodeHint}</p>
            )}
            <label className="block text-xs font-black text-guaca-ink/70" htmlFor="gate-code">
              {t.codeLabel}
            </label>
            <Input
              id="gate-code"
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-xl font-black tracking-[.4em]"
            />
            <Button type="submit" disabled={busy || code.length !== 6} className="h-12 w-full rounded-xl bg-guaca-teal font-black text-white hover:bg-guaca-teal-dark">
              {t.codeCta}
            </Button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError(null) }}
              className="w-full py-2 text-xs font-bold text-guaca-teal underline-offset-2 hover:underline"
            >
              {t.resend}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-guaca-coral/10 px-3 py-2 text-xs font-bold text-guaca-coral-dark">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
