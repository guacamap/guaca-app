import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Compass, MailPlus } from 'lucide-react'
import { Button, Input, useLanguage } from '@guaca/ui'
import { appCopy, loadAttribution } from '../lib/copy'
import { GateCard } from './GateCard'
import { GLASS, GLASS_INPUT } from './JoinScene'

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

  /** One tap in as a dev tourist: request-code + verify with the fixed
   *  000000 — the API only issues that code outside production. */
  const devBypass = async () => {
    setBusy(true)
    setError(null)
    try {
      const devEmail = 'dev@guaca.live'
      await fetch('/api/tourist/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail, language: lang }),
      })
      const res = await fetch('/api/tourist/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail, code: '000000' }),
      })
      if (res.ok) setStep('authed')
      else setError(t.badCode)
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

  const g = GLASS.teal
  return (
    <GateCard tone="teal" icon={Compass} title={t.title} lede={t.lede} error={error}>
      {step === 'email' && (
        <form onSubmit={requestCode} className="mt-5 space-y-3">
          <label className="block text-[12px] font-black uppercase tracking-[.08em] text-white/70" htmlFor="gate-email">
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
            className={`${GLASS_INPUT} ${g.ring}`}
          />
          <Button type="submit" disabled={busy} className={`h-12 w-full rounded-xl text-[15px] font-black text-white ${g.button}`}>
            <MailPlus className="mr-2 h-4 w-4" /> {t.emailCta}
          </Button>
          {process.env.NODE_ENV !== 'production' && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void devBypass()} className="h-11 w-full rounded-xl border border-dashed border-guaca-mango bg-guaca-mango/15 text-xs font-black text-guaca-mango-light hover:bg-guaca-mango/25">
              {t.devBypassCta}
            </Button>
          )}
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify} className="mt-5 space-y-3">
          <p className="text-[13px] font-semibold text-white/75">
            {t.codeLede} <span className="font-black text-white">{email}</span>
          </p>
          {process.env.NODE_ENV !== 'production' && (
            <p className="text-xs font-bold text-guaca-mango-light">{t.devCodeHint}</p>
          )}
          <label className="block text-[12px] font-black uppercase tracking-[.08em] text-white/70" htmlFor="gate-code">
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
            className={`${GLASS_INPUT} ${g.ring} h-14 text-center text-[24px] font-black tracking-[.45em]`}
          />
          <Button type="submit" disabled={busy || code.length !== 6} className={`h-12 w-full rounded-xl text-[15px] font-black text-white ${g.button}`}>
            {t.codeCta}
          </Button>
          <button
            type="button"
            onClick={() => { setStep('email'); setCode(''); setError(null) }}
            className="w-full rounded py-2 text-[13px] font-bold text-white/80 underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {t.resend}
          </button>
        </form>
      )}
    </GateCard>
  )
}
