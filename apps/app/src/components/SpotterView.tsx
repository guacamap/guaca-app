import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Camera, CircleDollarSign, ClipboardCheck, Crosshair, Map as MapIcon, MapPin, Trophy } from 'lucide-react'
import { Button, GuacaLogo, GuacaMap, Input, useLanguage, type Lang } from '@guaca/ui'
import { TAXONOMY } from '@guaca/shared'
import { appCopy } from '../lib/copy'

interface SpotterViewProps {
  onRoleChange: () => void
}

interface Mission {
  id: string
  brief: string
  targetCategory: string
  rewardMinor: number
  currency: string
  status: string
}

interface PendingConfirmation {
  id: string
  name: string
  landmark_description: string
  category: string
  distanceM: number
  lat: number
  lon: number
}

/** A mission target on the map — the gap's h3 cell centre. */
interface Opportunity {
  id: string
  status: string
  category: string
  reward_minor: number
  question_count: number
  lat: number
  lon: number
}

interface Earning {
  missionId: string
  brief: string
  status: string
  rewardMinor: number
  currency: string
  payoutStatus: string | null
}

type Verdict =
  | { decision: 'needs_second_local' | 'needs_operator'; reasons?: string[] }
  | { decision: 'rejected'; reasons: string[] }

const money = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency}`

function categoryLabel(category: string, lang: Lang): string {
  const entry = TAXONOMY.find((t) => t.category === category)
  return entry ? (lang === 'es' ? entry.labelEs : entry.labelEn) : category
}

/** An expired session goes back through the gate — never a fake empty list. */
function guard401(r: Response): Response {
  if (r.status === 401) {
    window.location.reload()
    throw new Error('session expired')
  }
  return r
}

export function SpotterView({ onRoleChange }: SpotterViewProps) {
  const { lang } = useLanguage()
  const t = appCopy[lang].spotter
  const [tab, setTab] = useState<'missions' | 'map' | 'confirm' | 'earnings'>('missions')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [mapCenter, setMapCenter] = useState<[number, number]>([-68.0056, 10.4716])
  const [missions, setMissions] = useState<Mission[]>([])
  const [pending, setPending] = useState<PendingConfirmation[]>([])
  const [earnings, setEarnings] = useState<Earning[]>([])
  const [capture, setCapture] = useState<Mission | null>(null)
  const [banner, setBanner] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [geoNote, setGeoNote] = useState(false)

  const reasonLabel = (code: string) => t.reasons[code] ?? code

  const statusLabel: Record<string, string> = {
    offered: t.statusOffered,
    accepted: t.statusAccepted,
    submitted: t.statusSubmitted,
    verified: t.statusVerified,
    paid: t.statusPaid,
  }

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyIds.has(id)) return
    setBusyIds((prev) => new Set(prev).add(id))
    try {
      await fn()
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const loadMissions = useCallback(() => {
    fetch('/api/spotter/missions', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : { missions: [] }))
      .then((d: { missions: Mission[] }) => setMissions(d.missions ?? []))
      .catch((e) => {
        if (String(e).includes('session')) return
        setBanner({ kind: 'error', text: t.error })
      })
  }, [t.error])

  const loadPending = useCallback(() => {
    const go = (lat: number, lon: number) =>
      fetch(`/api/spotter/confirmations?lat=${lat}&lon=${lon}`, { credentials: 'include' })
        .then(guard401)
        .then((r) => (r.ok ? r.json() : { pending: [] }))
        .then((d: { pending: PendingConfirmation[] }) => setPending(d.pending ?? []))
        .catch((e) => {
          if (String(e).includes('session')) return
          setBanner({ kind: 'error', text: t.error })
        })
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoNote(false)
          void go(pos.coords.latitude, pos.coords.longitude)
        },
        () => {
          setGeoNote(true)
          void go(10.4716, -68.0056)
        },
        { timeout: 3000 },
      )
    } else {
      setGeoNote(true)
      void go(10.4716, -68.0056)
    }
  }, [t.error])

  const loadEarnings = useCallback(() => {
    fetch('/api/spotter/earnings', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d: { rows: Earning[] }) => setEarnings(d.rows ?? []))
      .catch((e) => {
        if (String(e).includes('session')) return
        setBanner({ kind: 'error', text: t.error })
      })
  }, [t.error])

  useEffect(() => {
    loadMissions()
  }, [loadMissions])
  const loadOpportunities = useCallback(() => {
    fetch('/api/spotter/opportunities', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : { opportunities: [] }))
      .then((d: { opportunities: Opportunity[] }) => setOpportunities(d.opportunities ?? []))
      .catch((e) => {
        if (String(e).includes('session')) return
        setBanner({ kind: 'error', text: t.error })
      })
  }, [t.error])

  useEffect(() => {
    setBanner(null)
    if (tab === 'confirm') loadPending()
    if (tab === 'earnings') loadEarnings()
    if (tab === 'map') {
      loadOpportunities()
      loadPending()
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setMapCenter([pos.coords.longitude, pos.coords.latitude]),
          () => {},
          { timeout: 3000, maximumAge: 300_000 },
        )
      }
    }
  }, [tab, loadPending, loadEarnings, loadOpportunities])

  const accept = (missionId: string) =>
    withBusy(missionId, async () => {
      try {
        const res = guard401(
          await fetch(`/api/spotter/missions/${missionId}/accept`, {
            method: 'POST',
            credentials: 'include',
          }),
        )
        if (res.ok) {
          setBanner(null)
          loadMissions()
        } else setBanner({ kind: 'error', text: t.error })
      } catch (e) {
        if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.error })
      }
    })

  const confirmPlace = (placeId: string) =>
    withBusy(placeId, async () => {
      try {
        const res = guard401(
          await fetch(`/api/spotter/places/${placeId}/confirm`, {
            method: 'POST',
            credentials: 'include',
          }),
        )
        if (res.ok) {
          setPending((p) => p.filter((x) => x.id !== placeId))
          setBanner({ kind: 'info', text: t.confirmed })
        } else if (res.status === 409) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          setBanner({
            kind: 'info',
            text: body.error === 'VERIFICATION_PENDING' ? t.confirmPending : t.error,
          })
          loadPending()
        } else setBanner({ kind: 'error', text: t.error })
      } catch (e) {
        if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.error })
      }
    })

  if (capture) {
    return (
      <CaptureFlow
        mission={capture}
        onDone={() => {
          setCapture(null)
          loadMissions()
        }}
      />
    )
  }

  return (
    <div className="relative h-full min-h-screen overflow-hidden bg-guaca-sand-light sm:min-h-full">
      {tab === 'map' && (
        <>
          <div className="absolute inset-0 z-0">
            <GuacaMap
              pins={pending.map((p) => ({
                id: p.id,
                lat: p.lat,
                lng: p.lon,
                emoji: '✓',
                label: p.name,
                spotterColor: '#0D8B8B',
                spotterInitials: '✓',
                verified: false,
              }))}
              gapPins={opportunities.map((o) => ({
                id: o.id,
                lat: o.lat,
                lng: o.lon,
                label: `${categoryLabel(o.category, lang)} · ${money(o.reward_minor, 'USD')}`,
                asks: o.question_count,
                category: o.category,
              }))}
              onPinClick={() => setTab('confirm')}
              onGapClick={() => setTab('missions')}
              showUserLocation
              mapStyle="streets"
              center={mapCenter}
              zoom={13.8}
            />
          </div>
          <div className="absolute inset-x-0 top-0 z-[400] bg-gradient-to-b from-guaca-ocean-deep/60 via-guaca-ocean/15 to-transparent px-5 pb-12 pt-10">
            <p className="text-[13px] font-black text-white drop-shadow">{t.mapLede}</p>
            <div className="mt-2 flex gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-guaca-sand-light/92 px-3 py-1.5 text-[10px] font-black text-guaca-coral-dark shadow-md">
                <span className="h-2 w-2 rounded-full bg-guaca-coral" /> {t.legendMissions} ({opportunities.length})
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-guaca-sand-light/92 px-3 py-1.5 text-[10px] font-black text-guaca-teal shadow-md">
                <span className="h-2 w-2 rounded-full bg-guaca-teal" /> {t.legendConfirm} ({pending.length})
              </span>
            </div>
          </div>
          {opportunities.length === 0 && pending.length === 0 && (
            <div className="absolute bottom-[92px] left-4 right-4 z-[450]">
              <p className="guaca-card rounded-[24px] p-4 text-center text-[11px] font-semibold text-guaca-ink/55">{t.mapEmpty}</p>
            </div>
          )}
        </>
      )}
      {tab !== 'map' && (
      <div className="h-full overflow-y-auto px-5 pb-28 pt-12">
        <div className="rounded-[32px] bg-gradient-to-br from-guaca-coral to-guaca-sunset p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <GuacaLogo variant="reversed" className="h-10" />
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black tracking-[.08em]">SPOTTER</span>
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-[-.03em]">
            {tab === 'missions' ? t.missionsTitle : tab === 'confirm' ? t.confirmTitle : t.earningsTitle}
          </h1>
          {tab === 'confirm' && <p className="mt-2 text-sm font-semibold text-white/85">{t.confirmLede}</p>}
        </div>

        {banner && (
          <p
            role={banner.kind === 'error' ? 'alert' : 'status'}
            className={`mt-4 rounded-2xl px-4 py-3 text-xs font-bold ${
              banner.kind === 'error'
                ? 'bg-guaca-coral/10 text-guaca-coral-dark'
                : 'bg-guaca-teal/10 text-guaca-teal-dark'
            }`}
          >
            {banner.text}
          </p>
        )}
        {tab === 'confirm' && geoNote && (
          <p role="status" className="mt-3 rounded-2xl bg-guaca-mango/15 px-4 py-3 text-xs font-bold text-guaca-mango-dark">
            {t.geoDenied}
          </p>
        )}

        {tab === 'missions' && (
          <div className="mt-5 space-y-3">
            {missions.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-guaca-coral/30 bg-white/70 p-6 text-center">
                <Trophy aria-hidden="true" className="mx-auto h-8 w-8 text-guaca-coral/60" />
                <p className="mx-auto mt-3 max-w-[260px] text-[12px] font-semibold leading-relaxed text-guaca-ink/55">
                  {t.missionsEmpty}
                </p>
              </div>
            )}
            {missions.map((m) => (
              <article key={m.id} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-guaca-coral/10 px-2.5 py-1 text-[9px] font-black text-guaca-coral-dark">
                    {categoryLabel(m.targetCategory, lang)}
                  </span>
                  <span className="text-[10px] font-black text-guaca-ink/50">{statusLabel[m.status] ?? m.status}</span>
                </div>
                <p className="mt-3 text-[13px] font-bold leading-snug text-guaca-ink">{m.brief}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[12px] font-black text-guaca-palm">
                  <CircleDollarSign aria-hidden="true" className="h-4 w-4" /> {t.reward}: {money(m.rewardMinor, m.currency)}
                </p>
                {m.status === 'offered' && (
                  <Button type="button" disabled={busyIds.has(m.id)} onClick={() => accept(m.id)} className="mt-4 h-11 w-full rounded-xl bg-guaca-coral text-xs font-black text-white hover:bg-guaca-coral-dark disabled:opacity-60">
                    <ClipboardCheck aria-hidden="true" className="mr-1.5 h-4 w-4" /> {t.acceptCta}
                  </Button>
                )}
                {m.status === 'accepted' && (
                  <Button type="button" onClick={() => setCapture(m)} className="mt-4 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark">
                    <Camera aria-hidden="true" className="mr-1.5 h-4 w-4" /> {t.startCta}
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}

        {tab === 'confirm' && (
          <div className="mt-5 space-y-3">
            {pending.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-guaca-teal/30 bg-white/70 p-6 text-center">
                <MapPin aria-hidden="true" className="mx-auto h-8 w-8 text-guaca-teal/60" />
                <p className="mx-auto mt-3 max-w-[260px] text-[12px] font-semibold leading-relaxed text-guaca-ink/55">
                  {t.confirmEmpty}
                </p>
              </div>
            )}
            {pending.map((p) => (
              <article key={p.id} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                <h3 className="text-[15px] font-black text-guaca-ink">{p.name}</h3>
                <p className="mt-1 text-[12px] font-bold leading-snug text-guaca-ink/65">{p.landmark_description}</p>
                <p className="mt-2 text-[10px] font-black text-guaca-ink/40">{Math.round(p.distanceM)} m</p>
                <Button type="button" disabled={busyIds.has(p.id)} onClick={() => confirmPlace(p.id)} className="mt-3 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark disabled:opacity-60">
                  <BadgeCheck aria-hidden="true" className="mr-1.5 h-4 w-4" /> {t.confirmCta}
                </Button>
              </article>
            ))}
          </div>
        )}

        {tab === 'earnings' && (
          <div className="mt-5 space-y-3">
            {earnings.length === 0 && (
              <p className="rounded-[28px] border border-dashed border-guaca-sand bg-white/70 p-6 text-center text-[12px] font-semibold text-guaca-ink/55">
                {t.earningsEmpty}
              </p>
            )}
            {earnings.map((e) => (
              <article key={e.missionId} className="flex items-center justify-between rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-guaca-ink">{e.brief}</p>
                  <p className="mt-1 text-[10px] font-black text-guaca-ink/45">
                    {statusLabel[e.status] ?? e.status}
                    {e.payoutStatus ? ` · ${e.payoutStatus}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-black text-guaca-palm">{money(e.rewardMinor, e.currency)}</span>
              </article>
            ))}
            <Button type="button" variant="ghost" onClick={onRoleChange} className="h-11 w-full rounded-2xl bg-guaca-teal/8 text-xs font-black text-guaca-teal hover:bg-guaca-teal/12">
              {t.backCta}
            </Button>
          </div>
        )}
      </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-[500] border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-6 pb-5 pt-2 backdrop-blur-md">
        <div className="flex items-center justify-around">
          {(
            [
              { id: 'missions', label: t.tabMissions, icon: Trophy },
              { id: 'map', label: t.tabMap, icon: MapIcon },
              { id: 'confirm', label: t.tabConfirm, icon: BadgeCheck },
              { id: 'earnings', label: t.tabEarnings, icon: CircleDollarSign },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <Button key={id} type="button" variant="ghost" onClick={() => setTab(id)} aria-current={active ? 'page' : undefined} className={`h-14 min-w-20 flex-col gap-1 rounded-2xl px-3 text-[10px] font-bold hover:bg-transparent ${active ? 'text-guaca-coral-dark' : 'text-guaca-ink/42'}`}>
                <Icon aria-hidden="true" className="h-5 w-5" />
                {label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CaptureFlow({ mission, onDone }: { mission: Mission; onDone: () => void }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].spotter
  const [name, setName] = useState('')
  const [landmark, setLandmark] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lon: number; accuracy: number } | null>(null)
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Verdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Resumable submission state: a retry after a mid-flow failure continues
  // from where it stopped instead of re-creating the place or re-uploading
  // photos (duplicate phashes would hard-fail the diversity rung).
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<boolean[]>([false, false, false])

  const reasonLabel = (code: string) => t.reasons[code] ?? code

  const locate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => setError(t.locationMissing),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!coords) return setError(t.locationMissing)
    setBusy(true)
    setError(null)
    try {
      let pid = placeId
      if (!pid) {
        const placeRes = guard401(
          await fetch('/api/spotter/places', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name,
              category: mission.targetCategory,
              landmarkDescription: landmark,
              lat: coords.lat,
              lon: coords.lon,
              missionId: mission.id,
            }),
          }),
        )
        if (!placeRes.ok) throw new Error('submit')
        pid = ((await placeRes.json()) as { placeId: string }).placeId
        setPlaceId(pid)
      }
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i]
        if (!file || uploaded[i]) continue
        const imageBase64 = await fileToBase64(file)
        const photoRes = guard401(
          await fetch('/api/photos', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              placeId: pid,
              imageBase64,
              captureLat: coords.lat,
              captureLon: coords.lon,
              captureAccuracyM: coords.accuracy,
              capturedAt: new Date().toISOString(),
            }),
          }),
        )
        if (!photoRes.ok) throw new Error('photo')
        setUploaded((prev) => prev.map((u, j) => (j === i ? true : u)))
      }
      const completeRes = guard401(
        await fetch(`/api/spotter/submissions/${pid}/complete`, {
          method: 'POST',
          credentials: 'include',
        }),
      )
      if (!completeRes.ok) throw new Error('complete')
      setResult((await completeRes.json()) as Verdict)
    } catch (err) {
      if (!String(err).includes('session')) setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const rejected = result.decision === 'rejected'
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-5 bg-guaca-sand-light p-7 text-center">
        <GuacaLogo className="h-12" />
        {!rejected ? (
          <>
            <BadgeCheck aria-hidden="true" className="h-12 w-12 text-guaca-teal" />
            <p className="max-w-[300px] text-[14px] font-bold leading-relaxed text-guaca-ink">
              {result.decision === 'needs_second_local' ? t.resultSecondLocal : t.resultOperator}
            </p>
          </>
        ) : (
          <>
            <p className="text-[14px] font-black text-guaca-coral-dark">{t.resultRejected}</p>
            <ul className="text-[12px] font-bold text-guaca-ink/60">
              {result.reasons.map((r) => (
                <li key={r}>{reasonLabel(r)}</li>
              ))}
            </ul>
          </>
        )}
        <Button type="button" onClick={onDone} className="h-11 rounded-xl bg-guaca-teal px-8 text-xs font-black text-white hover:bg-guaca-teal-dark">
          {rejected ? t.retryCta : t.backCta}
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full min-h-screen overflow-y-auto bg-guaca-sand-light px-5 pb-16 pt-12 sm:min-h-full">
      <div className="rounded-[32px] bg-gradient-to-br from-guaca-teal to-guaca-ocean p-6 text-white shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[.1em] text-white/70">{categoryLabel(mission.targetCategory, lang)}</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-.03em]">{t.captureTitle}</h1>
        <p className="mt-2 text-sm font-semibold text-white/85">{mission.brief}</p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-black text-guaca-ink/70" htmlFor="cap-name">{t.nameLabel}</label>
          <Input id="cap-name" required value={name} disabled={placeId !== null} onChange={(e) => setName(e.target.value)} className="mt-1 bg-white" />
        </div>
        <div>
          <label className="text-xs font-black text-guaca-ink/70" htmlFor="cap-landmark">{t.landmarkLabel}</label>
          <Input id="cap-landmark" required value={landmark} disabled={placeId !== null} onChange={(e) => setLandmark(e.target.value)} className="mt-1 bg-white" />
          <p className="mt-1 text-[10px] font-semibold text-guaca-ink/45">{t.landmarkHint}</p>
        </div>

        <button
          type="button"
          onClick={locate}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-xs font-black ${
            coords
              ? 'border-guaca-palm/40 bg-guaca-palm/10 text-guaca-palm-dark'
              : 'border-guaca-teal/35 bg-white text-guaca-teal'
          }`}
        >
          <Crosshair aria-hidden="true" className="h-4 w-4" />
          {coords ? `${t.locationOk} (±${Math.round(coords.accuracy)}m)` : t.locationCta}
        </button>

        <div>
          <p className="text-xs font-black text-guaca-ink/70">{t.photosLabel}</p>
          <p className="text-[10px] font-semibold text-guaca-ink/45">{t.photosHint}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((file, i) => (
              <label key={i} className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border text-[10px] font-black ${file ? 'border-guaca-palm/40 bg-guaca-palm/10 text-guaca-palm-dark' : 'border-dashed border-guaca-ink/25 bg-white text-guaca-ink/45'}`}>
                <Camera aria-hidden="true" className="h-5 w-5" />
                {file ? '✓' : i + 1}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-label={`${t.photosLabel} — ${i + 1}/3`}
                  disabled={uploaded[i]}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setPhotos((prev) => prev.map((p, j) => (j === i ? f : p)))
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-guaca-coral/10 px-3 py-2 text-xs font-bold text-guaca-coral-dark">{error}</p>
        )}

        <Button type="submit" disabled={busy || photos.some((p) => p === null)} className="h-13 w-full rounded-xl bg-guaca-coral text-sm font-black text-white hover:bg-guaca-coral-dark disabled:opacity-50">
          {busy ? t.submitting : error ? t.retryCta : t.submitCta}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} className="h-10 w-full text-xs font-black text-guaca-ink/50">
          {t.backCta}
        </Button>
      </form>
    </div>
  )
}
