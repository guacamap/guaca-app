import { useState, type FormEvent } from 'react'
import { AlertCircle, BadgeCheck, Check, ChevronLeft, Compass, LoaderCircle, MapPin, Star, Store, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GuacaMark } from './GuacaBrand'

type Role = 'tourist' | 'spotter' | 'operator'

interface JoinRoleProps {
  role: Role
  onDone: () => void
  onBack: () => void
}

/*
 * The real registration surface. Unlike the landing waitlist (a preview),
 * this posts to POST /api/register — proxied by Vite to the API — and the
 * row lands in the registrations table.
 */
const ROLE_COPY: Record<Role, {
  apiRole: 'traveler' | 'spotter' | 'owner'
  title: string
  headline: string
  benefits: { icon: typeof Check; text: string }[]
  cta: string
  accent: string
  ctaClass: string
  icon: typeof Compass
}> = {
  tourist: {
    apiRole: 'traveler',
    title: 'Join as a Tourist',
    headline: 'Real local info for your Caribbean trip.',
    benefits: [
      { icon: Check, text: 'Locally verified places, not reviews from years ago' },
      { icon: Check, text: 'Plans built from current information' },
      { icon: Star, text: 'One message when your coast opens' },
    ],
    cta: 'Continue as Tourist',
    accent: 'text-guaca-teal',
    ctaClass: 'bg-guaca-teal hover:bg-guaca-teal-dark shadow-guaca-teal/18',
    icon: Compass,
  },
  spotter: {
    apiRole: 'spotter',
    title: 'Join as a Spotter',
    headline: 'Share real-time info, help your community and earn rewards.',
    benefits: [
      { icon: Check, text: 'Get recognized in your community' },
      { icon: Check, text: 'Unlock exclusive rewards' },
      { icon: Star, text: 'Make your city better' },
    ],
    cta: 'Continue as Spotter',
    accent: 'text-guaca-coral',
    ctaClass: 'bg-guaca-coral hover:bg-guaca-coral-dark shadow-guaca-coral/24',
    icon: Trophy,
  },
  operator: {
    apiRole: 'owner',
    title: 'Join as a Business',
    headline: 'List your business, connect with locals and travelers.',
    benefits: [
      { icon: Check, text: 'Be visible on the live map' },
      { icon: Check, text: 'Share updates and offers' },
      { icon: Check, text: 'Build trust with locals' },
    ],
    cta: 'Continue as Business',
    accent: 'text-guaca-ocean',
    ctaClass: 'bg-guaca-ocean hover:bg-guaca-ocean-deep shadow-guaca-ocean/24',
    icon: Store,
  },
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function JoinRole({ role, onDone, onBack }: JoinRoleProps) {
  const copy = ROLE_COPY[role]
  const RoleIcon = copy.icon
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [community, setCommunity] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return
    if (name.trim().length < 2 || !emailPattern.test(contact.trim()) || community.trim().length < 2) {
      setStatus('error')
      setError('Enter your name, a valid email, and your community.')
      return
    }
    setStatus('submitting')
    setError('')
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role: copy.apiRole,
          name: name.trim(),
          contact: contact.trim().toLowerCase(),
          language: navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en',
          details: { community: community.trim(), source: 'app-join' },
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error || 'Registration could not be reached.')
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Registration could not be reached.')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center bg-guaca-sand-light px-7 text-center sm:min-h-full" role="status" aria-live="polite">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <BadgeCheck aria-hidden="true" className="h-10 w-10" />
        </div>
        <h2 className="mt-6 text-[20px] font-black text-guaca-ink">You’re registered</h2>
        <p className="mt-2 max-w-[270px] text-[12px] font-semibold leading-relaxed text-guaca-ink/55">
          {name.trim().split(' ')[0]}, your {copy.apiRole === 'owner' ? 'business' : copy.apiRole} registration for {community.trim()} was recorded. A person reads every one.
        </p>
        <Button type="button" onClick={onDone} className={`mt-7 h-12 w-full max-w-xs rounded-2xl text-xs font-black text-white shadow-lg ${copy.ctaClass}`}>
          Enter Guaca
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-screen flex-col overflow-y-auto bg-guaca-sand-light px-6 pb-8 pt-6 sm:min-h-full">
      <header className="grid grid-cols-[44px_1fr_44px] items-center">
        <Button type="button" size="icon" variant="ghost" aria-label="Back to role selection" onClick={onBack} className="h-11 w-11 rounded-full text-guaca-ink hover:bg-white">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-center text-[15px] font-black text-guaca-ink">{copy.title}</h1>
        <span aria-hidden="true" />
      </header>

      <div className="mt-5 flex flex-col items-center text-center">
        <GuacaMark className="h-20 w-auto drop-shadow-md" />
        <h2 className="mt-4 max-w-[280px] text-[17px] font-black leading-snug text-guaca-ink">{copy.headline}</h2>
      </div>

      <ul className="mt-5 space-y-2.5">
        {copy.benefits.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-guaca-sand/75">
            <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${copy.accent}`} />
            <span className="text-[12px] font-bold text-guaca-ink/75">{text}</span>
          </li>
        ))}
      </ul>

      <form noValidate onSubmit={submit} className="mt-5 space-y-3" aria-busy={status === 'submitting'}>
        <div>
          <label htmlFor="join-name" className="text-[11px] font-black text-guaca-ink/70">Name</label>
          <Input id="join-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Pérez" className="mt-1.5 h-12 rounded-2xl border-guaca-sand bg-white focus-visible:ring-guaca-teal" />
        </div>
        <div>
          <label htmlFor="join-contact" className="text-[11px] font-black text-guaca-ink/70">Email</label>
          <Input id="join-contact" type="email" inputMode="email" autoComplete="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="ana@example.com" className="mt-1.5 h-12 rounded-2xl border-guaca-sand bg-white focus-visible:ring-guaca-teal" />
        </div>
        <div>
          <label htmlFor="join-community" className="text-[11px] font-black text-guaca-ink/70">Your Caribbean community</label>
          <div className="relative mt-1.5">
            <MapPin aria-hidden="true" className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${copy.accent}`} />
            <Input id="join-community" type="text" value={community} onChange={(e) => setCommunity(e.target.value)} placeholder="Island, town, or neighbourhood" className="h-12 rounded-2xl border-guaca-sand bg-white pl-11 focus-visible:ring-guaca-teal" />
          </div>
        </div>

        {status === 'error' && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-guaca-coral/20 bg-guaca-coral/5 p-3 text-guaca-coral-dark" role="alert">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-[11px] font-bold leading-relaxed">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={status === 'submitting'} className={`h-13 w-full rounded-2xl text-xs font-black text-white shadow-lg ${copy.ctaClass}`}>
          {status === 'submitting' ? <><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> Registering…</> : <><RoleIcon aria-hidden="true" className="mr-2 h-4 w-4" /> {copy.cta}</>}
        </Button>
      </form>

      <button type="button" onClick={onDone} className="mt-4 text-center text-[11px] font-bold text-guaca-ink/45 underline decoration-guaca-ink/25">
        Skip for now — explore first
      </button>
    </div>
  )
}
