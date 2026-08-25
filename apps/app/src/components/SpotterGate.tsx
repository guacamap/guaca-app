import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { KeyRound } from 'lucide-react'
import { Button, GuacaLogo, Input, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'

type Step = 'checking' | 'email' | 'code' | 'authed'

/**
 * Spotter door: email, then a one-time code, the same door tourists use.
 * The difference is behind it: the roster is the allowlist, so an email
 * nobody invited gets a clear refusal instead of a code.
 */
export function SpotterGate({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].spotter
  const [step, setStep] = useState<Step>('checking')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/spotter/me', { credentials: 'include' })
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
      const res = await fetch('/api/spotter/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      if (res.ok) setStep('code')
      else if (res.status === 403) setError(t.notRegistered)
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
      const res = await fetch('/api/spotter/auth/verify', {
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

  /** One tap into the seeded test spotter. The API only issues 000000
   *  outside production, so this is inert even if it ever rendered there. */
  const devBypass = async () => {
    setBusy(true)
    setError(null)
    const devEmail = 'yorman.salazar@spotters.guaca.dev'
    try {
      await fetch('/api/spotter/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail }),
      })
      const res = await fetch('/api/spotter/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail, code: '000000' }),
      })
      if (res.ok) setStep('authed')
      else setError(t.loginFailed)
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-7">
      <GuacaLogo className="h-14" />
      <div className="w-full rounded-3xl guaca-card p-6">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.1em] text-guaca-coral-dark">
          <KeyRound className="h-4 w-4" /> {t.gateTitle}
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-guaca-ink/60">{t.gateLede}</p>

        {step === 'email' && (
          <form onSubmit={requestCode} className="mt-5 space-y-3">
            <label className="block text-xs font-black text-guaca-ink/70" htmlFor="sp-email">
              {t.emailLabel}
            </label>
            <Input
              id="sp-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-guaca-coral font-black text-white hover:bg-guaca-coral-dark">
              {t.sendCodeCta}
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify} className="mt-5 space-y-3">
            <p className="text-xs font-bold text-guaca-ink/60">
              {t.codeSentTo} <span className="font-black text-guaca-ink">{email}</span>
            </p>
            <label className="block text-xs font-black text-guaca-ink/70" htmlFor="sp-code">
              {t.codeLabel}
            </label>
            {process.env.NODE_ENV !== 'production' && (
              <p className="text-xs font-bold text-guaca-mango-dark">{t.devCodeHint}</p>
            )}
            <Input
              id="sp-code"
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-lg font-black tracking-[.3em]"
            />
            <Button type="submit" disabled={busy || code.length !== 6} className="h-12 w-full rounded-xl bg-guaca-coral font-black text-white hover:bg-guaca-coral-dark">
              {t.loginCta}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setStep('email'); setCode(''); setError(null) }} className="h-10 w-full rounded-xl text-xs font-black text-guaca-ink/55">
              {t.changeEmail}
            </Button>
          </form>
        )}

        {process.env.NODE_ENV !== 'production' && step === 'email' && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void devBypass()} className="mt-2 h-11 w-full rounded-xl border border-dashed border-guaca-mango bg-guaca-mango/10 text-xs font-black text-guaca-mango-dark hover:bg-guaca-mango/20">
            {t.devBypassCta}
          </Button>
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
