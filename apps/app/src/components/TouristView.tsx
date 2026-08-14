import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Bell, Clock3, MapPin, Megaphone, Search, Store, X } from 'lucide-react'
import { Button, GuacaMap, GuacaMark, Input, formatUpdateTime, useInfoStore, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'

interface TouristViewProps {
  onRoleChange: () => void
}

/** Puerto Cabello — the pilot area; also the geolocation fallback. */
const PILOT_CENTER: [number, number] = [-68.0056, 10.4716]
const BBOX_HALF_DEG = 0.06 // ~6.5 km — the walkable pilot zone

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

export function TouristView({ onRoleChange }: TouristViewProps) {
  const { updates } = useInfoStore()
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist
  const [query, setQuery] = useState('')
  const [askText, setAskText] = useState('')
  const [activeTab, setActiveTab] = useState<'map' | 'updates'>('map')
  const [center, setCenter] = useState<[number, number]>(PILOT_CENTER)
  const [places, setPlaces] = useState<ApiPlace[]>([])
  const [askState, setAskState] = useState<AskState>({ kind: 'idle' })
  const [selected, setSelected] = useState<ApiPlace | null>(null)
  const latestUpdate = updates[0]

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

  const ask = async () => {
    const text = askText.trim()
    if (!text || askState.kind === 'asking') return
    setSelected(null)
    setAskState({ kind: 'asking' })
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text, language: lang, lat: center[1], lon: center[0] }),
      })
      if (!res.ok) return setAskState({ kind: 'error' })
      const body = (await res.json()) as { kind: 'answer' | 'refusal'; text: string; placeIds: string[] }
      setAskState(
        body.kind === 'answer'
          ? { kind: 'answer', text: body.text, placeIds: body.placeIds }
          : { kind: 'refusal', text: body.text },
      )
    } catch {
      setAskState({ kind: 'error' })
    }
  }

  const openPlace = (id: string) => {
    const known = places.find((p) => p.id === id)
    if (known) setSelected(known)
    fetch(`/api/places/${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((full: ApiPlace | null) => {
        if (full) setSelected(full)
      })
      .catch(() => {})
  }

  const answerPlaces =
    askState.kind === 'answer'
      ? askState.placeIds.map((id) => places.find((p) => p.id === id)).filter(Boolean) as ApiPlace[]
      : []

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
          <Button type="button" size="icon" variant="ghost" aria-label="Updates" onClick={() => setActiveTab('updates')} className="relative h-10 w-10 rounded-full bg-white/70 text-guaca-ocean hover:bg-white">
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
      <Button type="button" variant="ghost" onClick={onRoleChange} className="mt-5 h-11 w-full rounded-2xl bg-guaca-teal/8 text-xs font-black text-guaca-teal hover:bg-guaca-teal/12">Switch role</Button>
    </div>
  )

  return (
    <div className="relative h-full min-h-screen overflow-hidden bg-guaca-paper sm:min-h-full">
      {activeTab === 'map' ? renderMap() : renderUpdates()}
      <div className="absolute bottom-0 left-0 right-0 z-[500] border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-12 pb-5 pt-2 backdrop-blur-md">
        <div className="flex items-center justify-around">
          {[
            { id: 'map' as const, label: 'Map', icon: MapPin },
            { id: 'updates' as const, label: 'Updates', icon: Megaphone },
          ].map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return <Button key={tab.id} type="button" variant="ghost" onClick={() => setActiveTab(tab.id)} aria-label={tab.label} aria-current={active ? 'page' : undefined} className={`h-14 min-w-24 flex-col gap-1 rounded-2xl px-4 text-[10px] font-bold hover:bg-transparent ${active ? 'text-guaca-teal' : 'text-guaca-ink/42'}`}><Icon className={`h-5 w-5 ${active ? 'fill-guaca-teal/10' : ''}`} />{tab.label}</Button>
          })}
        </div>
      </div>
    </div>
  )
}
