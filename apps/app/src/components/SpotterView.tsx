import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, BadgeCheck, Camera, CircleDollarSign, ClipboardCheck, Compass, Crosshair, Map as MapIcon, MapPin, Trophy, X } from 'lucide-react'
import { Avatar, Button, GuacaLogo, GuacaMap, Input, useLanguage, type Lang } from '@guaca/ui'
import { TAXONOMY } from '@guaca/shared'
import { appCopy } from '../lib/copy'
import { photoToBase64 } from '../lib/image'
import { InstallApp } from './InstallApp'

// ~6.5 km — the walkable pilot zone; matches the tourist map's candidate query.
const CANDIDATE_BBOX_HALF_DEG = 0.06

interface Mission {
  id: string
  brief: string
  targetCategory: string
  rewardMinor: number
  currency: string
  status: string
}

interface CandidatePlace {
  id: string
  name: string
  category: string
  lat: number
  lon: number
  public_phone?: string | null
  public_website?: string | null
  public_socials?: string[] | null
  public_address?: string | null
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

interface SpotterMe {
  id: string
  name: string
  language?: string
  photoUrl: string | null
  level: number
  totalPoints: number
}

interface RankRow {
  id: string
  name: string
  photo_url: string | null
  level: number
  points: number
  missions: number
  rank: number
}

const MEDALS = ['🥇', '🥈', '🥉']

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://guaca.live'
const OPERATOR_WHATSAPP = process.env.NEXT_PUBLIC_OPERATOR_WHATSAPP ?? ''

/** Points needed to reach each level — the guide ladder (§ product brief). */
const LEVEL_THRESHOLDS = [0, 500, 1500, 3000]

function levelProgress(points: number, level: number) {
  const next = LEVEL_THRESHOLDS[level] // level is 1-based, so this is the next rung
  if (next === undefined) return null
  const floor = LEVEL_THRESHOLDS[level - 1] ?? 0
  const span = Math.max(next - floor, 1)
  return {
    next,
    nextLevel: level + 1,
    remaining: Math.max(next - points, 0),
    percent: Math.min(Math.round(((points - floor) / span) * 100), 100),
  }
}

interface SpotterStats {
  verified: number
  rejected: number
  awaiting: number
  confirmedForOthers: number
  firstPassRate: number | null
}

interface MyPlace {
  id: string
  name: string
  category: string
  verified_at: string | null
  lat: number
  lon: number
}

/** Dummy points store — catalog only, no real redemption yet. */
const STORE_ITEMS = [
  { id: 'airtime5', emoji: '📱', en: 'Phone airtime $5', es: 'Saldo telefónico $5', cost: 2000 },
  { id: 'cap', emoji: '🧢', en: 'Guaca cap', es: 'Gorra Guaca', cost: 2500 },
  { id: 'tee', emoji: '👕', en: 'Guaca t-shirt', es: 'Franela Guaca', cost: 4000 },
  { id: 'spotify', emoji: '🎧', en: 'Spotify · 1 month', es: 'Spotify · 1 mes', cost: 5000 },
  { id: 'amazon10', emoji: '🛒', en: 'Amazon card $10', es: 'Tarjeta Amazon $10', cost: 6000 },
  { id: 'netflix', emoji: '🎬', en: 'Netflix · 1 month', es: 'Netflix · 1 mes', cost: 7000 },
]

type Verdict =
  | { decision: 'needs_second_local' | 'needs_operator'; reasons?: string[] }
  | { decision: 'rejected'; reasons: string[] }

/** Spotters earn POINTS, not money — mission reward values are points. */
const pts = (points: number) => `${points} pts`

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

export function SpotterView() {
  const { lang, setLang } = useLanguage()
  const t = appCopy[lang].spotter
  const [tab, setTab] = useState<'missions' | 'map' | 'confirm' | 'earnings'>('missions')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [mapCenter, setMapCenter] = useState<[number, number]>([-68.0056, 10.4716])
  const [candidates, setCandidates] = useState<CandidatePlace[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<CandidatePlace | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [pending, setPending] = useState<PendingConfirmation[]>([])
  const [earnings, setEarnings] = useState<Earning[]>([])
  // 'free' = a place the spotter found themselves, with no mission behind it.
  const [capture, setCapture] = useState<Mission | 'free' | 'candidate' | null>(null)
  const [banner, setBanner] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [geoNote, setGeoNote] = useState(false)
  const [me, setMe] = useState<SpotterMe | null>(null)
  const [ranking, setRanking] = useState<RankRow[]>([])
  const [myRank, setMyRank] = useState<{ rank: number; points: number } | null>(null)
  const [stats, setStats] = useState<SpotterStats | null>(null)
  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)
  // The confirming spotter's real position — the server now requires it,
  // because "a second local on the ground" has to mean on the ground.
  const [fix, setFix] = useState<[number, number] | null>(null)

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
      // A 5xx used to render as "no missions yet" — a spotter paid per
      // mission would conclude there is no work.
      .then((r) => {
        if (!r.ok) throw new Error('missions failed')
        return r.json()
      })
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
        .then((r) => {
          if (!r.ok) throw new Error('confirmations failed')
          return r.json()
        })
        .then((d: { pending: PendingConfirmation[] }) => setPending(d.pending ?? []))
        .catch((e) => {
          if (String(e).includes('session')) return
          setBanner({ kind: 'error', text: t.error })
        })
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoNote(false)
          setFix([pos.coords.latitude, pos.coords.longitude])
          void go(pos.coords.latitude, pos.coords.longitude)
        },
        () => {
          setGeoNote(true)
          setFix(null)
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
      .then((r) => {
        if (!r.ok) throw new Error('earnings failed')
        return r.json()
      })
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

  const loadProfile = useCallback(() => {
    fetch('/api/spotter/me', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SpotterMe | null) => {
        if (d) {
          setMe(d)
          // Spotters are Spanish-first and the roster stores their language;
          // the UI used to ignore it, so briefs came back in Spanish inside
          // an English shell with no way to switch.
          if ((d.language === 'es' || d.language === 'en') && d.language !== lang) {
            setLang(d.language)
          }
        }
      })
      .catch(() => {})
    fetch('/api/spotter/ranking', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ranking: RankRow[]; me: { rank: number; points: number } | null } | null) => {
        if (d) {
          setRanking(d.ranking)
          setMyRank(d.me)
        }
      })
      .catch(() => {})
    fetch('/api/spotter/stats', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SpotterStats | null) => {
        if (d) setStats(d)
      })
      .catch(() => {})
    fetch('/api/spotter/places', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { places: MyPlace[] } | null) => {
        if (d) setMyPlaces(d.places)
      })
      .catch(() => {})
  }, [lang, setLang])

  /** Their face rides every pin they verify — let them set it here. */
  const uploadPhoto = async (file: File) => {
    setPhotoBusy(true)
    try {
      const base64 = await photoToBase64(file)
      const res = await fetch('/api/spotter/me/photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageBase64: base64 }),
      })
      if (res.ok) {
        const body = (await res.json()) as { photoUrl: string }
        setMe((prev) => (prev ? { ...prev, photoUrl: body.photoUrl } : prev))
      } else setBanner({ kind: 'error', text: t.error })
    } catch {
      setBanner({ kind: 'error', text: t.error })
    } finally {
      setPhotoBusy(false)
    }
  }

  useEffect(() => {
    setBanner(null)
    if (tab === 'missions') loadMissions()
    if (tab === 'confirm') loadPending()
    if (tab === 'earnings') {
      loadEarnings()
      loadProfile()
    }
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
  }, [tab, loadMissions, loadPending, loadEarnings, loadOpportunities, loadProfile])

  // The open-data backdrop, same as the tourist map: candidates as dots,
  // never pins.
  const loadCandidates = useCallback(() => {
    const [lon, lat] = mapCenter
    const bbox = [lon - CANDIDATE_BBOX_HALF_DEG, lat - CANDIDATE_BBOX_HALF_DEG, lon + CANDIDATE_BBOX_HALF_DEG, lat + CANDIDATE_BBOX_HALF_DEG].join(',')
    fetch(`/api/places/candidates?bbox=${bbox}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { candidates: [] }))
      .then((d: { candidates: CandidatePlace[] }) => setCandidates(d.candidates ?? []))
      .catch(() => {})
  }, [mapCenter])
  // Reruns whenever the visible centre moves — including the moment
  // geolocation resolves above — so a spotter always sees what is nearby,
  // not just what was near the pilot's default point.
  useEffect(() => {
    if (tab === 'map') loadCandidates()
  }, [tab, loadCandidates])

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
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(fix ? { lat: fix[0], lon: fix[1] } : {}),
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
        } else if (res.status === 400 || res.status === 422) {
          setBanner({ kind: 'error', text: t.confirmTooFar })
        } else setBanner({ kind: 'error', text: t.error })
      } catch (e) {
        if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.error })
      }
    })

  if (capture) {
    return (
      <CaptureFlow
        mission={capture === 'free' || capture === 'candidate' ? null : capture}
        candidate={capture === 'candidate' ? selectedCandidate : null}
        onDone={() => {
          setCapture(null)
          setSelectedCandidate(null)
          loadMissions()
          loadCandidates()
        }}
      />
    )
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-guaca-sand-light lg:flex-row">
      <div className="relative min-h-0 flex-1 lg:order-2">
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
                label: `${categoryLabel(o.category, lang)} · ${pts(o.reward_minor)}`,
                asks: o.question_count,
                category: o.category,
              }))}
              dots={candidates.map((c) => ({
                id: c.id,
                lat: c.lat,
                lng: c.lon,
                label: c.name,
                category: c.category,
              }))}
              onPinClick={() => setTab('confirm')}
              onGapClick={(id) => {
                const m = missions.find((x) => x.id === id)
                if (m) setCapture(m)
                else setTab('missions')
              }}
              onDotClick={(id) => {
                const c = candidates.find((x) => x.id === id)
                if (c) setSelectedCandidate(c)
              }}
              showUserLocation
              mapStyle="streets"
              center={mapCenter}
              zoom={13.8}
            />
          </div>
          <div className="absolute inset-x-0 top-0 z-[400] bg-gradient-to-b from-guaca-ocean-deep/60 via-guaca-ocean/15 to-transparent px-5 pb-12 pt-10 lg:inset-x-auto lg:left-0 lg:w-[560px] lg:rounded-br-[28px]">
            <p className="text-[13px] font-black text-white drop-shadow">{t.mapLede}</p>
            <div className="mt-2 flex gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-guaca-sand-light/92 px-3 py-1.5 text-[10px] font-black text-guaca-coral-dark shadow-md">
                <span className="h-2 w-2 rounded-full bg-guaca-coral" /> {t.legendMissions} ({opportunities.length})
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-guaca-sand-light/92 px-3 py-1.5 text-[10px] font-black text-guaca-teal shadow-md">
                <span className="h-2 w-2 rounded-full bg-guaca-teal" /> {t.legendConfirm} ({pending.length})
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-guaca-sand-light/92 px-3 py-1.5 text-[10px] font-black text-guaca-ink/70 shadow-md">
                <span className="h-2 w-2 rounded-full bg-guaca-ink/45" /> {t.candidatesLegend} ({candidates.length})
              </span>
            </div>
          </div>
          <div className="absolute inset-x-4 bottom-4 z-[600] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[440px]">
            <Button
              type="button"
              onClick={() => setCapture('free')}
              className="h-12 w-full rounded-2xl bg-guaca-coral text-[13px] font-black text-white shadow-xl shadow-guaca-coral/30 hover:bg-guaca-coral-dark"
            >
              <Camera className="mr-2 h-4 w-4" /> {t.freeCta}
            </Button>
          </div>

          {opportunities.length === 0 && pending.length === 0 && (
            <div className="absolute bottom-[76px] left-4 right-4 z-[450] lg:bottom-[120px] lg:left-auto lg:right-6 lg:w-[440px]">
              <p className="guaca-card rounded-[24px] p-4 text-center text-[11px] font-semibold text-guaca-ink/55">{t.mapEmpty}</p>
            </div>
          )}

          {/* A candidate dot — known to open data, unknown to us. Tapping it
              starts the same submission a "free" find would, just pre-filled
              with whatever a public listing already says. */}
          {selectedCandidate && (
            <div className="absolute inset-x-4 bottom-4 z-[700] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[440px]">
              <div className="guaca-card rounded-[30px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-guaca-ink/6 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] text-guaca-ink/55">
                      <MapIcon className="h-3 w-3" /> {t.candidateTitle}
                    </p>
                    <h3 className="mt-2 truncate text-lg font-black leading-tight text-guaca-ink">{selectedCandidate.name}</h3>
                    <p className="text-[11px] font-bold text-guaca-ink/50">{categoryLabel(selectedCandidate.category, lang)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={t.close}
                    onClick={() => setSelectedCandidate(null)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-guaca-ink/6 text-guaca-ink/60 hover:bg-guaca-ink/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-relaxed text-guaca-ink/60">{t.candidateBody}</p>
                {(selectedCandidate.public_phone || selectedCandidate.public_website || selectedCandidate.public_address || selectedCandidate.public_socials?.length) && (
                  <div className="mt-3 rounded-2xl bg-guaca-ink/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-[.1em] text-guaca-ink/45">{t.candidatePublic}</p>
                    {selectedCandidate.public_address && <p className="mt-1 text-[11px] font-semibold text-guaca-ink/65">{selectedCandidate.public_address}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10.5px] font-bold text-guaca-ink/55">
                      {selectedCandidate.public_phone && <span>📞 {selectedCandidate.public_phone}</span>}
                      {selectedCandidate.public_website && <span className="truncate">🌐 {selectedCandidate.public_website.replace(/^https?:\/\//, '')}</span>}
                    </div>
                  </div>
                )}
                <Button
                  type="button"
                  onClick={() => setCapture('candidate')}
                  className="mt-3 h-11 w-full rounded-xl bg-guaca-coral text-[12px] font-black text-white hover:bg-guaca-coral-dark"
                >
                  <BadgeCheck className="mr-1.5 h-4 w-4" /> {t.candidateCta}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {tab !== 'map' && (
      <div className="h-full overflow-y-auto px-5 pb-8 pt-12">
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
                  <CircleDollarSign aria-hidden="true" className="h-4 w-4" /> {t.reward}: {pts(m.rewardMinor)}
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
          <div className="mt-5 space-y-4">
            {/* Identity + points */}
            <div className="rounded-[28px] bg-white p-5 text-center shadow-sm ring-1 ring-guaca-sand/75">
              <div className="flex justify-center">
                <Avatar url={me?.photoUrl} name={me?.name} className="h-16 w-16" fallbackClassName="bg-guaca-coral text-white" textClassName="text-2xl" />
              </div>
              <label className="mx-auto mt-2 block w-max cursor-pointer text-[10px] font-black text-guaca-teal underline-offset-2 hover:underline">
                {photoBusy ? t.photoBusy : t.photoCta}
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadPhoto(file)
                  }}
                />
              </label>
              <div className="mx-auto mt-3 flex w-max overflow-hidden rounded-full bg-guaca-sand/60 p-0.5">
                {(['en', 'es'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    aria-pressed={lang === code}
                    className={`rounded-full px-3.5 py-1.5 text-[11px] font-black transition-colors ${lang === code ? 'bg-guaca-coral text-white' : 'text-guaca-ink/55'}`}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
              <h2 className="mt-2 text-[15px] font-black text-guaca-ink">{me?.name ?? '…'}</h2>
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-[.1em] text-guaca-coral-dark">Spotter · Lv{me?.level ?? 1}</p>
              {/* Level ladder — what the level means and how to climb. */}
              {(() => {
                const prog = levelProgress(me?.totalPoints ?? 0, me?.level ?? 1)
                if (!prog) return <p className="mt-2 text-[10px] font-black text-guaca-mango-dark">{t.levelMax}</p>
                return (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-guaca-sand">
                      <div className="h-full rounded-full bg-gradient-to-r from-guaca-coral to-guaca-mango" style={{ width: `${prog.percent}%` }} />
                    </div>
                    <p className="mt-1.5 text-[10px] font-bold text-guaca-ink/50">
                      {prog.remaining} {t.pointsSuffix} {t.levelProgress} {prog.nextLevel}
                    </p>
                  </div>
                )
              })()}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-guaca-coral/8 px-2 py-3">
                  <p className="text-lg font-black text-guaca-coral-dark">{me?.totalPoints ?? 0}</p>
                  <p className="text-[9px] font-black text-guaca-ink/45">{t.pointsSuffix}</p>
                </div>
                <div className="rounded-2xl bg-guaca-mango/12 px-2 py-3">
                  <p className="text-lg font-black text-guaca-mango-dark">{myRank?.points ?? 0}</p>
                  <p className="text-[9px] font-black text-guaca-ink/45">{t.monthPoints}</p>
                </div>
                <div className="rounded-2xl bg-guaca-teal/8 px-2 py-3">
                  <p className="text-lg font-black text-guaca-teal">{myRank ? `#${myRank.rank}` : '—'}</p>
                  <p className="text-[9px] font-black text-guaca-ink/45">{t.rankLabel}</p>
                </div>
              </div>
            </div>

            <InstallApp />

            {/* Quality record — being right beats being fast. */}
            <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
              <p className="flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">
                <ClipboardCheck className="h-3.5 w-3.5 text-guaca-teal" /> {t.qualityTitle}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                <div>
                  <p className="text-[15px] font-black text-guaca-palm">{stats?.verified ?? 0}</p>
                  <p className="text-[8px] font-bold leading-tight text-guaca-ink/45">{t.qualityVerified}</p>
                </div>
                <div>
                  <p className="text-[15px] font-black text-guaca-coral-dark">{stats?.rejected ?? 0}</p>
                  <p className="text-[8px] font-bold leading-tight text-guaca-ink/45">{t.qualityRejected}</p>
                </div>
                <div>
                  <p className="text-[15px] font-black text-guaca-mango-dark">{stats?.awaiting ?? 0}</p>
                  <p className="text-[8px] font-bold leading-tight text-guaca-ink/45">{t.qualityAwaiting}</p>
                </div>
                <div>
                  <p className="text-[15px] font-black text-guaca-teal">{stats?.confirmedForOthers ?? 0}</p>
                  <p className="text-[8px] font-bold leading-tight text-guaca-ink/45">{t.qualityConfirmed}</p>
                </div>
              </div>
              {stats?.firstPassRate != null && (
                <p className="mt-3 rounded-2xl bg-guaca-palm/10 px-3 py-2 text-center text-[11px] font-black text-guaca-palm">
                  {stats.firstPassRate}% {t.qualityFirstPass}
                </p>
              )}
            </div>

            {/* Their body of work. */}
            <div>
              <p className="flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">
                <MapPin className="h-3.5 w-3.5 text-guaca-coral" /> {t.myPinsTitle} ({myPlaces.length})
              </p>
              {myPlaces.length === 0 ? (
                <p className="mt-2 rounded-[24px] border border-dashed border-guaca-sand bg-white/60 px-4 py-4 text-center text-[11px] font-semibold text-guaca-ink/45">{t.myPinsEmpty}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {myPlaces.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-[24px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-guaca-coral/10 text-guaca-coral">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-black text-guaca-ink">{p.name}</p>
                        <p className="text-[10px] font-bold text-guaca-ink/45">
                          {categoryLabel(p.category, lang)}
                          {p.verified_at
                            ? ` · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(p.verified_at))}`
                            : ''}
                        </p>
                      </div>
                      <BadgeCheck className="h-4 w-4 shrink-0 text-guaca-palm" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dummy points store — catalog only; redemptions post-pilot. */}
            <div>
              <p className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">{t.storeTitle}</p>
              <div className="mt-2 flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none]">
                {STORE_ITEMS.map((item) => {
                  const affordable = (me?.totalPoints ?? 0) >= item.cost
                  return (
                    <div key={item.id} className="w-32 shrink-0 rounded-[22px] bg-white p-3 text-center shadow-sm ring-1 ring-guaca-sand/75">
                      <p className="text-3xl">{item.emoji}</p>
                      <p className="mt-1.5 h-8 text-[10px] font-black leading-tight text-guaca-ink">{lang === 'es' ? item.es : item.en}</p>
                      <p className="mt-1 text-[11px] font-black text-guaca-coral-dark">{pts(item.cost)}</p>
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => setBanner({ kind: 'info', text: t.storeNote })}
                        className={`mt-2 w-full rounded-full px-2 py-1.5 text-[9px] font-black ${affordable ? 'bg-guaca-coral text-white hover:bg-guaca-coral-dark' : 'bg-guaca-ink/6 text-guaca-ink/35'}`}
                      >
                        {t.storeRedeem}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="px-1 text-[9px] font-semibold text-guaca-ink/40">{t.storeNote}</p>
            </div>

            {/* Monthly ranking */}
            <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
              <p className="flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">
                <Trophy className="h-3.5 w-3.5 text-guaca-mango-dark" /> {t.rankingTitle}
              </p>
              <div className="mt-2 space-y-1">
                {ranking.map((r) => (
                  <div key={r.id} className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${r.id === me?.id ? 'bg-guaca-coral/8 ring-1 ring-guaca-coral/25' : ''}`}>
                    <span className="w-6 text-center text-[13px] font-black text-guaca-ink/60">
                      {r.points > 0 ? (MEDALS[r.rank - 1] ?? `#${r.rank}`) : `#${r.rank}`}
                    </span>
                    <Avatar url={r.photo_url} name={r.name} className="h-7 w-7" textClassName="text-[10px]" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-black text-guaca-ink">
                      {r.name} <span className="text-[9px] font-bold text-guaca-ink/40">Lv{r.level}</span>
                    </span>
                    <span className="shrink-0 text-[12px] font-black text-guaca-coral-dark">{pts(r.points)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Points history */}
            <p className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">{t.historyTitle}</p>
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
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-black text-guaca-palm">{pts(e.rewardMinor)}</span>
              </article>
            ))}
            {/* Mode switch — mirrors the tourist profile's card; the map
                has no floating Role pill anymore. */}
            <button
              type="button"
              onClick={() => { window.location.href = '/' }}
              className="flex w-full items-center gap-3 rounded-[28px] bg-gradient-to-r from-guaca-teal to-guaca-ocean p-4 text-left shadow-lg shadow-guaca-teal/20 transition-transform hover:-translate-y-0.5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-white">
                <Compass className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-white">{t.becomeTourist}</span>
                <span className="mt-0.5 block text-[10px] font-bold leading-relaxed text-white/85">{t.becomeTouristNote}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/80" />
            </button>

            <button
              type="button"
              onClick={() => {
                fetch('/api/spotter/logout', { method: 'POST', credentials: 'include' })
                  .catch(() => {})
                  .finally(() => { window.location.href = '/' })
              }}
              className="w-full rounded-2xl bg-white px-5 py-4 text-center text-[12px] font-black text-guaca-ink shadow-sm ring-1 ring-guaca-sand/75 hover:bg-guaca-sand/20"
            >
              {t.signOut}
            </button>

            <p className="px-4 text-center text-[10px] font-semibold leading-relaxed text-guaca-ink/40">
              {t.deleteNote}
            </p>

            {OPERATOR_WHATSAPP && (
              <a
                href={`https://wa.me/${OPERATOR_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl bg-white px-5 py-4 text-center text-[12px] font-black text-guaca-teal shadow-sm ring-1 ring-guaca-sand/75 hover:bg-guaca-sand/20"
              >
                {t.contactOperator}
              </a>
            )}

            <div className="flex items-center justify-center gap-4 pb-2 text-[11px] font-bold text-guaca-ink/45">
              <a href={`${LANDING_URL}/privacy`} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                {t.legalPrivacy}
              </a>
              <span aria-hidden="true">·</span>
              <a href={`${LANDING_URL}/terms`} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                {t.legalTerms}
              </a>
            </div>
          </div>
        )}
      </div>
      )}
      </div>

      <div className="z-[500] shrink-0 border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-6 pb-5 pt-2 backdrop-blur-md lg:order-1 lg:w-24 lg:border-r lg:border-t-0 lg:px-2 lg:py-6">
        <div className="flex items-center justify-around lg:flex-col lg:justify-start lg:gap-5">
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

function CaptureFlow({ mission, candidate, onDone }: { mission: Mission | null; candidate?: CandidatePlace | null; onDone: () => void }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].spotter
  // A candidate carries a name and a public address already; still typed
  // into an editable field, never submitted untouched — a spotter can (and
  // should) correct what public data got wrong.
  const [name, setName] = useState(candidate?.name ?? '')
  const [landmark, setLandmark] = useState(candidate?.public_address ?? '')
  const [coords, setCoords] = useState<{ lat: number; lon: number; accuracy: number } | null>(null)
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null])
  // A free submission has no brief, so the spotter states the category.
  const [category, setCategory] = useState<string>(mission?.targetCategory ?? candidate?.category ?? 'eat_drink')
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
              category: mission ? mission.targetCategory : category,
              landmarkDescription: landmark,
              lat: coords.lat,
              lon: coords.lon,
              ...(mission ? { missionId: mission.id } : {}),
              ...(candidate ? { candidateId: candidate.id } : {}),
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
        const imageBase64 = await photoToBase64(file)
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
    <div className="h-full min-h-dvh overflow-y-auto bg-guaca-sand-light px-5 pb-16 pt-12 lg:px-[max(1.25rem,calc((100%-44rem)/2))]">
      <div className="rounded-[32px] bg-gradient-to-br from-guaca-teal to-guaca-ocean p-6 text-white shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[.1em] text-white/70">
          {mission ? categoryLabel(mission.targetCategory, lang) : candidate ? categoryLabel(candidate.category, lang) : t.freeTitle}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-[-.03em]">{t.captureTitle}</h1>
        <p className="mt-2 text-sm font-semibold text-white/85">{mission ? mission.brief : candidate ? t.candidateBody : t.freeLede}</p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          {!mission && !candidate && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-black text-guaca-ink/70">{t.categoryLabel}</p>
              <div className="flex flex-wrap gap-1.5">
                {TAXONOMY.map((entry) => (
                  <button
                    key={entry.category}
                    type="button"
                    onClick={() => setCategory(entry.category)}
                    aria-pressed={category === entry.category}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-black ${category === entry.category ? 'bg-guaca-coral text-white' : 'bg-guaca-ink/6 text-guaca-ink/60'}`}
                  >
                    {lang === 'es' ? entry.labelEs : entry.labelEn}
                  </button>
                ))}
              </div>
            </div>
          )}
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
