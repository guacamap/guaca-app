'use client'

import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { CARIBBEAN_COUNTRIES } from '@guaca/shared'
import type { landingCopy } from '@/lib/landingCopy'

type WaitlistCopy = (typeof landingCopy)['en']['waitlist']
type Role = 'traveler' | 'spotter' | 'owner'

/**
 * The real waitlist. Posts to the API's /api/register, which is proxied
 * same-origin by next.config.mjs, so there is no CORS surface and no
 * third-party form service holding the list — the rows land in our own
 * `registrations` table and show up in the operator panel's inbox.
 */
export function JoinWaitlist({ t, lang }: { t: WaitlistCopy; lang: string }) {
  const f = t.form
  const [role, setRole] = useState<Role>('traveler')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [where, setWhere] = useState('')
  const [country, setCountry] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  /*
   * A spotter verifies places on the ground and a business has premises, so
   * both are necessarily IN the Caribbean — a free-text box there produces
   * unusable roadmap data. A traveller can be anywhere, so theirs stays open.
   */
  const needsCountry = role === 'spotter' || role === 'owner'
  const countries = [...CARIBBEAN_COUNTRIES]
    .map((c) => ({ code: c.code, label: lang === 'es' ? c.nameEs : c.name }))
    .sort((a, b) => a.label.localeCompare(b.label, lang === 'es' ? 'es' : 'en'))

  const roles: [Role, string][] = [
    ['traveler', f.roleTraveler],
    ['spotter', f.roleSpotter],
    ['owner', f.roleOwner],
  ]

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !contact.trim() || (needsCountry && !country)) {
      setError(f.errorRequired)
      return
    }
    setError(null)
    setState('sending')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role,
          name: name.trim(),
          contact: contact.trim(),
          language: lang === 'es' ? 'es' : 'en',
          // The zone roadmap is demand-driven, so where they are IS the signal.
          // Countries carry their ISO code too, so the roadmap can group by
          // country without re-parsing free text.
          details: needsCountry
            ? { where: countries.find((c) => c.code === country)?.label ?? country, countryCode: country }
            : where.trim()
              ? { where: where.trim() }
              : {},
        }),
      })
      if (res.status === 429) {
        setError(f.errorRateLimited)
        setState('idle')
        return
      }
      if (!res.ok) {
        setError(f.errorGeneric)
        setState('idle')
        return
      }
      setState('done')
    } catch {
      // Offline or the API is unreachable — keep what they typed so a
      // retry costs nothing.
      setError(f.errorGeneric)
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col justify-center gap-4 rounded-[32px] bg-white/10 p-8 text-white ring-1 ring-white/15 backdrop-blur-sm">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15">
          <Check aria-hidden="true" className="h-6 w-6 text-guaca-mango-light" />
        </span>
        <p className="text-xl font-black tracking-[-.03em]">{f.successTitle}</p>
        <p className="text-sm font-semibold leading-6 text-white/75">{f.successBody}</p>
      </div>
    )
  }

  const field =
    'h-12 w-full rounded-xl border-0 bg-white/95 px-4 text-sm font-semibold text-guaca-ink placeholder:text-guaca-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'

  return (
    <form
      onSubmit={submit}
      className="flex flex-col justify-center gap-5 rounded-[32px] bg-white/10 p-8 ring-1 ring-white/15 backdrop-blur-sm"
    >
      <p className="text-sm font-bold leading-6 text-white/80">{t.cardLede}</p>

      <fieldset>
        <legend className="text-xs font-black uppercase tracking-[.12em] text-guaca-mango-light">
          {f.roleLabel}
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              aria-pressed={role === value}
              className={`h-11 rounded-full px-4 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                role === value ? 'bg-white text-guaca-ocean-deep' : 'bg-white/12 text-white/80 hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="sr-only">{f.name}</span>
        <input
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={f.name}
          autoComplete="name"
          maxLength={200}
        />
      </label>

      <label className="block">
        <span className="sr-only">{f.contact}</span>
        <input
          className={field}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={f.contact}
          autoComplete="email"
          maxLength={200}
        />
      </label>

      {needsCountry ? (
        <label className="block">
          <span className="sr-only">{f.whereCountry}</span>
          <select
            className={`${field} appearance-none`}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">{f.whereCountryPlaceholder}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className="sr-only">{f.where}</span>
          <input
            className={field}
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder={f.wherePlaceholder}
            maxLength={120}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm font-bold text-guaca-mango-light">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="inline-flex h-14 items-center justify-center rounded-xl bg-white px-8 text-sm font-extrabold text-guaca-ocean-deep shadow-xl transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-guaca-teal disabled:opacity-70"
      >
        {state === 'sending' ? f.submitting : f.submit}
        {state !== 'sending' && <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />}
      </button>
    </form>
  )
}
