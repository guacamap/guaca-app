import { useState, type FormEvent } from 'react'
import { BadgeCheck, Check, Clock3, Info, Send, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { GuacaLogo, GuacaMark } from './GuacaBrand'
import {
  UPDATE_CATEGORIES,
  formatUpdateTime,
  useInfoStore,
  type UpdateCategory,
} from './InfoStore'

interface FormErrors {
  businessName?: string
  community?: string
  title?: string
  details?: string
}

export function OperatorView() {
  const { updates, addUpdate } = useInfoStore()
  const [joined, setJoined] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [community, setCommunity] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [category, setCategory] = useState<UpdateCategory>('Hours')
  const [errors, setErrors] = useState<FormErrors>({})
  const [publishedId, setPublishedId] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    if (!businessName.trim()) nextErrors.businessName = 'Enter the business name.'
    if (!community.trim()) nextErrors.community = 'Enter the island, town, or community.'
    if (!title.trim()) nextErrors.title = 'Add a short headline.'
    if (!details.trim()) nextErrors.details = 'Describe what visitors should know.'

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setPublishedId(null)
      return
    }

    const id = addUpdate({ businessName, community, title, details, category })
    setTitle('')
    setDetails('')
    setErrors({})
    setPublishedId(id)
  }

  if (joined) {
    return (
      <div className="relative h-full min-h-screen overflow-y-auto bg-guaca-sand-light px-5 pb-32 pt-12 sm:min-h-full">
        <header className="flex items-center justify-between">
          <div>
            <GuacaLogo className="h-10" />
            <p className="mt-1 text-[11px] font-bold text-guaca-ink/45">Business publisher</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-guaca-sand/80">
            <Store aria-hidden="true" className="h-6 w-6 text-guaca-teal" />
          </div>
        </header>

        <section className="mt-6 rounded-[30px] bg-gradient-to-br from-guaca-teal to-guaca-ocean p-5 text-white shadow-xl shadow-guaca-teal/20">
          <div className="flex items-start gap-3">
            <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h1 className="text-[20px] font-black leading-tight">Publish what visitors need to know.</h1>
              <p className="mt-2 text-[12px] font-semibold leading-relaxed text-white/78">
                Your update appears immediately for tourists and is available for a local spotter to verify.
              </p>
            </div>
          </div>
        </section>

        <form noValidate onSubmit={handleSubmit} className="mt-5 rounded-[30px] bg-white/88 p-5 shadow-sm ring-1 ring-guaca-sand/80">
          <h2 className="text-[15px] font-black text-guaca-ink">Add information</h2>

          <div className="mt-5">
            <label htmlFor="business-name" className="text-[11px] font-black text-guaca-ink/72">Business name</label>
            <Input
              id="business-name"
              value={businessName}
              onChange={(event) => {
                setBusinessName(event.target.value)
                setErrors((current) => ({ ...current, businessName: undefined }))
              }}
              aria-invalid={Boolean(errors.businessName)}
              aria-describedby={errors.businessName ? 'business-name-error' : undefined}
              placeholder="Enter your business name"
              className="mt-2 h-12 rounded-2xl border-guaca-sand bg-guaca-sand-light/55 text-[13px] focus-visible:ring-guaca-teal"
            />
            {errors.businessName && <p id="business-name-error" className="mt-1.5 text-[10px] font-bold text-guaca-coral-dark">{errors.businessName}</p>}
          </div>

          <div className="mt-4">
            <label htmlFor="business-community" className="text-[11px] font-black text-guaca-ink/72">Caribbean community</label>
            <Input
              id="business-community"
              value={community}
              onChange={(event) => {
                setCommunity(event.target.value)
                setErrors((current) => ({ ...current, community: undefined }))
              }}
              aria-invalid={Boolean(errors.community)}
              aria-describedby={errors.community ? 'business-community-error' : 'business-community-hint'}
              placeholder="Island, town, or neighbourhood"
              className="mt-2 h-12 rounded-2xl border-guaca-sand bg-guaca-sand-light/55 text-[13px] focus-visible:ring-guaca-teal"
            />
            {errors.community ? (
              <p id="business-community-error" className="mt-1.5 text-[10px] font-bold text-guaca-coral-dark">{errors.community}</p>
            ) : (
              <p id="business-community-hint" className="mt-1.5 text-[10px] font-semibold text-guaca-ink/42">This keeps the update attached to the right place.</p>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="update-category" className="text-[11px] font-black text-guaca-ink/72">Type of information</label>
            <select
              id="update-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as UpdateCategory)}
              className="mt-2 h-12 w-full rounded-2xl border border-guaca-sand bg-guaca-sand-light/55 px-3 text-[13px] font-semibold text-guaca-ink outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-guaca-teal"
            >
              {UPDATE_CATEGORIES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>

          <div className="mt-4">
            <label htmlFor="update-title" className="text-[11px] font-black text-guaca-ink/72">Headline</label>
            <Input
              id="update-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setErrors((current) => ({ ...current, title: undefined }))
              }}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'update-title-error' : undefined}
              placeholder="What changed?"
              className="mt-2 h-12 rounded-2xl border-guaca-sand bg-guaca-sand-light/55 text-[13px] focus-visible:ring-guaca-teal"
            />
            {errors.title && <p id="update-title-error" className="mt-1.5 text-[10px] font-bold text-guaca-coral-dark">{errors.title}</p>}
          </div>

          <div className="mt-4">
            <label htmlFor="update-details" className="text-[11px] font-black text-guaca-ink/72">Details</label>
            <Textarea
              id="update-details"
              value={details}
              onChange={(event) => {
                setDetails(event.target.value)
                setErrors((current) => ({ ...current, details: undefined }))
              }}
              aria-invalid={Boolean(errors.details)}
              aria-describedby={errors.details ? 'update-details-error' : 'update-details-hint'}
              placeholder="Add hours, availability, conditions, or another useful detail."
              className="mt-2 min-h-28 resize-none rounded-2xl border-guaca-sand bg-guaca-sand-light/55 text-[13px] leading-relaxed focus-visible:ring-guaca-teal"
            />
            {errors.details ? (
              <p id="update-details-error" className="mt-1.5 text-[10px] font-bold text-guaca-coral-dark">{errors.details}</p>
            ) : (
              <p id="update-details-hint" className="mt-1.5 text-[10px] font-semibold text-guaca-ink/42">Only publish information you can confirm.</p>
            )}
          </div>

          <Button type="submit" className="mt-5 h-12 w-full rounded-2xl bg-gradient-to-r from-guaca-teal to-[#12A89F] text-sm font-extrabold text-white shadow-lg shadow-guaca-teal/18 hover:from-guaca-teal-dark hover:to-guaca-teal">
            <Send aria-hidden="true" className="mr-2 h-4 w-4" />
            Publish update
          </Button>

          <div aria-live="polite">
            {publishedId && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-3 text-[11px] font-bold text-emerald-800">
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                Published. Switch roles to see this update as a tourist or spotter.
              </p>
            )}
          </div>
        </form>

        <section className="mt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[14px] font-black text-guaca-ink">Published from this device</h2>
              <p className="mt-1 text-[10px] font-semibold text-guaca-ink/45">Saved here so you can test the full role flow.</p>
            </div>
            {updates.length > 0 && <span className="shrink-0 text-[10px] font-black text-guaca-teal">{updates.length} total</span>}
          </div>

          {updates.length === 0 ? (
            <div className="mt-3 rounded-[26px] border border-dashed border-guaca-teal/28 bg-white/55 p-5 text-center">
              <Store aria-hidden="true" className="mx-auto h-6 w-6 text-guaca-teal/55" />
              <p className="mt-3 text-[12px] font-black text-guaca-ink">No information published yet</p>
              <p className="mt-1 text-[10px] font-semibold leading-relaxed text-guaca-ink/48">Your first update will appear here.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {updates.map((update) => (
                <article key={update.id} className="rounded-[26px] bg-white/88 p-4 shadow-sm ring-1 ring-guaca-sand/80">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-guaca-teal/8 px-2.5 py-1 text-[9px] font-black text-guaca-teal">{update.category}</span>
                    <span className={`flex items-center gap-1 text-[9px] font-black ${update.status === 'verified' ? 'text-emerald-700' : 'text-guaca-ink/42'}`}>
                      {update.status === 'verified' ? <BadgeCheck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                      {update.status === 'verified' ? 'Verified' : 'Awaiting verification'}
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] font-black text-guaca-teal-dark">{update.businessName}{update.community ? ` · ${update.community}` : ''}</p>
                  <h3 className="mt-1 text-[13px] font-black leading-snug text-guaca-ink">{update.title}</h3>
                  <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-guaca-ink/58">{update.details}</p>
                  <p className="mt-3 text-[9px] font-semibold text-guaca-ink/38">{formatUpdateTime(update.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-screen overflow-hidden bg-guaca-sand-light px-5 pb-8 pt-12 sm:min-h-full">
      <div className="text-center">
        <p className="text-[15px] font-extrabold text-guaca-ink">Join as a Business</p>
        <p className="mt-1 text-[11px] text-guaca-ink/45">Share current information directly</p>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="relative flex h-36 w-36 items-center justify-center rounded-[36px] bg-gradient-to-br from-guaca-teal-light/55 via-white to-guaca-sand shadow-xl ring-1 ring-guaca-sand/80">
          <img src="/assets/business-store.png" alt="Guaca business storefront" className="h-28 w-32 object-contain" />
          <span className="absolute -right-3 top-6">
            <GuacaMark className="h-12 w-auto drop-shadow-md" />
          </span>
        </div>
      </div>

      <div className="mt-7 text-center">
        <h1 className="text-[20px] font-black leading-tight text-guaca-ink">Tell visitors what they need to know now.</h1>
        <p className="mx-auto mt-3 max-w-[290px] text-[12px] font-semibold leading-relaxed text-guaca-ink/55">
          Publish opening hours, availability, menu changes, offers, or another useful update.
        </p>
      </div>

      <div className="mt-7 h-px bg-guaca-sand" />

      <div className="mt-6 space-y-4">
        {[
          'Tourists see updates immediately',
          'Spotters can verify the information',
          'Updates remain available after refresh',
        ].map((benefit) => (
          <div key={benefit} className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-guaca-teal/10 text-guaca-teal">
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <span className="text-[13px] font-bold text-guaca-ink/78">{benefit}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-8 left-5 right-5">
        <Button type="button" onClick={() => setJoined(true)} className="h-13 w-full rounded-2xl bg-gradient-to-r from-guaca-teal to-[#12A89F] text-sm font-extrabold text-white shadow-lg shadow-guaca-teal/18 hover:from-guaca-teal-dark hover:to-guaca-teal">
          <Store aria-hidden="true" className="mr-2 h-4 w-4" />
          Add business information
        </Button>
      </div>
    </div>
  )
}
