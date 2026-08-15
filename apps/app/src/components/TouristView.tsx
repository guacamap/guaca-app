import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Clock3,
  Globe,
  LogOut,
  MapPin,
  Megaphone,
  Route,
  Search,
  Send,
  Sparkles,
  Store,
  Trash2,
  Trophy,
  UserRound,
  X,
} from 'lucide-react'
import { Button, GuacaMap, GuacaMark, Input, formatUpdateTime, useInfoStore, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'

/** Puerto Cabello — the pilot area; also the geolocation fallback. */
const PILOT_CENTER: [number, number] = [-68.0056, 10.4716]
const BBOX_HALF_DEG = 0.06 // ~6.5 km — the walkable pilot zone
const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://guaca.live'

const THREAD_KEY = 'guaca:thread'
const PLAN_KEY = 'guaca:plan'

interface ApiPlace {
  id: string
  name: string
  category: string
  landmark_description: string | null
  description: string | null
  lat: number
  lon: number
  spotter_name: string | null
  spotter_photo_url: string | null
  verified_at: string | null
}

type AskState =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'answer'; text: string; placeIds: string[] }
  | { kind: 'refusal'; text: string }
  | { kind: 'error' }

interface ChatMsg {
  id: string
  role: 'user' | 'guaca'
  kind?: 'answer' | 'refusal' | 'error'
  text: string
  placeIds?: string[]
}

interface SavedPlan {
  question: string
  text: string
  placeIds: string[]
  savedAt: string
}

interface Me {
  email: string
  language: string
  propertyName: string | null
}

const CATEGORY_GLYPH: Record<string, { emoji: string; color: string }> = {
  eat_drink: { emoji: '🍽️', color: '#E8735A' },
  beach_water: { emoji: '🏖️', color: '#0D8B8B' },
  nature_walk: { emoji: '🥾', color: '#2D8B4E' },
  culture_history: { emoji: '🏛️', color: '#0C4A5C' },
  market_shop: { emoji: '🛍️', color: '#D4A853' },
  services: { emoji: '🔧', color: '#2D4A50' },
}

function initials(name: string | null): string {
  if (!name) return '·'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full/blocked — the app still works without persistence */
  }
}

type Tab = 'map' | 'guaca' | 'plan' | 'profile' | 'updates'

