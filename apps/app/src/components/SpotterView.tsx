import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Camera, CircleDollarSign, ClipboardCheck, Crosshair, MapPin, Trophy } from 'lucide-react'
import { Button, GuacaLogo, Input, useLanguage } from '@guaca/ui'
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
  | { decision: 'needs_second_local' | 'needs_operator' }
  | { decision: 'rejected'; reasons: string[] }

const money = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency}`

export function SpotterView({ onRoleChange }: SpotterViewProps) {
  const { lang } = useLanguage()
  const t = appCopy[lang].spotter
  const [tab, setTab] = useState<'missions' | 'confirm' | 'earnings'>('missions')
  const [missions, setMissions] = useState<Mission[]>([])
  const [pending, setPending] = useState<PendingConfirmation[]>([])
  const [earnings, setEarnings] = useState<Earning[]>([])
  const [capture, setCapture] = useState<Mission | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusLabel: Record<string, string> = {
    offered: t.statusOffered,
    accepted: t.statusAccepted,
    submitted: t.statusSubmitted,
    verified: t.statusVerified,
    paid: t.statusPaid,
  }

  const loadMissions = useCallback(() => {
    fetch('/api/spotter/missions', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { missions: [] }))
      .then((d: { missions: Mission[] }) => setMissions(d.missions ?? []))
      .catch(() => setError(t.error))
  }, [t.error])

  const loadPending = useCallback(() => {
    const go = (lat: number, lon: number) =>
      fetch(`/api/spotter/confirmations?lat=${lat}&lon=${lon}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { pending: [] }))
        .then((d: { pending: PendingConfirmation[] }) => setPending(d.pending ?? []))
        .catch(() => setError(t.error))
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => go(pos.coords.latitude, pos.coords.longitude),
        () => go(10.4716, -68.0056),
        { timeout: 3000 },
      )
    } else void go(10.4716, -68.0056)
  }, [t.error])

  const loadEarnings = useCallback(() => {
    fetch('/api/spotter/earnings', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d: { rows: Earning[] }) => setEarnings(d.rows ?? []))
      .catch(() => setError(t.error))
  }, [t.error])

  useEffect(() => {
    loadMissions()
  }, [loadMissions])
  useEffect(() => {
    if (tab === 'confirm') loadPending()
    if (tab === 'earnings') loadEarnings()
  }, [tab, loadPending, loadEarnings])

  const accept = async (missionId: string) => {
    const res = await fetch(`/api/spotter/missions/${missionId}/accept`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) loadMissions()
    else setError(t.error)
  }

  const confirmPlace = async (placeId: string) => {
    const res = await fetch(`/api/spotter/places/${placeId}/confirm`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      setPending((p) => p.filter((x) => x.id !== placeId))
    } else setError(t.error)
  }

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

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-guaca-coral/10 px-4 py-3 text-xs font-bold text-guaca-coral-dark">
            {error}
          </p>
        )}

        {tab === 'missions' && (
          <div className="mt-5 space-y-3">
            {missions.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-guaca-coral/30 bg-white/70 p-6 text-center">
                <Trophy className="mx-auto h-8 w-8 text-guaca-coral/60" />
                <p className="mx-auto mt-3 max-w-[260px] text-[12px] font-semibold leading-relaxed text-guaca-ink/55">
                  {t.missionsEmpty}
                </p>
              </div>
            )}
            {missions.map((m) => (
              <article key={m.id} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-guaca-coral/10 px-2.5 py-1 text-[9px] font-black text-guaca-coral-dark">
                    {m.targetCategory}
                  </span>
                  <span className="text-[10px] font-black text-guaca-ink/50">{statusLabel[m.status] ?? m.status}</span>
                </div>
                <p className="mt-3 text-[13px] font-bold leading-snug text-guaca-ink">{m.brief}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[12px] font-black text-guaca-palm">
                  <CircleDollarSign className="h-4 w-4" /> {t.reward}: {money(m.rewardMinor, m.currency)}
                </p>
                {m.status === 'offered' && (
                  <Button type="button" onClick={() => accept(m.id)} className="mt-4 h-11 w-full rounded-xl bg-guaca-coral text-xs font-black text-white hover:bg-guaca-coral-dark">
                    <ClipboardCheck className="mr-1.5 h-4 w-4" /> {t.acceptCta}
                  </Button>
                )}
                {m.status === 'accepted' && (
                  <Button type="button" onClick={() => setCapture(m)} className="mt-4 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark">
                    <Camera className="mr-1.5 h-4 w-4" /> {t.startCta}
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
                <MapPin className="mx-auto h-8 w-8 text-guaca-teal/60" />
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
                <Button type="button" onClick={() => confirmPlace(p.id)} className="mt-3 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark">
                  <BadgeCheck className="mr-1.5 h-4 w-4" /> {t.confirmCta}
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

      <div className="absolute bottom-0 left-0 right-0 z-[500] border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-6 pb-5 pt-2 backdrop-blur-md">
        <div className="flex items-center justify-around">
          {(
            [
              { id: 'missions', label: t.tabMissions, icon: Trophy },
              { id: 'confirm', label: t.tabConfirm, icon: BadgeCheck },
              { id: 'earnings', label: t.tabEarnings, icon: CircleDollarSign },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <Button key={id} type="button" variant="ghost" onClick={() => setTab(id)} aria-current={active ? 'page' : undefined} className={`h-14 min-w-20 flex-col gap-1 rounded-2xl px-3 text-[10px] font-bold hover:bg-transparent ${active ? 'text-guaca-coral-dark' : 'text-guaca-ink/42'}`}>
                <Icon className="h-5 w-5" />
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
    const files = photos.filter((p): p is File => p !== null)
    setBusy(true)
    setError(null)
    try {
      const placeRes = await fetch('/api/spotter/places', {
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
      })
      if (!placeRes.ok) throw new Error('submit')
      const { placeId } = (await placeRes.json()) as { placeId: string }
      for (const file of files) {
        const imageBase64 = await fileToBase64(file)
        const photoRes = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            placeId,
            imageBase64,
            captureLat: coords.lat,
            captureLon: coords.lon,
            captureAccuracyM: coords.accuracy,
            capturedAt: new Date().toISOString(),
          }),
        })
        if (!photoRes.ok) throw new Error('photo')
      }
      const completeRes = await fetch(`/api/spotter/submissions/${placeId}/complete`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!completeRes.ok) throw new Error('complete')
      setResult((await completeRes.json()) as Verdict)
    } catch {
      setError(t.error)
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
            <BadgeCheck className="h-12 w-12 text-guaca-teal" />
            <p className="max-w-[300px] text-[14px] font-bold leading-relaxed text-guaca-ink">
              {result.decision === 'needs_second_local' ? t.resultSecondLocal : t.resultOperator}
            </p>
          </>
        ) : (
          <>
            <p className="text-[14px] font-black text-guaca-coral-dark">{t.resultRejected}</p>
            <ul className="text-[12px] font-bold text-guaca-ink/60">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
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
        <p className="text-[10px] font-black uppercase tracking-[.1em] text-white/70">{mission.targetCategory}</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-.03em]">{t.captureTitle}</h1>
        <p className="mt-2 text-sm font-semibold text-white/85">{mission.brief}</p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-black text-guaca-ink/70" htmlFor="cap-name">{t.nameLabel}</label>
          <Input id="cap-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-white" />
        </div>
        <div>
          <label className="text-xs font-black text-guaca-ink/70" htmlFor="cap-landmark">{t.landmarkLabel}</label>
          <Input id="cap-landmark" required value={landmark} onChange={(e) => setLandmark(e.target.value)} className="mt-1 bg-white" />
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
          <Crosshair className="h-4 w-4" />
          {coords ? `${t.locationOk} (±${Math.round(coords.accuracy)}m)` : t.locationCta}
        </button>

        <div>
          <p className="text-xs font-black text-guaca-ink/70">{t.photosLabel}</p>
          <p className="text-[10px] font-semibold text-guaca-ink/45">{t.photosHint}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((file, i) => (
              <label key={i} className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border text-[10px] font-black ${file ? 'border-guaca-palm/40 bg-guaca-palm/10 text-guaca-palm-dark' : 'border-dashed border-guaca-ink/25 bg-white text-guaca-ink/45'}`}>
                <Camera className="h-5 w-5" />
                {file ? '✓' : i + 1}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
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
          {busy ? t.submitting : t.submitCta}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} className="h-10 w-full text-xs font-black text-guaca-ink/50">
          {t.backCta}
        </Button>
      </form>
    </div>
  )
}
