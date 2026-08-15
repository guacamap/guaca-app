import { useState, type FormEvent } from 'react'
import { ShieldAlert, Trash2 } from 'lucide-react'
import { GuacaLogo, InfoProvider, LanguageProvider, useLanguage } from '@guaca/ui'
import { landingCopy } from '@/lib/landingCopy'

type Step = 'email' | 'code' | 'confirm' | 'done'

function DeleteFlow() {
  const { lang } = useLanguage()
  const t = landingCopy[lang].deleteAccount
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const post = async (url: string, body: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })

  const sendCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await post('/api/tourist/auth/request-code', { email, language: lang, existingOnly: true })
      // A server rejection is not a connection failure — telling the user
      // "try again" for a permanently invalid email is a dead end.
      if (res.ok) setStep('code')
      else if (res.status === 429) setError(t.rateLimited)
      else setError(t.invalidEmail)
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
      const res = await post('/api/tourist/auth/verify', { email, code })
      if (res.ok) setStep('confirm')
      else setError(t.badCode)
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/tourist/me', { method: 'DELETE', credentials: 'include' })
      if (res.ok) setStep('done')
      else setError(t.error)
    } catch {
      setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'mt-1 h-12 w-full rounded-xl border border-guaca-sand bg-white px-4 text-sm font-semibold text-guaca-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-teal'
  const buttonCls =
    'mt-4 h-12 w-full rounded-xl text-sm font-black text-white disabled:opacity-50'

  return (
    <div className="grid min-h-screen place-items-center bg-guaca-paper px-5 py-10">
      <div className="w-full max-w-md">
        <GuacaLogo className="mx-auto h-14" />
        <div className="guaca-card mt-6 rounded-[28px] p-7">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.1em] text-guaca-coral-dark">
            <ShieldAlert aria-hidden="true" className="h-4 w-4" /> {t.title}
          </p>

          {step === 'email' && (
            <>
              <p className="mt-2 text-sm font-medium leading-6 text-guaca-ink/60">{t.lede}</p>
              <form onSubmit={sendCode} className="mt-5">
                <label className="text-xs font-black text-guaca-ink/70" htmlFor="del-email">
                  {t.emailLabel}
                </label>
                <input
                  id="del-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
                <button type="submit" disabled={busy} className={`${buttonCls} bg-guaca-teal hover:bg-guaca-teal-dark`}>
                  {t.sendCode}
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <form onSubmit={verify} className="mt-5">
              <label className="text-xs font-black text-guaca-ink/70" htmlFor="del-code">
                {t.codeLabel}
              </label>
              <input
                id="del-code"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputCls} text-center text-xl font-black tracking-[.4em]`}
              />
              <button type="submit" disabled={busy || code.length !== 6} className={`${buttonCls} bg-guaca-teal hover:bg-guaca-teal-dark`}>
                {t.verify}
              </button>
            </form>
          )}

          {step === 'confirm' && (
            <div className="mt-4">
              <h2 className="text-lg font-black text-guaca-ink">{t.confirmTitle}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-guaca-ink/60">{t.confirmBody}</p>
              <button
                type="button"
                disabled={busy}
                onClick={doDelete}
                className={`${buttonCls} flex items-center justify-center gap-2 bg-guaca-coral hover:bg-guaca-coral-dark`}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" /> {t.confirmCta}
              </button>
            </div>
          )}

          {step === 'done' && (
            <p role="status" className="mt-4 rounded-2xl bg-guaca-teal/10 px-4 py-4 text-sm font-bold text-guaca-teal-dark">
              {t.done}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-guaca-coral/10 px-3 py-2 text-xs font-bold text-guaca-coral-dark">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DeleteAccount() {
  return (
    <InfoProvider>
      <LanguageProvider>
        <DeleteFlow />
      </LanguageProvider>
    </InfoProvider>
  )
}