export function TouristView() {
  const { updates } = useInfoStore()
  const { lang, setLang } = useLanguage()
  const t = appCopy[lang].tourist
  const [query, setQuery] = useState('')
  const [askText, setAskText] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [center, setCenter] = useState<[number, number]>(PILOT_CENTER)
  const [places, setPlaces] = useState<ApiPlace[]>([])
  const [askState, setAskState] = useState<AskState>({ kind: 'idle' })
  const [selected, setSelected] = useState<ApiPlace | null>(null)

  // Guaca AI thread + saved plan, persisted locally on this device.
  const [thread, setThread] = useState<ChatMsg[]>([])
  const [guacaText, setGuacaText] = useState('')
  const [guacaBusy, setGuacaBusy] = useState(false)
  const [plan, setPlan] = useState<SavedPlan | null>(null)
  const [planPlaces, setPlanPlaces] = useState<Record<string, ApiPlace>>({})
  const [me, setMe] = useState<Me | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setThread(loadJson<ChatMsg[]>(THREAD_KEY) ?? [])
    setPlan(loadJson<SavedPlan>(PLAN_KEY))
  }, [])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread, guacaBusy])

  // Centre on the guest if they allow it; the pilot area otherwise (§T1.4).
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.longitude, pos.coords.latitude]),
      () => {},
      { timeout: 3000, maximumAge: 300_000 },
    )
  }, [])

  // Real pins: verified rows only, straight from Postgres.
  useEffect(() => {
    const [lon, lat] = center
    const bbox = [
      lon - BBOX_HALF_DEG,
      lat - BBOX_HALF_DEG,
      lon + BBOX_HALF_DEG,
      lat + BBOX_HALF_DEG,
    ].join(',')
    fetch(`/api/places?bbox=${bbox}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { places: [] }))
      .then((data: { places: ApiPlace[] }) => setPlaces(data.places ?? []))
      .catch(() => {})
  }, [center])

  // Account details for the Profile tab.
  useEffect(() => {
    if (activeTab !== 'profile' || me) return
    fetch('/api/tourist/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Me | null) => {
        if (data) setMe(data)
      })
      .catch(() => {})
  }, [activeTab, me])

  // Resolve plan stops that are outside the current map bbox.
  useEffect(() => {
    if (!plan) return
    for (const id of plan.placeIds) {
      if (places.some((p) => p.id === id) || planPlaces[id]) continue
      fetch(`/api/places/${id}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((full: ApiPlace | null) => {
          if (full) setPlanPlaces((prev) => ({ ...prev, [id]: full }))
        })
        .catch(() => {})
    }
  }, [plan, places, planPlaces])

  const pins = useMemo(
    () =>
      places.map((p) => {
        const glyph = CATEGORY_GLYPH[p.category] ?? { emoji: '📍', color: '#0D8B8B' }
        return {
          id: p.id,
          lat: p.lat,
          lng: p.lon,
          emoji: glyph.emoji,
          label: p.name,
          spotterColor: glyph.color,
          spotterInitials: initials(p.spotter_name),
          verified: true,
        }
      }),
    [places],
  )

  /** One grounded call for the map box AND the Guaca thread (§7.3). */
  const askApi = async (
    text: string,
  ): Promise<{ kind: 'answer' | 'refusal'; text: string; placeIds: string[] } | null> => {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, language: lang, lat: center[1], lon: center[0] }),
    })
    if (!res.ok) return null
    return (await res.json()) as { kind: 'answer' | 'refusal'; text: string; placeIds: string[] }
  }

  const savePlanFromAnswer = (question: string, text: string, placeIds: string[]) => {
    if (placeIds.length === 0) return
    const next: SavedPlan = { question, text, placeIds, savedAt: new Date().toISOString() }
    setPlan(next)
    saveJson(PLAN_KEY, next)
  }

  const ask = async () => {
    const text = askText.trim()
    if (!text || askState.kind === 'asking') return
    setSelected(null)
    setAskState({ kind: 'asking' })
    try {
      const body = await askApi(text)
      if (!body) return setAskState({ kind: 'error' })
      if (body.kind === 'answer') {
        setAskState({ kind: 'answer', text: body.text, placeIds: body.placeIds })
        savePlanFromAnswer(text, body.text, body.placeIds)
      } else {
        setAskState({ kind: 'refusal', text: body.text })
      }
    } catch {
      setAskState({ kind: 'error' })
    }
  }

  const askGuaca = async (raw?: string) => {
    const text = (raw ?? guacaText).trim()
    if (!text || guacaBusy) return
    setGuacaText('')
    setGuacaBusy(true)
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: 'user', text }
    setThread((prev) => {
      const next = [...prev, userMsg]
      saveJson(THREAD_KEY, next)
      return next
    })
    let reply: ChatMsg
    try {
      const body = await askApi(text)
      if (!body) {
        reply = { id: crypto.randomUUID(), role: 'guaca', kind: 'error', text: t.askError }
      } else {
        reply = {
          id: crypto.randomUUID(),
          role: 'guaca',
          kind: body.kind,
          text: body.text,
          placeIds: body.placeIds,
        }
        if (body.kind === 'answer') savePlanFromAnswer(text, body.text, body.placeIds)
      }
    } catch {
      reply = { id: crypto.randomUUID(), role: 'guaca', kind: 'error', text: t.askError }
    }
    setThread((prev) => {
      const next = [...prev, reply].slice(-60)
      saveJson(THREAD_KEY, next)
      return next
    })
    setGuacaBusy(false)
  }

  const openPlace = (id: string) => {
    const known = places.find((p) => p.id === id) ?? planPlaces[id]
    if (known) setSelected(known)
    fetch(`/api/places/${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((full: ApiPlace | null) => {
        if (full) setSelected(full)
      })
      .catch(() => {})
  }

  const openPlaceOnMap = (id: string) => {
    setActiveTab('map')
    openPlace(id)
  }

  const changeLanguage = (next: 'en' | 'es') => {
    if (next === lang) return
    setLang(next)
    fetch('/api/tourist/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ language: next }),
    }).catch(() => {})
  }

  const signOut = async () => {
    try {
      await fetch('/api/tourist/logout', { method: 'POST', credentials: 'include' })
    } catch {
      /* the cookie clear is best-effort; reload lands on the gate either way */
    }
    window.location.href = '/'
  }

  const answerPlaces =
    askState.kind === 'answer'
      ? (askState.placeIds.map((id) => places.find((p) => p.id === id)).filter(Boolean) as ApiPlace[])
      : []

  const placeById = (id: string): ApiPlace | undefined =>
    places.find((p) => p.id === id) ?? planPlaces[id]

  const renderMap = () => (
    <>
      <div className="absolute inset-0 z-0">
        <GuacaMap
          pins={pins}
          selectedPinId={selected?.id ?? null}
          onPinClick={openPlace}
          mapStyle="streets"
          center={center}
          zoom={13.4}
          fallbackImage="/assets/landing-caribbean-phone.jpg"
        />
      </div>
      <div className="absolute inset-x-0 top-0 z-[400] bg-gradient-to-b from-guaca-ocean-deep/55 via-guaca-ocean/12 to-transparent px-4 pb-12 pt-8">
        <form
          onSubmit={(e) => { e.preventDefault(); void ask() }}
          className="flex items-center gap-2 rounded-full border border-white/65 bg-guaca-sand-light/95 px-3 py-2 shadow-xl shadow-guaca-ocean-deep/14 backdrop-blur-md"
        >
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-guaca-ocean/55" />
          <Input
            value={askText}
            onChange={(event) => setAskText(event.target.value)}
            placeholder={t.askPlaceholder}
            aria-label={t.askPlaceholder}
            className="h-7 flex-1 border-0 bg-transparent px-0 text-[12px] shadow-none placeholder:text-guaca-ink/35 focus-visible:ring-0"
          />
          <Button type="button" size="icon" variant="ghost" aria-label={t.profileUpdates} onClick={() => setActiveTab('updates')} className="relative h-10 w-10 rounded-full bg-white/70 text-guaca-ocean hover:bg-white">
            <Bell aria-hidden="true" className="h-3.5 w-3.5" />
            {updates.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-guaca-coral ring-2 ring-white" />}
          </Button>
        </form>
      </div>

      {/* Place sheet — landmark first, the Spotter's face on the record. */}
      {selected && (
        <div className="absolute bottom-[82px] left-4 right-4 z-[650]">
          <div className="guaca-card rounded-[30px] p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black leading-tight text-guaca-ink">{selected.name}</h3>
              <button type="button" aria-label={t.close} onClick={() => setSelected(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-guaca-ink/6 text-guaca-ink/60 hover:bg-guaca-ink/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            {selected.landmark_description && (
              <>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[.1em] text-guaca-teal">{t.landmarkLabel}</p>
                <p className="mt-1 text-[15px] font-bold leading-snug text-guaca-ink">{selected.landmark_description}</p>
              </>
            )}
            {selected.description && (
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-guaca-ink/60">{selected.description}</p>
            )}
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-guaca-teal/7 p-3">
              {selected.spotter_photo_url ? (
                <img src={selected.spotter_photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-full bg-guaca-teal text-xs font-black text-white">
                  {initials(selected.spotter_name)}
                </span>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[10px] font-black text-guaca-teal">
                  <BadgeCheck className="h-3.5 w-3.5" /> {t.verifiedBy}
                </p>
                <p className="truncate text-[13px] font-black text-guaca-ink">
                  {selected.spotter_name ?? '—'}
                  {selected.verified_at && (
                    <span className="ml-2 text-[10px] font-bold text-guaca-ink/45">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(selected.verified_at))}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ask result / teaser card. */}
      {!selected && (
        <div className="absolute bottom-[82px] left-4 right-4 z-[650]">
          {askState.kind === 'asking' && (
            <div className="guaca-card rounded-[30px] p-4">
              <p className="text-[12px] font-black text-guaca-ink/55">{t.asking}</p>
            </div>
          )}

          {askState.kind === 'refusal' && (
            <div className="rounded-[30px] bg-guaca-ocean-deep p-5 text-white shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[.12em] text-guaca-mango-light">{t.refusalTitle}</p>
                <button type="button" aria-label={t.close} onClick={() => setAskState({ kind: 'idle' })} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-[15px] font-black leading-snug">{askState.text}</p>
              <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/65">{t.refusalNote}</p>
            </div>
          )}

          {askState.kind === 'answer' && (
            <div className="guaca-card rounded-[30px] p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] text-guaca-teal">
                  <BadgeCheck className="h-3.5 w-3.5" /> {t.answerTitle}
                </p>
                <button type="button" aria-label={t.close} onClick={() => setAskState({ kind: 'idle' })} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-guaca-ink/6 text-guaca-ink/60 hover:bg-guaca-ink/10">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-[13px] font-bold leading-relaxed text-guaca-ink">{askState.text}</p>
              {answerPlaces.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {answerPlaces.map((p) => (
                    <button key={p.id} type="button" onClick={() => openPlace(p.id)} className="rounded-full bg-guaca-teal/8 px-3 py-1.5 text-[10px] font-black text-guaca-teal hover:bg-guaca-teal/15">
                      {(CATEGORY_GLYPH[p.category] ?? { emoji: '📍' }).emoji} {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {askState.kind === 'error' && (
            <div className="guaca-card rounded-[30px] p-4">
              <p className="text-[12px] font-black text-guaca-coral-dark">{t.askError}</p>
            </div>
          )}

          {askState.kind === 'idle' && places.length === 0 && (
            <div className="guaca-card rounded-[30px] p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-guaca-teal/10 text-guaca-teal"><MapPin aria-hidden="true" className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-[14px] font-black text-guaca-ink">{t.emptyMapTitle}</h3>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-guaca-ink/52">{t.emptyMapBody}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )

  const renderGuaca = () => (
    <div className="flex h-full flex-col bg-guaca-sand-light">
      <div className="shrink-0 bg-gradient-to-br from-guaca-teal to-guaca-ocean px-5 pb-4 pt-12 text-white">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.14em] text-white/80">
          <Sparkles className="h-3.5 w-3.5" /> {t.guacaTitle}
        </p>
        <p className="mt-1 text-[12px] font-semibold leading-relaxed text-white/88">{t.guacaLede}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
        {thread.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-guaca-teal/28 bg-white/70 p-5 text-center">
            <Sparkles aria-hidden="true" className="mx-auto h-7 w-7 text-guaca-teal/60" />
            <h3 className="mt-3 text-[14px] font-black text-guaca-ink">{t.guacaEmptyTitle}</h3>
            <p className="mx-auto mt-1 max-w-[250px] text-[11px] font-semibold leading-relaxed text-guaca-ink/50">{t.guacaEmptyBody}</p>
            <div className="mt-4 space-y-2">
              {t.guacaSuggestions.map((s) => (
                <button key={s} type="button" onClick={() => void askGuaca(s)} className="block w-full rounded-2xl bg-guaca-teal/8 px-4 py-2.5 text-[12px] font-black text-guaca-teal hover:bg-guaca-teal/15">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {thread.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[80%] rounded-3xl rounded-br-lg bg-guaca-teal px-4 py-2.5 text-[13px] font-bold leading-relaxed text-white shadow-sm">{m.text}</p>
              </div>
            ) : m.kind === 'refusal' ? (
              <div key={m.id} className="max-w-[92%] rounded-3xl rounded-bl-lg bg-guaca-ocean-deep p-4 text-white shadow-md">
                <p className="text-[9px] font-black uppercase tracking-[.12em] text-guaca-mango-light">{t.refusalTitle}</p>
                <p className="mt-1.5 whitespace-pre-line text-[13px] font-black leading-snug">{m.text}</p>
                <p className="mt-1.5 text-[10px] font-bold leading-relaxed text-white/65">{t.refusalNote}</p>
              </div>
            ) : (
              <div key={m.id} className="guaca-card max-w-[92%] rounded-3xl rounded-bl-lg p-4">
                {m.kind === 'answer' && (
                  <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[.12em] text-guaca-teal">
                    <BadgeCheck className="h-3 w-3" /> {t.answerTitle}
                  </p>
                )}
                <p className={`mt-1 whitespace-pre-line text-[13px] font-bold leading-relaxed ${m.kind === 'error' ? 'text-guaca-coral-dark' : 'text-guaca-ink'}`}>{m.text}</p>
                {(m.placeIds ?? []).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(m.placeIds ?? []).map((id) => {
                      const p = placeById(id)
                      if (!p) return null
                      return (
                        <button key={id} type="button" onClick={() => openPlaceOnMap(id)} className="rounded-full bg-guaca-teal/8 px-3 py-1.5 text-[10px] font-black text-guaca-teal hover:bg-guaca-teal/15">
                          {(CATEGORY_GLYPH[p.category] ?? { emoji: '📍' }).emoji} {p.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ),
          )}
          {guacaBusy && (
            <div className="guaca-card max-w-[70%] rounded-3xl rounded-bl-lg p-4">
              <p className="text-[12px] font-black text-guaca-ink/50">{t.asking}</p>
            </div>
          )}
        </div>
        {thread.length > 0 && !guacaBusy && (
          <button
            type="button"
            onClick={() => { setThread([]); saveJson(THREAD_KEY, []) }}
            className="mx-auto mt-4 block text-[10px] font-bold text-guaca-ink/38 underline-offset-2 hover:underline"
          >
            {t.guacaClear}
          </button>
        )}
        <div ref={threadEndRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void askGuaca() }}
        className="shrink-0 px-4 pb-[92px]"
      >
        <div className="flex items-center gap-2 rounded-full border border-guaca-sand bg-white px-3 py-2 shadow-lg shadow-guaca-ocean-deep/8">
          <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-guaca-teal/60" />
          <Input
            value={guacaText}
            onChange={(e) => setGuacaText(e.target.value)}
            placeholder={t.guacaPlaceholder}
            aria-label={t.guacaPlaceholder}
            className="h-8 flex-1 border-0 bg-transparent px-0 text-[13px] shadow-none placeholder:text-guaca-ink/35 focus-visible:ring-0"
          />
          <Button type="submit" size="icon" disabled={guacaBusy || !guacaText.trim()} aria-label={t.guacaPlaceholder} className="h-9 w-9 rounded-full bg-guaca-teal text-white hover:bg-guaca-teal-dark">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )

  const renderPlan = () => (
    <div className="h-full overflow-y-auto bg-guaca-sand-light px-5 pb-28 pt-12">
      <div className="rounded-[32px] bg-gradient-to-br from-guaca-ocean to-guaca-ocean-deep p-6 text-white shadow-xl">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.14em] text-white/75">
          <Route className="h-3.5 w-3.5" /> {t.planTitle}
        </p>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-white/88">{t.planLede}</p>
      </div>

      {!plan ? (
        <div className="mt-5 rounded-[28px] border border-dashed border-guaca-teal/28 bg-white/70 p-6 text-center">
          <Route aria-hidden="true" className="mx-auto h-8 w-8 text-guaca-teal/55" />
          <h3 className="mt-3 text-[14px] font-black text-guaca-ink">{t.planEmptyTitle}</h3>
          <p className="mx-auto mt-1 max-w-[250px] text-[11px] font-semibold leading-relaxed text-guaca-ink/50">{t.planEmptyBody}</p>
          <Button type="button" onClick={() => { setActiveTab('guaca'); void askGuaca(t.guacaSuggestions[0]) }} className="mt-4 h-11 rounded-2xl bg-guaca-teal px-5 text-xs font-black text-white hover:bg-guaca-teal-dark">
            <Sparkles className="mr-1.5 h-4 w-4" /> {t.planEmptyCta}
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
            <p className="text-[9px] font-black uppercase tracking-[.12em] text-guaca-teal">{t.planFromQuestion}</p>
            <p className="mt-1 text-[13px] font-black text-guaca-ink">“{plan.question}”</p>
            <p className="mt-3 whitespace-pre-line text-[12px] font-semibold leading-relaxed text-guaca-ink/68">{plan.text}</p>
          </div>

          <div className="mt-4 space-y-2.5">
            {plan.placeIds.map((id, i) => {
              const p = placeById(id)
              const glyph = p ? CATEGORY_GLYPH[p.category] ?? { emoji: '📍', color: '#0D8B8B' } : { emoji: '📍', color: '#0D8B8B' }
              return (
                <div key={id} className="flex items-center gap-3 rounded-[24px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg" style={{ backgroundColor: `${glyph.color}18` }}>
                    {glyph.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-guaca-ink/40">{i + 1}</p>
                    <p className="truncate text-[13px] font-black text-guaca-ink">{p?.name ?? '…'}</p>
                    {p?.spotter_name && (
                      <p className="flex items-center gap-1 text-[10px] font-bold text-guaca-teal">
                        <BadgeCheck className="h-3 w-3" /> {p.spotter_name}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => openPlaceOnMap(id)} className="shrink-0 rounded-full bg-guaca-teal/8 px-3 py-2 text-[10px] font-black text-guaca-teal hover:bg-guaca-teal/15">
                    {t.planViewOnMap}
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => { setPlan(null); saveJson(PLAN_KEY, null); localStorage.removeItem(PLAN_KEY) }}
            className="mx-auto mt-5 block text-[10px] font-bold text-guaca-ink/38 underline-offset-2 hover:underline"
          >
            {t.planClear}
          </button>
        </>
      )}
    </div>
  )

  const renderProfile = () => (
    <div className="h-full overflow-y-auto bg-guaca-sand-light px-5 pb-28 pt-12">
      <div className="rounded-[32px] bg-white p-6 text-center shadow-sm ring-1 ring-guaca-sand/75">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-guaca-teal text-2xl font-black text-white">
          {(me?.email?.[0] ?? '·').toUpperCase()}
        </span>
        <h2 className="mt-3 truncate text-[15px] font-black text-guaca-ink">{me?.email ?? '…'}</h2>
        {me?.propertyName && (
          <p className="mt-1 text-[11px] font-bold text-guaca-teal">{t.profileGuestOf} {me.propertyName}</p>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-guaca-sand/75">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="flex items-center gap-2.5 text-[13px] font-black text-guaca-ink">
            <Globe className="h-4.5 w-4.5 text-guaca-teal" /> {t.profileLanguage}
          </span>
          <div className="flex overflow-hidden rounded-full bg-guaca-sand/60 p-0.5">
            {(['en', 'es'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => changeLanguage(code)}
                aria-pressed={lang === code}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-black transition-colors ${lang === code ? 'bg-guaca-teal text-white' : 'text-guaca-ink/55'}`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="h-px bg-guaca-sand/60" />
        <button type="button" onClick={() => setActiveTab('updates')} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-guaca-sand/25">
          <span className="flex items-center gap-2.5 text-[13px] font-black text-guaca-ink">
            <Megaphone className="h-4.5 w-4.5 text-guaca-teal" /> {t.profileUpdates}
          </span>
          {updates.length > 0 && <span className="rounded-full bg-guaca-coral/12 px-2 py-0.5 text-[10px] font-black text-guaca-coral-dark">{updates.length}</span>}
        </button>
      </div>

      {/* Yummy-style mode switch — Spotter is the only in-app second role;
          businesses register on the website, never here. */}
      <button
        type="button"
        onClick={() => { window.location.href = '/spotter' }}
        className="mt-4 flex w-full items-center gap-3 rounded-[28px] bg-gradient-to-r from-guaca-coral to-guaca-mango p-4 text-left shadow-lg shadow-guaca-coral/20 transition-transform hover:-translate-y-0.5"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-white">
          <Trophy className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black text-white">{t.profileBecomeSpotter}</span>
          <span className="mt-0.5 block text-[10px] font-bold leading-relaxed text-white/85">{t.profileBecomeSpotterNote}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/80" />
      </button>

      <div className="mt-4 overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-guaca-sand/75">
        <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2.5 px-5 py-4 text-left text-[13px] font-black text-guaca-ink hover:bg-guaca-sand/25">
          <LogOut className="h-4.5 w-4.5 text-guaca-ocean" /> {t.profileSignOut}
        </button>
        <div className="h-px bg-guaca-sand/60" />
        <a href={`${LANDING_URL}/delete-account`} className="flex w-full items-start gap-2.5 px-5 py-4 text-left hover:bg-guaca-sand/25">
          <Trash2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-guaca-coral" />
          <span>
            <span className="block text-[13px] font-black text-guaca-coral-dark">{t.profileDelete}</span>
            <span className="mt-0.5 block text-[10px] font-semibold leading-relaxed text-guaca-ink/45">{t.profileDeleteNote}</span>
          </span>
        </a>
      </div>
    </div>
  )

  const filteredUpdates = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return updates
    return updates.filter((update) =>
      [update.businessName, update.community, update.title, update.details, update.category]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    )
  }, [query, updates])

  const renderUpdates = () => (
    <div className="h-full overflow-y-auto bg-guaca-sand-light px-5 pb-28 pt-14">
      <div className="rounded-[32px] bg-gradient-to-br from-guaca-teal to-guaca-ocean p-6 text-white shadow-xl shadow-guaca-teal/18">
        <GuacaMark className="h-12 w-auto" />
        <h1 className="mt-3 text-3xl font-black tracking-[-.04em]">Local updates</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-white/88">Information published by Caribbean businesses, with local verification when a spotter has checked it.</p>
      </div>

      <div className="relative mt-5">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-guaca-teal" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search businesses, places, or updates" className="h-12 rounded-2xl border-guaca-sand bg-white pl-11 focus-visible:ring-guaca-teal" />
      </div>

      {filteredUpdates.length === 0 ? (
        <div className="mt-4 rounded-[28px] border border-dashed border-guaca-teal/28 bg-white/60 p-6 text-center">
          <Store aria-hidden="true" className="mx-auto h-8 w-8 text-guaca-teal/55" />
          <h3 className="mt-4 text-[13px] font-black text-guaca-ink">{updates.length === 0 ? 'No business updates yet' : 'No updates match your search'}</h3>
          <p className="mx-auto mt-2 max-w-[260px] text-[11px] font-semibold leading-relaxed text-guaca-ink/48">{updates.length === 0 ? 'When a business publishes current information, it will appear here.' : 'Try a different business, community, or topic.'}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredUpdates.map((update) => (
            <article key={update.id} className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-guaca-teal/8 px-2.5 py-1 text-[9px] font-black text-guaca-teal">{update.category}</span>
                <span className={`flex items-center gap-1 text-[9px] font-black ${update.status === 'verified' ? 'text-emerald-700' : 'text-guaca-ink/42'}`}>
                  {update.status === 'verified' ? <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />}
                  {update.status === 'verified' ? `Verified by ${update.verifiedBy}` : 'Business-published'}
                </span>
              </div>
              <p className="mt-3 text-[10px] font-black text-guaca-teal-dark">{update.businessName}{update.community ? ` · ${update.community}` : ''}</p>
              <h3 className="mt-1 text-[14px] font-black leading-snug text-guaca-ink">{update.title}</h3>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-guaca-ink/60">{update.details}</p>
              <p className="mt-3 text-[9px] font-semibold text-guaca-ink/38">{formatUpdateTime(update.createdAt)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )

  const tabScreens: Record<Tab, () => ReturnType<typeof renderMap>> = {
    map: renderMap,
    guaca: renderGuaca,
    plan: renderPlan,
    profile: renderProfile,
    updates: renderUpdates,
  }

  return (
    <div className="relative h-full min-h-screen overflow-hidden bg-guaca-paper sm:min-h-full">
      {tabScreens[activeTab]()}
      <div className="absolute bottom-0 left-0 right-0 z-[500] border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-4 pb-5 pt-2 backdrop-blur-md">
        <div className="flex items-center justify-around">
          {[
            { id: 'map' as const, label: t.tabMap, icon: MapPin },
            { id: 'guaca' as const, label: t.tabGuaca, icon: Sparkles },
            { id: 'plan' as const, label: t.tabPlan, icon: Route },
            { id: 'profile' as const, label: t.tabProfile, icon: UserRound },
          ].map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return <Button key={tab.id} type="button" variant="ghost" onClick={() => setActiveTab(tab.id)} aria-label={tab.label} aria-current={active ? 'page' : undefined} className={`h-14 min-w-16 flex-col gap-1 rounded-2xl px-3 text-[10px] font-bold hover:bg-transparent ${active ? 'text-guaca-teal' : 'text-guaca-ink/42'}`}><Icon className={`h-5 w-5 ${active ? 'fill-guaca-teal/10' : ''}`} />{tab.label}</Button>
          })}
        </div>
      </div>
    </div>
  )
}
