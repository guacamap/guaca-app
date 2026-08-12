import { useRef, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Compass, LoaderCircle, MapPin, Store, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type WaitlistRole = 'tourist' | 'spotter' | 'operator'

interface WaitlistFormProps {
  role: WaitlistRole
  onRoleChange: (role: WaitlistRole) => void
}

interface FormErrors {
  name?: string
  email?: string
  community?: string
}

const waitlistRoles = [
  { id: 'tourist' as const, apiRole: 'traveler', label: 'Tourist', icon: Compass },
  { id: 'spotter' as const, apiRole: 'spotter', label: 'Spotter', icon: Users },
  { id: 'operator' as const, apiRole: 'owner', label: 'Business', icon: Store },
]

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export function WaitlistForm({ role, onRoleChange }: WaitlistFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [community, setCommunity] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [serverError, setServerError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const communityRef = useRef<HTMLInputElement>(null)

  const submitWaitlist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    if (name.trim().length < 2) nextErrors.name = 'Enter your name.'
    if (!emailPattern.test(email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (community.trim().length < 2) nextErrors.community = 'Enter an island, town, or community.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setStatus('idle')
      if (nextErrors.name) nameRef.current?.focus()
      else if (nextErrors.email) emailRef.current?.focus()
      else communityRef.current?.focus()
      return
    }

    const selectedRole = waitlistRoles.find((option) => option.id === role)!
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    setStatus('submitting')
    setServerError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          role: selectedRole.apiRole,
          name: name.trim(),
          contact: email.trim().toLowerCase(),
          language: navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en',
          details: {
            community: community.trim(),
            source: 'caribbean-landing-waitlist',
          },
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error || 'The waitlist could not be reached.')
      }

      setStatus('success')
    } catch (error) {
      setStatus('error')
      setServerError(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'The request took too long. Check your connection and try again.'
          : error instanceof Error
            ? error.message
            : 'The waitlist could not be reached. Try again.',
      )
    } finally {
      window.clearTimeout(timeout)
    }
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-[470px] flex-col items-center justify-center rounded-[36px] bg-white p-8 text-center shadow-2xl shadow-guaca-ocean-deep/20 sm:p-10" role="status" aria-live="polite">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 aria-hidden="true" className="h-10 w-10" />
        </div>
        <p className="mt-7 text-xs font-black uppercase tracking-[.12em] text-guaca-teal">You’re on the list</p>
        <h3 className="mt-3 text-3xl font-black tracking-[-.04em] text-guaca-ocean-deep">We’ll meet you in {community.trim()}.</h3>
        <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-guaca-ink/60">
          We’ll contact {email.trim().toLowerCase()} as Guaca’s community coverage grows. No invented launch dates and no noisy email.
        </p>
        <Button type="button" variant="ghost" onClick={() => setStatus('idle')} className="mt-7 h-11 rounded-xl px-5 text-xs font-black text-guaca-teal hover:bg-guaca-teal/8">
          Add another person
        </Button>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={submitWaitlist} className="rounded-[36px] bg-white p-6 shadow-2xl shadow-guaca-ocean-deep/20 sm:p-8" aria-busy={status === 'submitting'}>
      <fieldset>
        <legend className="text-sm font-black text-guaca-ocean-deep">I want to join as</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {waitlistRoles.map(({ id, label, icon: Icon }) => (
            <div key={id}>
              <input id={`waitlist-role-${id}`} type="radio" name="waitlist-role" value={id} checked={role === id} onChange={() => onRoleChange(id)} className="peer sr-only" />
              <label htmlFor={`waitlist-role-${id}`} className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-guaca-sand bg-guaca-paper px-2 text-[11px] font-black text-guaca-ink/60 transition-[border-color,background-color,color] peer-checked:border-guaca-teal peer-checked:bg-guaca-teal/8 peer-checked:text-guaca-teal peer-focus-visible:ring-2 peer-focus-visible:ring-guaca-teal peer-focus-visible:ring-offset-2">
                <Icon aria-hidden="true" className="h-5 w-5" />
                {label}
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="waitlist-name" className="text-xs font-black text-guaca-ink/75">Name <span aria-hidden="true">*</span></label>
          <Input ref={nameRef} id="waitlist-name" name="name" type="text" autoComplete="name" spellCheck={false} value={name} onChange={(event) => { setName(event.target.value); setErrors((current) => ({ ...current, name: undefined })) }} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'waitlist-name-error' : undefined} placeholder="Ana Pérez" className="mt-2 h-12 rounded-2xl border-guaca-sand bg-guaca-paper/70 focus-visible:ring-guaca-teal" />
          {errors.name && <p id="waitlist-name-error" className="mt-1.5 text-xs font-bold text-guaca-coral-dark">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="waitlist-email" className="text-xs font-black text-guaca-ink/75">Email <span aria-hidden="true">*</span></label>
          <Input ref={emailRef} id="waitlist-email" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })) }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'waitlist-email-error' : undefined} placeholder="ana@example.com" className="mt-2 h-12 rounded-2xl border-guaca-sand bg-guaca-paper/70 focus-visible:ring-guaca-teal" />
          {errors.email && <p id="waitlist-email-error" className="mt-1.5 text-xs font-bold text-guaca-coral-dark">{errors.email}</p>}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="waitlist-community" className="text-xs font-black text-guaca-ink/75">Caribbean community <span aria-hidden="true">*</span></label>
        <div className="relative mt-2">
          <MapPin aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-guaca-teal" />
          <Input ref={communityRef} id="waitlist-community" name="community" type="text" autoComplete="address-level2" value={community} onChange={(event) => { setCommunity(event.target.value); setErrors((current) => ({ ...current, community: undefined })) }} aria-invalid={Boolean(errors.community)} aria-describedby={errors.community ? 'waitlist-community-error' : 'waitlist-community-hint'} placeholder="Island, town, or neighbourhood" className="h-12 rounded-2xl border-guaca-sand bg-guaca-paper/70 pl-11 focus-visible:ring-guaca-teal" />
        </div>
        {errors.community ? <p id="waitlist-community-error" className="mt-1.5 text-xs font-bold text-guaca-coral-dark">{errors.community}</p> : <p id="waitlist-community-hint" className="mt-1.5 text-xs font-medium text-guaca-ink/48">Tell us where Guaca would be most useful to you.</p>}
      </div>

      {status === 'error' && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-guaca-coral/20 bg-guaca-coral/5 p-4 text-guaca-coral-dark" role="alert">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="text-xs font-black">Couldn’t join the waitlist</p><p className="mt-1 text-xs font-medium leading-5">{serverError}</p></div>
        </div>
      )}

      <Button type="submit" disabled={status === 'submitting'} className="mt-6 h-13 w-full rounded-2xl bg-guaca-teal text-sm font-black text-white shadow-lg shadow-guaca-teal/18 hover:bg-guaca-teal-dark focus-visible:ring-guaca-ocean-deep">
        {status === 'submitting' ? <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Joining…</> : <>Join the waitlist <CheckCircle2 aria-hidden="true" className="h-4 w-4" /></>}
      </Button>
      <p className="mt-3 text-center text-[11px] font-medium leading-5 text-guaca-ink/45">Only product and community launch updates. Unsubscribe anytime.</p>
    </form>
  )
}
