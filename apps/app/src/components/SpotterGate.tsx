import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { KeyRound } from 'lucide-react'
import { Button, GuacaLogo, Input, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'

type Step = 'checking' | 'login' | 'authed'

/** Spotter door: phone + operator-issued one-time code. Invitation only. */
export function SpotterGate({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].spotter
  const [step, setStep] = useState<Step>('checking')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/spotter/me', { credentials: 'include' })
      .then((r) => setStep(r.ok ? 'authed' : 'login'))
      .catch(() => setStep('login'))
  }, [])

  if (step === 'authed') return <>{children}</>
  if (step === 'checking') {
    return <div className="flex min-h-full flex-1 items-center justify-center p-8" aria-busy="true" />
  }

  const login = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/spotter/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code }),
      })
      if (res.ok) setStep('authed')
      else setError(t.loginFailed)
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  /** One tap into the seeded test spotter — the API only honours 000000
   *  outside production, so this button is inert even if it ever rendered. */
  const devBypass = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/spotter/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: '+58 412 999 0001', code: '000000' }),
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
        <form onSubmit={login} className="mt-5 space-y-3">
          <label className="block text-xs font-black text-guaca-ink/70" htmlFor="sp-phone">
            {t.phoneLabel}
          </label>
          <Input
            id="sp-phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+58 412 000 0000"
          />
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
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="text-center text-lg font-black tracking-[.3em]"
          />
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-guaca-coral font-black text-white hover:bg-guaca-coral-dark">
            {t.loginCta}
          </Button>
        </form>
        {process.env.NODE_ENV !== 'production' && (
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
