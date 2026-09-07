import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, BadgeCheck, Camera, CircleDollarSign, ClipboardCheck, Clock, Compass, Crosshair, Loader2, Map as MapIcon, MapPin, Medal, Send, Sparkles, Trophy, Users, Waves, X } from 'lucide-react'
import { Avatar, Button, GuacaLogo, GuacaMap, Input, useLanguage, categoryIconSvg, missionTaskIconSvg, type Lang } from '@guaca/ui'
import { TAXONOMY, type RewardCatalogItem, type RewardLedgerEntry, type Redemption } from '@guaca/shared'
import { appCopy } from '../lib/copy'
import { photoToBase64 } from '../lib/image'
import { VENUE_TZ } from '../lib/scenarioActors'
import { InstallApp } from './InstallApp'
import { RailArt } from './RailArt'
import { MobileViewport } from './MobileViewport'

// ~6.5 km — the walkable pilot zone; matches the tourist map's candidate query.
const CANDIDATE_BBOX_HALF_DEG = 0.06

interface Mission {
  id: string
  brief: string
  targetCategory: string
  rewardMinor: number
  currency: string
  status: string
  expiresAt?: string | null
  placeName?: string | null
  placeId?: string | null
  expectedEvidence?: string | null
  expectedEvidenceEn?: string | null
  expectedEvidenceEs?: string | null
  areaName?: string | null
  taskKind?: string | null
  photoUrl?: string | null
  lat?: number | null
  lon?: number | null
  mine?: boolean
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
  public_subcategory?: string | null
}

interface PendingConfirmation {
  id: string
  name: string
  landmark_description: string
  category: string
  distanceM: number
  lat: number
  lon: number
  missionId?: string
  photoUrl?: string | null
}

/** A mission target on the map — the gap's h3 cell centre. */
interface Opportunity {
  id: string
  status: string
  category: string
  reward_minor: number
  question_count: number
  lat: number | null
  lon: number | null
  taskKind?: string | null
  placeName?: string | null
  photoUrl?: string | null
  placeId?: string | null
  mine?: boolean
  brief?: string
}

interface MapListing {
  id: string
  name: string
  category: string
  lat: number
  lon: number
  photo_url?: string | null
  verification_status?: string
}

interface HeatPoint {
  lat: number
  lng: number
  weight: number
}

type MapFilter = 'all' | 'hours' | 'access' | 'evidence' | 'witness' | 'first' | 'mine' | 'done'

interface Earning {
  missionId: string
  brief: string
  status: string
  rewardMinor: number
  currency: string
  payoutStatus: string | null
}

interface SpotterMe {
  readOnly?: boolean
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

const CATALOG_EMOJI: Record<string, string> = {
  cap: '🧢',
  bottle: '🍼',
  voucher: '🎟️',
}

const OPEN_STATUSES = new Set(['offered'])
const PROGRESS_STATUSES = new Set(['accepted', 'submitted'])
const HISTORY_STATUSES = new Set(['verified', 'paid', 'expired', 'cancelled'])

type Verdict =
  | { decision: 'needs_second_local' | 'needs_operator'; reasons?: string[] }
  | { decision: 'rejected'; reasons: string[] }

/** Spotters earn POINTS, not money — mission reward values are points. */
const pts = (points: number) => `${points} pts`

function categoryLabel(category: string, lang: Lang): string {
  const entry = TAXONOMY.find((t) => t.category === category)
  return entry ? (lang === 'es' ? entry.labelEs : entry.labelEn) : category
}

function categoryEmoji(category: string): string {
  return TAXONOMY.find((t) => t.category === category)?.emoji ?? '📍'
}

function categoryColor(category: string): string {
  return TAXONOMY.find((t) => t.category === category)?.color ?? '#0D8B8B'
}

/** An expired session goes back through the gate. Never a fake empty list. */
function guard401(r: Response): Response {
  if (r.status === 401) {
    window.location.reload()
    throw new Error('session expired')
  }
  return r
}

async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return typeof body.error === 'string' ? body.error : ''
}

function asMission(raw: Record<string, unknown>): Mission {
  const expires = raw.expiresAt ?? raw.expires_at
  return {
    id: String(raw.id ?? ''),
    brief: String(raw.brief ?? ''),
    targetCategory: String(raw.targetCategory ?? raw.target_category ?? ''),
    rewardMinor: Number(raw.rewardMinor ?? raw.reward_minor ?? 0),
    currency: String(raw.currency ?? 'USD'),
    status: String(raw.status ?? ''),
    expiresAt: expires == null ? null : String(expires),
    placeName: (raw.placeName ?? raw.place_name ?? null) as string | null,
    placeId: (raw.placeId ?? raw.place_id ?? null) as string | null,
    expectedEvidence: (raw.expectedEvidence ?? raw.expected_evidence ?? null) as string | null,
    expectedEvidenceEn: (raw.expectedEvidenceEn ?? raw.expected_evidence_en ?? null) as string | null,
    expectedEvidenceEs: (raw.expectedEvidenceEs ?? raw.expected_evidence_es ?? null) as string | null,
    areaName: (raw.areaName ?? raw.area_name ?? null) as string | null,
    taskKind: (raw.taskKind ?? raw.task_kind ?? null) as string | null,
    photoUrl: (raw.photoUrl ?? raw.photo_url ?? null) as string | null,
    lat: raw.lat == null ? null : Number(raw.lat),
    lon: raw.lon == null ? null : Number(raw.lon),
    mine: raw.mine !== false,
  }
}

function formatDeadline(value: string | null | undefined, lang: Lang): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: VENUE_TZ,
  }).format(d)
}

function missionEvidence(m: Mission, lang: Lang, fallback: string): string {
  if (lang === 'es' && m.expectedEvidenceEs) return m.expectedEvidenceEs
  if (lang === 'en' && m.expectedEvidenceEn) return m.expectedEvidenceEn
  return m.expectedEvidence ?? fallback
}

