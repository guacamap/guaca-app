import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Store } from 'lucide-react'
import { Button, Input, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'
import { DEV_LOGIN_CODE, SCENARIO_MERCHANT_EMAIL } from '../lib/scenarioActors'
import { GateCard } from './GateCard'
import { GLASS, GLASS_INPUT } from './JoinScene'

type Step = 'checking' | 'email' | 'code' | 'authed'

const PRESENTATION = process.env.NEXT_PUBLIC_PRESENTATION_MODE === 'true'

/**
 * Host door: email, then a one-time code, the same local flow tourists and
 * Spotters use. The merchant cookie is separate from the operator admin.
 */
export function MerchantGate({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].merchant
  const [step, setStep] = useState<Step>('checking')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accessCode, setAccessCode] = useState(false)

  useEffect(() => {
    fetch('/api/merchant/me', { credentials: 'include' })
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
      const res = await fetch('/api/merchant/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        const result = await res.json() as { delivery?: string }
        setAccessCode(result.delivery === 'access-code')
        setStep('code')
      } else if (res.status === 403) setError(t.notRegistered)
      else setError(t.error)
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/merchant/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      })
      if (res.ok) setStep('authed')
      else setError(t.loginFailed)
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  const signInWith = async (devEmail: string) => {
    setBusy(true)
    setError(null)
    try {
      await fetch('/api/merchant/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail }),
      })
      const res = await fetch('/api/merchant/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail, code: DEV_LOGIN_CODE }),
      })
      if (res.ok) setStep('authed')
      else setError(t.loginFailed)
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  const g = GLASS.navy
  return (
    <GateCard tone="navy" icon={Store} title={t.gateTitle} lede={t.gateLede} error={error}>
      {step === 'email' && (
        <form onSubmit={requestCode} className="mt-5 space-y-3">
          <label className="block text-[12px] font-black uppercase tracking-[.08em] text-white/70" htmlFor="mc-email">
            {t.emailLabel}
          </label>
          <Input
            id="mc-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="elena@scenario.guaca.live"
            className={`${GLASS_INPUT} ${g.ring}`}
          />
          <Button type="submit" disabled={busy} className={`h-12 w-full rounded-xl text-[15px] font-black text-white ${g.button}`}>
            {t.sendCodeCta}
          </Button>
          {process.env.NODE_ENV !== 'production' && !PRESENTATION && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void signInWith(SCENARIO_MERCHANT_EMAIL)}
              className="h-11 w-full rounded-xl border border-dashed border-guaca-lagoon/50 bg-guaca-ocean/40 text-xs font-black text-white hover:bg-guaca-ocean"
            >
              {t.devBypassCta}
            </Button>
          )}
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify} className="mt-5 space-y-3">
          <p className="text-[13px] font-semibold text-white/75">
            {accessCode ? (lang === 'es' ? 'Ingresa tu código de acceso para' : 'Enter your access code for') : t.codeSentTo}{' '}
            <span className="font-black text-white">{email}</span>
          </p>
          {process.env.NODE_ENV !== 'production' && !PRESENTATION && !accessCode && (
            <p className="text-xs font-bold text-guaca-lagoon">{t.devCodeHint}</p>
          )}
          <label className="block text-[12px] font-black uppercase tracking-[.08em] text-white/70" htmlFor="mc-code">
            {t.codeLabel}
          </label>
          <Input
            id="mc-code"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${GLASS_INPUT} ${g.ring} h-14 text-center text-[24px] font-black tracking-[.45em]`}
          />
          <Button type="submit" disabled={busy || code.length !== 6} className={`h-12 w-full rounded-xl text-[15px] font-black text-white ${g.button}`}>
            {t.loginCta}
          </Button>
          <button
            type="button"
            onClick={() => { setStep('email'); setCode(''); setError(null) }}
            className="w-full rounded py-2 text-[13px] font-bold text-white/80 underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {t.changeEmail}
          </button>
        </form>
      )}
    </GateCard>
  )
}