function asCatalogItem(raw: Record<string, unknown>): RewardCatalogItem | null {
  const id = String(raw.id ?? '')
  const kind = raw.kind
  if (!id || (kind !== 'cap' && kind !== 'bottle' && kind !== 'voucher')) return null
  return {
    id,
    slug: String(raw.slug ?? ''),
    titleEn: String(raw.titleEn ?? raw.title_en ?? ''),
    titleEs: String(raw.titleEs ?? raw.title_es ?? ''),
    descriptionEn: String(raw.descriptionEn ?? raw.description_en ?? ''),
    descriptionEs: String(raw.descriptionEs ?? raw.description_es ?? ''),
    pointCost: Number(raw.pointCost ?? raw.point_cost ?? 0),
    kind,
  }
}

function asRedemption(raw: Record<string, unknown>): Redemption | null {
  const id = String(raw.id ?? '')
  const catalogId = String(raw.catalogId ?? raw.catalog_id ?? '')
  const receiptCode = String(raw.receiptCode ?? raw.receipt_code ?? '')
  if (!id || !catalogId || !receiptCode) return null
  const created = raw.createdAt ?? raw.created_at
  return {
    id,
    spotterId: String(raw.spotterId ?? raw.spotter_id ?? ''),
    catalogId,
    missionId: (raw.missionId ?? raw.mission_id ?? null) as string | null,
    pointsSpent: Number(raw.pointsSpent ?? raw.points_spent ?? 0),
    receiptCode,
    createdAt: created == null ? new Date().toISOString() : String(created),
  }
}

function asLedgerEntry(raw: Record<string, unknown>): RewardLedgerEntry | null {
  const id = String(raw.id ?? '')
  if (!id) return null
  const created = raw.createdAt ?? raw.created_at
  return {
    id,
    spotterId: String(raw.spotterId ?? raw.spotter_id ?? ''),
    delta: Number(raw.delta ?? 0),
    reason: String(raw.reason ?? ''),
    missionId: (raw.missionId ?? raw.mission_id ?? null) as string | null,
    createdAt: created == null ? new Date().toISOString() : String(created),
  }
}

export function SpotterView() {
  const { lang, setLang } = useLanguage()
  const t = appCopy[lang].spotter
  const [tab, setTab] = useState<'missions' | 'map' | 'confirm' | 'earnings'>('map')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [listings, setListings] = useState<MapListing[]>([])
  const [heat, setHeat] = useState<HeatPoint[]>([])
  const [mapFilter, setMapFilter] = useState<MapFilter>('all')
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
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
  const languageInitialized = useRef(false)
  const canContribute = me !== null && !me.readOnly
  const [ranking, setRanking] = useState<RankRow[]>([])
  const [myRank, setMyRank] = useState<{ rank: number; points: number } | null>(null)
  const [stats, setStats] = useState<SpotterStats | null>(null)
  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)
  // The confirming spotter's real position. The server requires it because
  // a second local on the ground has to mean on the ground.
  const [fix, setFix] = useState<[number, number] | null>(null)
  const [rewardBalance, setRewardBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<RewardLedgerEntry[]>([])
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [receipt, setReceipt] = useState<Redemption | null>(null)
  const [redeemBusy, setRedeemBusy] = useState<string | null>(null)
  const [recordingLive, setRecordingLive] = useState(false)
  const [askText, setAskText] = useState('')
  const [askBusy, setAskBusy] = useState(false)
  const [askReply, setAskReply] = useState<{ text: string; missionIds: string[] } | null>(null)

  const reasonLabel = (code: string) => t.reasons[code] ?? code

  const statusLabel: Record<string, string> = {
    offered: t.statusOffered,
    accepted: t.statusAccepted,
    submitted: t.awaitingSecond,
    verified: t.statusVerified,
    paid: t.statusVerified,
    expired: t.statusExpired,
    cancelled: t.statusCancelled,
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
      .then((d: { missions?: unknown[] }) =>
        setMissions((d.missions ?? []).map((row) => asMission((row ?? {}) as Record<string, unknown>)).filter((m) => m.id)),
      )
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
        .then((d: { pending: PendingConfirmation[]; missions?: PendingConfirmation[] }) => {
          const extra = (d.missions ?? []).map((m) => ({
            ...m,
            landmark_description: m.landmark_description,
          }))
          setPending([...(d.pending ?? []), ...extra])
        })
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

  const loadRewards = useCallback(() => {
    fetch('/api/spotter/rewards', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { balance?: number; ledger?: unknown[]; entries?: unknown[]; redemptions?: unknown[] } | null) => {
        if (!d) return
        if (typeof d.balance === 'number') setRewardBalance(d.balance)
        const rows = (d.ledger ?? d.entries ?? [])
          .map((row) => asLedgerEntry((row ?? {}) as Record<string, unknown>))
          .filter((row): row is RewardLedgerEntry => row !== null)
        setLedger(rows)
        if (d.redemptions) {
          setRedemptions(
            d.redemptions
              .map((row) => asRedemption((row ?? {}) as Record<string, unknown>))
              .filter((row): row is Redemption => row !== null),
          )
        }
      })
      .catch((e) => {
        if (String(e).includes('session')) return
      })
    fetch('/api/spotter/rewards/catalog', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: unknown[]; catalog?: unknown[] } | null) => {
        if (!d) return
        setCatalog(
          (d.items ?? d.catalog ?? [])
            .map((row) => asCatalogItem((row ?? {}) as Record<string, unknown>))
            .filter((row): row is RewardCatalogItem => row !== null),
        )
      })
      .catch((e) => {
        if (String(e).includes('session')) return
      })
  }, [])

  useEffect(() => {
    loadMissions()
  }, [loadMissions])

  useEffect(() => {
    fetch('/api/recording/runtime', { credentials: 'include' })
      .then((r) => setRecordingLive(r.ok))
      .catch(() => setRecordingLive(false))
  }, [])

  const askGuaca = async (preset?: string) => {
    const text = (preset ?? askText).trim()
    if (text.length < 2 || askBusy) return
    setAskBusy(true)
    setAskReply(null)
    try {
      const res = guard401(
        await fetch('/api/spotter/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text, language: lang }),
        }),
      )
      if (!res.ok) {
        setBanner({ kind: 'error', text: t.askError })
        return
      }
      const body = (await res.json()) as { text?: string; missionIds?: string[] }
      setAskReply({ text: body.text ?? '', missionIds: body.missionIds ?? [] })
      if (!preset) setAskText('')
    } catch (e) {
      if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.askError })
    } finally {
      setAskBusy(false)
    }
  }
  const loadOpportunities = useCallback(() => {
    fetch('/api/spotter/opportunities', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : { opportunities: [] }))
      .then((d: { opportunities: Opportunity[]; listings?: MapListing[]; heat?: HeatPoint[] }) => {
        setOpportunities(d.opportunities ?? [])
        setListings(d.listings ?? [])
        setHeat(d.heat ?? [])
      })
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
          if (!languageInitialized.current && (d.language === 'es' || d.language === 'en')) {
            languageInitialized.current = true
            if (!localStorage.getItem('guaca-lang')) setLang(d.language)
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
  }, [setLang])

  useEffect(() => { loadProfile() }, [loadProfile])

  /** Their face rides every pin they verify — let them set it here. */
  const uploadPhoto = async (file: File) => {
    if (!canContribute) return
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
      loadRewards()
    }
    if (tab === 'map') {
      loadOpportunities()
      loadPending()
    }
  }, [tab, loadMissions, loadPending, loadEarnings, loadOpportunities, loadProfile, loadRewards])

  useEffect(() => {
    if (tab === 'missions') {
      const waiting = missions.some((m) => m.status === 'submitted' || m.status === 'accepted')
      if (!waiting) return
      const id = window.setInterval(() => {
        loadMissions()
        loadRewards()
      }, 3000)
      return () => window.clearInterval(id)
    }
    if (tab === 'confirm') {
      const id = window.setInterval(loadPending, 3000)
      return () => window.clearInterval(id)
    }
  }, [tab, missions, loadMissions, loadRewards, loadPending])

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lon = pos.coords.longitude
        const lat = pos.coords.latitude
        const inPilot = lon > -68.04 && lon < -67.97 && lat > 10.43 && lat < 10.52
        if (inPilot) setMapCenter([lon, lat])
      },
      () => {},
      { timeout: 3000, maximumAge: 300_000 },
    )
  }, [])

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
  // not just what was near the pilot's default point. Loaded on every tab
  // because the missions screen counts them when there is nothing else to do.
  useEffect(() => {
    loadCandidates()
  }, [loadCandidates])

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
        } else {
          const code = await readApiError(res)
          if (res.status === 409 && /expir/i.test(code)) setBanner({ kind: 'error', text: t.missionExpired })
          else setBanner({ kind: 'error', text: t.error })
        }
      } catch (e) {
        if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.error })
      }
    })

  const pointsDisplay = rewardBalance ?? me?.totalPoints ?? 0

  const redeem = (catalogId: string) =>
    withBusy(`redeem:${catalogId}`, async () => {
      if (!canContribute) return
      setRedeemBusy(catalogId)
      try {
        const res = guard401(
          await fetch('/api/spotter/rewards/redeem', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ catalogId }),
          }),
        )
        if (res.ok) {
          const body = (await res.json()) as {
            redemption?: Redemption
            id?: string
            receiptCode?: string
            balance?: number
          }
          const rec = body.redemption ?? (body.id && body.receiptCode
            ? {
                id: body.id,
                spotterId: me?.id ?? '',
                catalogId,
                missionId: null,
                pointsSpent: 0,
                receiptCode: body.receiptCode,
                createdAt: new Date().toISOString(),
              }
            : null)
          if (rec) {
            setReceipt(rec)
            setRedemptions((prev) => [...prev, rec])
          }
          if (typeof body.balance === 'number') setRewardBalance(body.balance)
          setBanner({ kind: 'info', text: t.redeemDone })
          loadRewards()
          loadProfile()
        } else {
          const code = await readApiError(res)
          if (res.status === 409 && /already/i.test(code)) setBanner({ kind: 'info', text: t.alreadyRedeemed })
          else if (/insufficient/i.test(code) || res.status === 400) setBanner({ kind: 'error', text: t.insufficientPoints })
          else setBanner({ kind: 'error', text: t.error })
        }
      } catch (e) {
        if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.error })
      } finally {
        setRedeemBusy(null)
      }
    })

  const confirmMission = (missionId: string) =>
    withBusy(missionId, async () => {
      try {
        const res = guard401(
          await fetch(`/api/spotter/missions/${missionId}/confirm`, {
            method: 'POST',
            credentials: 'include',
          }),
        )
        if (res.ok) {
          setBanner({ kind: 'info', text: t.confirmed })
          loadMissions()
          loadPending()
          loadOpportunities()
          loadRewards()
        } else if (res.status === 409) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          setBanner({
            kind: 'error',
            text: body.error === 'SELF_CONFIRMATION' ? t.confirmOtherAccount : t.error,
          })
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
    <MobileViewport className="spotter-workspace relative flex h-dvh flex-col overflow-hidden bg-guaca-sand-light lg:flex-row">
      <div className="relative min-h-0 flex-1 lg:order-2">
      {tab === 'map' && (
        <>
          <div className="spotter-map absolute inset-0 z-0">
            <GuacaMap
              pins={[
                ...opportunities
                  .filter((o) => o.lat != null && o.lon != null)
                  .filter((o) => {
                    if (mapFilter === 'hours') return o.taskKind === 'hours'
                    if (mapFilter === 'access') return o.taskKind === 'access'
                    if (mapFilter === 'evidence') return o.taskKind === 'evidence'
                    if (mapFilter === 'witness') return o.status === 'submitted' && o.mine === false
                    if (mapFilter === 'first') return false
                    if (mapFilter === 'mine') return o.mine !== false && o.status !== 'verified' && o.status !== 'paid'
                    if (mapFilter === 'done') return o.status === 'verified' || o.status === 'paid'
                    return true
                  })
                  .map((o) => ({
                    id: `m:${o.id}`,
                    lat: o.lat as number,
                    lng: o.lon as number,
                    emoji: o.status === 'submitted' ? '👥' : o.taskKind === 'hours' ? '🕒' : o.taskKind === 'access' ? '🌊' : o.status === 'verified' ? '✓' : '📷',
                    iconSvg: missionTaskIconSvg(o.taskKind, o.status, 18),
                    label: o.placeName ?? o.brief ?? categoryLabel(o.category, lang),
                    spotterColor: o.status === 'submitted' ? '#C45C26' : o.status === 'verified' ? '#2F6F4E' : categoryColor(o.category),
                    spotterInitials: '',
                    verified: o.status === 'verified' || o.status === 'paid',
                    listed: o.status !== 'verified' && o.status !== 'paid',
                    photoUrl: o.photoUrl ?? listings.find((l) => l.id === o.placeId)?.photo_url ?? undefined,
                  })),
                ...listings
                  .filter((l) => !opportunities.some((o) => o.placeId === l.id))
                  .filter(() => mapFilter === 'all' || mapFilter === 'first')
                  .map((l) => ({
                    id: `l:${l.id}`,
                    lat: l.lat,
                    lng: l.lon,
                    emoji: categoryEmoji(l.category),
                    iconSvg: categoryIconSvg(l.category, 18),
                    label: l.name,
                    spotterColor: categoryColor(l.category),
                    spotterInitials: '',
                    verified: l.verification_status === 'verified',
                    listed: l.verification_status !== 'verified',
                    photoUrl: l.photo_url ?? undefined,
                  })),
              ]}
              heat={heat}
              dots={candidates
                .filter((c) => !listings.some((l) => l.id === c.id))
                .filter((c) => !opportunities.some((o) => o.lat === c.lat && o.lon === c.lon))
                .map((c) => ({
                  id: c.id,
                  lat: c.lat,
                  lng: c.lon,
                  label: c.name,
                  category: c.category,
                }))}
              selectedPinId={selectedPin}
              onPinClick={(id) => setSelectedPin(id)}
              onDotClick={(id) => {
                const c = candidates.find((x) => x.id === id)
                if (c) setSelectedCandidate(c)
              }}
              showUserLocation
              mapStyle="streets"
              center={mapCenter}
              zoom={14.2}
            />
          </div>
          <div className="absolute inset-x-0 top-0 z-[400] px-4 pb-6 pt-5 lg:inset-x-auto lg:left-0 lg:w-[560px] lg:px-6 lg:pt-6">
            {recordingLive ? (
              <form
                onSubmit={(e) => { e.preventDefault(); void askGuaca() }}
                className="flex items-center gap-2 rounded-full border border-white/65 bg-guaca-sand-light/95 px-3 py-2 shadow-xl shadow-guaca-ocean-deep/14 backdrop-blur-md"
              >
                <Sparkles aria-hidden="true" className="h-5 w-5 shrink-0 text-guaca-coral" />
                <Input
                  value={askText}
                  onChange={(event) => setAskText(event.target.value)}
                  placeholder={t.askPlaceholder}
                  aria-label={t.askPlaceholder}
                  className="h-7 flex-1 border-0 bg-transparent px-0 text-[12px] shadow-none placeholder:text-guaca-ink/35 focus-visible:ring-0 lg:h-10 lg:text-[15px]"
                />
                <Button type="submit" size="icon" disabled={askBusy || askText.trim().length < 2} aria-label={t.askSend} className="h-11 w-11 shrink-0 rounded-full bg-guaca-coral text-white hover:bg-guaca-coral-dark">
                  {askBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
                <Button
                  type="button"
                  disabled={!canContribute}
                  onClick={() => setCapture('free')}
                  className="h-11 shrink-0 rounded-full bg-guaca-ocean-deep px-3 text-[11px] font-black text-white"
                >
                  {t.spotHereCta}
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-white/65 bg-guaca-sand-light/95 px-3 py-2 shadow-xl shadow-guaca-ocean-deep/14 backdrop-blur-md">
                <Crosshair aria-hidden="true" className="h-5 w-5 shrink-0 text-guaca-coral" />
                <p className="min-w-0 flex-1 truncate text-[12px] font-black text-guaca-ink lg:text-[15px]">{t.mapLede}</p>
                <Button
                  type="button"
                  disabled={!canContribute}
                  onClick={() => setCapture('free')}
                  className="h-11 shrink-0 rounded-full bg-guaca-coral px-3 text-[11px] font-black text-white hover:bg-guaca-coral-dark"
                >
                  {t.spotHereCta}
                </Button>
              </div>
            )}
            {recordingLive && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {[t.askChipNearby, t.askChipBreakfast, t.askChipWitness].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={askBusy}
                    onClick={() => void askGuaca(chip)}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/90 px-3 text-[11px] font-black text-guaca-ink shadow-md"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            {askReply && (
              <div className="mt-2 rounded-[24px] bg-white/95 p-4 shadow-xl ring-1 ring-guaca-sand/80">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.1em] text-guaca-coral-dark">
                    <Sparkles className="h-3.5 w-3.5" /> Guaca
                  </p>
                  <button type="button" aria-label={t.close} onClick={() => setAskReply(null)} className="grid h-11 w-11 place-items-center rounded-full bg-guaca-ink/6">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[13px] font-semibold leading-relaxed text-guaca-ink">{askReply.text}</p>
                {askReply.missionIds[0] && (
                  <Button
                    type="button"
                    onClick={() => setSelectedPin(`m:${askReply.missionIds[0]}`)}
                    className="mt-3 h-11 w-full rounded-xl bg-guaca-coral text-[12px] font-black text-white"
                  >
                    {t.filterAvailable}
                  </Button>
                )}
              </div>
            )}
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {([
                { key: 'all' as const, label: t.filterAll, n: opportunities.length + listings.length, Icon: MapIcon },
                { key: 'hours' as const, label: t.filterHours, n: opportunities.filter((o) => o.taskKind === 'hours').length, Icon: Clock },
                { key: 'access' as const, label: t.filterAccess, n: opportunities.filter((o) => o.taskKind === 'access').length, Icon: Waves },
                { key: 'evidence' as const, label: t.filterPhoto, n: opportunities.filter((o) => o.taskKind === 'evidence').length, Icon: Camera },
                { key: 'witness' as const, label: t.filterWitness, n: opportunities.filter((o) => o.status === 'submitted' && o.mine === false).length, Icon: Users },
                { key: 'first' as const, label: t.filterFirst, n: listings.filter((l) => !opportunities.some((o) => o.placeId === l.id)).length, Icon: MapPin },
                { key: 'mine' as const, label: t.filterMine, n: opportunities.filter((o) => o.mine !== false && o.status !== 'verified' && o.status !== 'paid').length, Icon: Trophy },
                { key: 'done' as const, label: t.filterDone, n: opportunities.filter((o) => o.status === 'verified' || o.status === 'paid').length, Icon: BadgeCheck },
              ]).map(({ key, label, n, Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={mapFilter === key}
                  onClick={() => setMapFilter(key)}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black shadow-md backdrop-blur-md ${mapFilter === key ? 'bg-guaca-ocean-deep text-white' : 'bg-guaca-sand-light/92 text-guaca-ink/70'}`}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {label} ({n})
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-guaca-ocean-deep/85 px-3 py-1.5 text-[11px] font-black text-white shadow-md">
                <MapPin aria-hidden="true" className="h-3 w-3 text-guaca-mango-light" /> 🇻🇪 {t.cityPilot}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-guaca-sand-light/90 px-3 py-1.5 text-[10px] font-black text-guaca-ink/70 shadow-md">
                <span className="h-2 w-6 rounded-full bg-gradient-to-r from-guaca-teal via-guaca-mango to-guaca-coral" />
                {t.legendHeat}
              </span>
            </div>
          </div>
          {selectedPin && (() => {
            const missionId = selectedPin.startsWith('m:') ? selectedPin.slice(2) : null
            const listingId = selectedPin.startsWith('l:') ? selectedPin.slice(2) : null
            const o = missionId ? opportunities.find((x) => x.id === missionId) : null
            const l = listingId ? listings.find((x) => x.id === listingId) : null
            const m = missionId ? missions.find((x) => x.id === missionId) : null
            const title = o?.placeName ?? o?.brief ?? l?.name ?? ''
            const kindLabel = o?.status === 'submitted' && o.mine === false
              ? t.taskWitness
              : o?.status === 'verified' || o?.status === 'paid'
                ? t.taskDone
                : o?.taskKind === 'hours' ? t.taskHours : o?.taskKind === 'access' ? t.taskAccess : o ? t.taskEvidence : t.unverifiedInvite
            return (
              <div className="absolute inset-x-3 bottom-24 z-[500] rounded-[28px] bg-white p-4 shadow-xl ring-1 ring-guaca-sand/80 lg:inset-x-auto lg:left-4 lg:w-[420px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[.08em] text-guaca-coral-dark">{kindLabel}</p>
                    <h3 className="mt-1 text-[16px] font-black leading-tight text-guaca-ink">{title}</h3>
                    {o && <p className="mt-1 text-[12px] font-semibold text-guaca-ink/60">{o.brief}</p>}
                    {l && !o && <p className="mt-1 text-[12px] font-semibold text-guaca-ink/60">{t.unverifiedInvite}</p>}
                  </div>
                  <button type="button" aria-label={t.close} onClick={() => setSelectedPin(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-guaca-ink/6">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {(o?.photoUrl || l?.photo_url) && (
                  <img
                    src={o?.photoUrl || l?.photo_url || ''}
                    alt=""
                    className="mt-3 h-28 w-full rounded-2xl object-cover"
                  />
                )}
                {o && (
                  <p className="mt-3 text-[12px] font-black text-guaca-palm">{t.reward}: {pts(o.reward_minor)}</p>
                )}
                {o?.status === 'offered' && o.mine !== false && (
                  <Button type="button" disabled={!canContribute} onClick={() => { void accept(o.id); setSelectedPin(null) }} className="mt-3 h-11 w-full rounded-xl bg-guaca-coral text-xs font-black text-white">
                    {t.acceptCta}
                  </Button>
                )}
                {o?.status === 'accepted' && o.mine !== false && m && (
                  <Button type="button" disabled={!canContribute} onClick={() => setCapture(m)} className="mt-3 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white">
                    {t.startCta}
                  </Button>
                )}
                {o?.status === 'submitted' && o.mine === false && (
                  <Button type="button" disabled={!canContribute} onClick={() => void confirmMission(o.id)} className="mt-3 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white">
                    {t.confirmMissionCta}
                  </Button>
                )}
                {l && !o && (
                  <Button type="button" onClick={() => { const c = candidates.find((x) => x.id === l.id); if (c) { setSelectedCandidate(c); setCapture('candidate') } }} className="mt-3 h-11 w-full rounded-xl bg-guaca-ink text-xs font-black text-white">
                    {t.candidateCta}
                  </Button>
                )}
              </div>
            )
          })()}
          <div className="absolute inset-x-4 bottom-4 z-[600] lg:inset-x-auto lg:bottom-6 lg:right-[72px] lg:w-[440px]">
            {me?.readOnly && <p className="mb-2 rounded-xl bg-guaca-paper p-3 text-sm text-guaca-ink">{lang === 'es' ? 'Acceso de lectura. Verificar requiere una cuenta de Spotter.' : 'Read-only access. Verification requires a Spotter account.'}</p>}
            <Button
              type="button"
              disabled={!canContribute}
              onClick={() => setCapture('free')}
              className="h-12 w-full rounded-2xl bg-guaca-coral text-[13px] font-black text-white shadow-xl shadow-guaca-coral/30 hover:bg-guaca-coral-dark"
            >
              <Camera className="mr-2 h-4 w-4" /> {t.freeCta}
            </Button>
          </div>

          {!me?.readOnly && opportunities.length === 0 && pending.length === 0 && (
            <div className="absolute bottom-[96px] left-4 right-4 z-[450] lg:bottom-[120px] lg:left-auto lg:right-[72px] lg:w-[440px]">
              <p className="guaca-card rounded-[24px] p-4 text-center text-[11px] font-semibold text-guaca-ink/55">{candidates.length > 0 ? t.mapEmptyCandidates : t.mapEmpty}</p>
            </div>
          )}

          {/* A candidate dot — known to open data, unknown to us. Tapping it
              starts the same submission a "free" find would, just pre-filled
              with whatever a public listing already says. */}
          {selectedCandidate && (
            <div className="absolute inset-x-4 bottom-4 z-[700] lg:inset-x-auto lg:bottom-6 lg:right-[72px] lg:w-[440px]">
              <div className="guaca-card rounded-[30px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-guaca-ink/6 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] text-guaca-ink/55">
                      <MapIcon className="h-3 w-3" /> {t.candidateTitle}
                    </p>
                    <h3 className="mt-2 truncate text-lg font-black leading-tight text-guaca-ink">{selectedCandidate.name}</h3>
                    <p className="text-[11px] font-bold text-guaca-ink/50">
                      {categoryEmoji(selectedCandidate.category)} {categoryLabel(selectedCandidate.category, lang)}
                      {selectedCandidate.public_subcategory ? ` · ${selectedCandidate.public_subcategory}` : ''}
                    </p>
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
                {(selectedCandidate.public_phone || selectedCandidate.public_website || selectedCandidate.public_address || (selectedCandidate.public_socials?.length ?? 0) > 0) && (
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
                  disabled={!canContribute}
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
      <div className="h-full overflow-y-auto px-5 pb-8 pt-12 lg:px-[max(1.25rem,calc((100%-44rem)/2))]">
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

        {me?.readOnly && (
          <p role="status" className="mt-4 rounded-xl bg-guaca-teal/10 p-4 text-sm leading-relaxed text-guaca-teal-dark">
            {lang === 'es' ? 'Acceso de lectura. Puedes explorar misiones y lugares. Para aceptar misiones o verificar un lugar, entra con tu cuenta de Spotter.' : 'Read-only access. You can explore missions and places. To accept missions or verify a place, sign in with your Spotter account.'}
            <button type="button" className="mt-2 block min-h-11 py-2 font-semibold underline underline-offset-4" onClick={async () => {
              try {
                const res = await fetch('/api/spotter/logout', { method: 'POST', credentials: 'include' })
                if (!res.ok) throw new Error('Logout failed')
                window.location.href = '/spotter'
              } catch { setBanner({ kind: 'error', text: t.error }) }
            }}>{lang === 'es' ? 'Cambiar de cuenta' : 'Switch account'}</button>
          </p>
        )}
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
          <div className="mt-5 space-y-5">
            {missions.length === 0 && candidates.length > 0 && (
              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-guaca-teal/10 text-guaca-teal">
                    <MapIcon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-black leading-tight text-guaca-ink">{t.candidatesNudgeTitle(candidates.length)}</p>
                    <p className="mt-1 text-[12px] font-semibold leading-relaxed text-guaca-ink/55">{t.candidatesNudgeBody}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => setTab('map')}
                  className="mt-4 h-11 w-full rounded-2xl bg-guaca-teal text-[13px] font-black text-white hover:bg-guaca-teal-dark"
                >
                  {t.candidatesNudgeCta} <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
            {missions.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-guaca-coral/30 bg-white/70 p-6 text-center">
                <Trophy aria-hidden="true" className="mx-auto h-8 w-8 text-guaca-coral/60" />
                <p className="mx-auto mt-3 max-w-[260px] text-[12px] font-semibold leading-relaxed text-guaca-ink/55">
                  {t.missionsEmpty}
                </p>
              </div>
            )}
            {([
              { key: 'open', title: t.openMissionsTitle, rows: missions.filter((m) => OPEN_STATUSES.has(m.status)) },
              { key: 'progress', title: t.inProgressTitle, rows: missions.filter((m) => PROGRESS_STATUSES.has(m.status)) },
              { key: 'history', title: t.completedTitle, rows: missions.filter((m) => HISTORY_STATUSES.has(m.status)) },
            ] as const).map((group) => {
              if (group.rows.length === 0) return null
              return (
                <section key={group.key} className="space-y-3">
                  <p className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">{group.title}</p>
                  {group.rows.map((m, index) => (
                    <MissionCard
                      key={m.id}
                      mission={m}
                      lang={lang}
                      t={t}
                      statusLabel={statusLabel[m.status] ?? m.status}
                      badge={group.key === 'open' ? (index === 0 ? t.mainMission : t.altMission) : null}
                      canContribute={canContribute}
                      busy={busyIds.has(m.id)}
                      onAccept={() => accept(m.id)}
                      onCapture={() => setCapture(m)}
                      onConfirmTab={() => setTab('confirm')}
                    />
                  ))}
                </section>
              )
            })}
          </div>
        )}

        {tab === 'confirm' && (
          <div className="mt-5 space-y-3">
            <p className="rounded-2xl bg-guaca-coral/10 px-4 py-3 text-[12px] font-semibold leading-relaxed text-guaca-coral-dark">
              {t.confirmOtherAccount}
            </p>
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
                <Button type="button" disabled={!canContribute || busyIds.has(p.id)} onClick={() => (p.missionId ? confirmMission(p.missionId) : confirmPlace(p.id))} className="mt-3 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark disabled:opacity-60">
                  <BadgeCheck aria-hidden="true" className="mr-1.5 h-4 w-4" /> {p.missionId ? t.confirmMissionCta : t.confirmCta}
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
                  disabled={photoBusy || !canContribute}
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
              <p className="mt-2 text-[10px] font-semibold text-guaca-ink/45">{t.pointsNotMoney}</p>
              {(() => {
                const prog = levelProgress(pointsDisplay, me?.level ?? 1)
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
                  <p className="text-lg font-black text-guaca-coral-dark">{pointsDisplay}</p>
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

            <div>
              <p className="flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">
                <Medal className="h-3.5 w-3.5 text-guaca-mango-dark" /> {t.badgesTitle}
              </p>
              {(() => {
                const earned: string[] = []
                if (myPlaces.length > 0 || (stats?.verified ?? 0) > 0) earned.push(t.badgeFirstPin)
                if ((stats?.confirmedForOthers ?? 0) > 0) earned.push(t.badgeWitness)
                if ((stats?.firstPassRate ?? 0) >= 80 && (stats?.verified ?? 0) > 0) earned.push(t.badgeSteady)
                if (earned.length === 0) {
                  return <p className="mt-2 rounded-[24px] border border-dashed border-guaca-sand bg-white/60 px-4 py-4 text-center text-[11px] font-semibold text-guaca-ink/45">{t.badgeNone}</p>
                }
                return (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {earned.map((label) => (
                      <span key={label} className="inline-flex min-h-11 items-center rounded-full bg-guaca-coral/10 px-3 text-[11px] font-black text-guaca-coral-dark">
                        {label}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div>
              <p className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">{t.storeTitle}</p>
              <p className="mt-1 px-1 text-[10px] font-semibold leading-relaxed text-guaca-ink/45">{t.catalogSandbox}</p>
              {receipt && (
                <p role="status" className="mt-2 rounded-2xl bg-guaca-palm/10 px-4 py-3 text-[12px] font-bold text-guaca-palm-dark">
                  {t.redeemReceipt} {receipt.receiptCode}
                </p>
              )}
              {catalog.length === 0 ? (
                <p className="mt-2 rounded-[24px] border border-dashed border-guaca-sand bg-white/60 px-4 py-4 text-center text-[11px] font-semibold text-guaca-ink/45">{t.catalogEmpty}</p>
              ) : (
                <div className="mt-2 flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none]">
                  {catalog.map((item) => {
                    const already = redemptions.some((r) => r.catalogId === item.id)
                    const affordable = pointsDisplay >= item.pointCost
                    const enabled = canContribute && affordable && !already && redeemBusy !== item.id
                    return (
                      <div key={item.id} className="w-36 shrink-0 rounded-[22px] bg-white p-3 text-center shadow-sm ring-1 ring-guaca-sand/75">
                        <p className="text-3xl">{CATALOG_EMOJI[item.kind] ?? '🎁'}</p>
                        <p className="mt-1.5 min-h-8 text-[10px] font-black leading-tight text-guaca-ink">{lang === 'es' ? item.titleEs : item.titleEn}</p>
                        <p className="mt-1 text-[10px] font-semibold leading-snug text-guaca-ink/50">{lang === 'es' ? item.descriptionEs : item.descriptionEn}</p>
                        <p className="mt-1 text-[11px] font-black text-guaca-coral-dark">{pts(item.pointCost)}</p>
                        <button
                          type="button"
                          disabled={!enabled}
                          onClick={() => redeem(item.id)}
                          className={`mt-2 min-h-11 w-full rounded-full px-2 py-1.5 text-[9px] font-black ${enabled ? 'bg-guaca-coral text-white hover:bg-guaca-coral-dark' : 'bg-guaca-ink/6 text-guaca-ink/35'}`}
                        >
                          {already ? t.alreadyRedeemed : !affordable ? t.redeemDisabled : redeemBusy === item.id ? t.redeeming : t.storeRedeem}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">{t.ledgerTitle}</p>
              {ledger.length === 0 ? (
                <p className="mt-2 rounded-[24px] border border-dashed border-guaca-sand bg-white/60 px-4 py-4 text-center text-[11px] font-semibold text-guaca-ink/45">{t.ledgerEmpty}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {ledger.map((row) => (
                    <article key={row.id} className="flex items-center justify-between rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-bold text-guaca-ink">{row.reason.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-[10px] font-black text-guaca-ink/45">
                          {formatDeadline(row.createdAt, lang) ?? row.createdAt}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[13px] font-black ${row.delta < 0 ? 'text-guaca-coral-dark' : 'text-guaca-palm'}`}>
                        {row.delta > 0 ? '+' : ''}{pts(row.delta)}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Ranking from the reward ledger */}
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

      <div className="spotter-navigation relative z-[500] shrink-0 border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-6 pb-5 pt-2 backdrop-blur-md lg:order-1 lg:w-24 lg:border-r lg:border-t-0 lg:px-2 lg:py-6">
        <a href="/" className="mb-6 hidden flex-col items-center gap-1 lg:flex" aria-label="Guaca">
          <img src="/brand/guaca-mark.png" alt="" className="h-12 w-12 object-contain" />
          <span className="text-[15px] font-black lowercase tracking-tight text-guaca-coral-dark">guaca</span>
        </a>
        <div className="flex items-center justify-around lg:flex-col lg:justify-start lg:gap-5">
          {(
            [
              { id: 'map', label: t.tabMap, icon: MapIcon },
              { id: 'missions', label: t.tabMissions, icon: Trophy },
              { id: 'confirm', label: t.tabConfirm, icon: BadgeCheck },
              { id: 'earnings', label: t.tabEarnings, icon: CircleDollarSign },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button key={id} type="button" onClick={() => setTab(id)} aria-current={active ? 'page' : undefined} className={`inline-flex h-14 min-w-20 flex-col items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-coral-dark ${active ? 'bg-guaca-coral/10 text-guaca-coral-dark' : 'text-guaca-ink-light hover:bg-guaca-sand'}`}>
                <Icon aria-hidden="true" className="h-5 w-5" />
                {label}
              </button>
            )
          })}
        </div>
        <RailArt />
      </div>
    </MobileViewport>
  )
}

function MissionCard({
  mission: m,
  lang,
  t,
  statusLabel,
  badge,
  canContribute,
  busy,
  onAccept,
  onCapture,
  onConfirmTab,
}: {
  mission: Mission
  lang: Lang
  t: (typeof appCopy)['en']['spotter']
  statusLabel: string
  badge: string | null
  canContribute: boolean
  busy: boolean
  onAccept: () => void
  onCapture: () => void
  onConfirmTab: () => void
}) {
  const deadline = formatDeadline(m.expiresAt, lang)
  const expired = m.status === 'expired'
  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-guaca-coral/10 px-2.5 py-1 text-[9px] font-black text-guaca-coral-dark">
          {badge ? `${badge} · ` : ''}{categoryLabel(m.targetCategory, lang)}
        </span>
        <span className="text-[10px] font-black text-guaca-ink/50">{statusLabel}</span>
      </div>
      <p className="mt-3 text-[13px] font-bold leading-snug text-guaca-ink">{m.brief}</p>
      {(m.placeName || m.areaName) && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-guaca-ink/65">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5" /> {t.placeLabel}: {m.placeName ?? m.areaName}
        </p>
      )}
      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-guaca-ink/55">
        {t.evidenceLabel}: {missionEvidence(m, lang, t.evidenceDefault)}
      </p>
      {deadline && (
        <p className="mt-1 text-[11px] font-bold text-guaca-ink/45">
          {t.deadlineLabel}: {deadline}
        </p>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-[12px] font-black text-guaca-palm">
        <CircleDollarSign aria-hidden="true" className="h-4 w-4" /> {t.reward}: {pts(m.rewardMinor)}
      </p>
      {m.status === 'offered' && (
        <Button type="button" disabled={!canContribute || busy} onClick={onAccept} className="mt-4 h-11 w-full rounded-xl bg-guaca-coral text-xs font-black text-white hover:bg-guaca-coral-dark disabled:opacity-60">
          <ClipboardCheck aria-hidden="true" className="mr-1.5 h-4 w-4" /> {t.acceptCta}
        </Button>
      )}
      {m.status === 'accepted' && (
        <Button type="button" disabled={!canContribute} onClick={onCapture} className="mt-4 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark">
          <Camera aria-hidden="true" className="mr-1.5 h-4 w-4" /> {t.startCta}
        </Button>
      )}
      {m.status === 'submitted' && (
        <div className="mt-4 space-y-2">
          <p className="rounded-2xl bg-guaca-mango/12 px-3 py-2 text-[11px] font-semibold leading-relaxed text-guaca-mango-dark">{t.awaitingSecondNote}</p>
          <Button type="button" onClick={onConfirmTab} className="h-11 w-full rounded-xl bg-guaca-ink/8 text-xs font-black text-guaca-ink hover:bg-guaca-ink/12">
            {t.tabConfirm}
          </Button>
        </div>
      )}
      {(m.status === 'verified' || m.status === 'paid') && (
        <p className="mt-3 rounded-2xl bg-guaca-palm/10 px-3 py-2 text-[11px] font-bold text-guaca-palm-dark">{t.rewardCredited}</p>
      )}
      {expired && (
        <p className="mt-3 rounded-2xl bg-guaca-coral/10 px-3 py-2 text-[11px] font-bold text-guaca-coral-dark">{t.expiredNote}</p>
      )}
    </article>
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
    if (!('geolocation' in navigator)) {
      setError(t.locationDenied)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => setError(err.code === 1 ? t.locationDenied : t.locationMissing),
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
        if (!placeRes.ok) {
          const code = await readApiError(placeRes)
          if (placeRes.status === 409 && /expir|MISSION_NOT_OPEN|no longer open/i.test(code)) throw new Error('expired')
          throw new Error('submit')
        }
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
        if (!photoRes.ok) {
          const code = await readApiError(photoRes)
          if (/PHOTO_REUSE|reuse/i.test(code)) throw new Error('duplicate')
          throw new Error('photo')
        }
        setUploaded((prev) => prev.map((u, j) => (j === i ? true : u)))
      }
      const completeRes = guard401(
        await fetch(`/api/spotter/submissions/${pid}/complete`, {
          method: 'POST',
          credentials: 'include',
        }),
      )
      if (!completeRes.ok) {
        const code = await readApiError(completeRes)
        if (/PHOTO_REUSE|reuse/i.test(code)) throw new Error('duplicate')
        if (/expir|MISSION_NOT_OPEN/i.test(code)) throw new Error('expired')
        throw new Error('complete')
      }
      setResult((await completeRes.json()) as Verdict)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('session')) return
      if (msg.includes('expired')) setError(t.missionExpired)
      else if (msg.includes('duplicate')) setError(t.duplicateEvidence)
      else if (msg.includes('photo') || msg.includes('submit') || msg.includes('complete')) setError(t.uploadFailed)
      else setError(t.error)
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
              {result.decision === 'needs_second_local' ? t.checksPassed : t.resultOperator}
            </p>
            {result.decision === 'needs_second_local' && (
              <p className="max-w-[300px] text-[12px] font-semibold leading-relaxed text-guaca-ink/60">{t.awaitingSecondNote}</p>
            )}
            {result.reasons && result.reasons.length > 0 && (
              <ul className="text-left text-[12px] font-bold text-guaca-ink/60">
                <li className="mb-1 text-[10px] font-black uppercase tracking-[.1em] text-guaca-ink/40">{t.checksTitle}</li>
                {result.reasons.map((r) => (
                  <li key={r}>{reasonLabel(r)}</li>
                ))}
              </ul>
            )}
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
          {mission ? `${categoryEmoji(mission.targetCategory)} ${categoryLabel(mission.targetCategory, lang)}`
            : candidate ? `${categoryEmoji(candidate.category)} ${categoryLabel(candidate.category, lang)}`
            : t.freeTitle}
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
                    {entry.emoji} {lang === 'es' ? entry.labelEs : entry.labelEn}
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
