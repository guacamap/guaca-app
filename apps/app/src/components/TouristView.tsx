import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  Clock3,
  Flag,
  Globe,
  Heart,
  LogOut,
  MapPin,
  MessageCircle,
  Megaphone,
  Navigation,
  Plus,
  RefreshCcw,
  Route,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
  Store,
  Trash2,
  Trophy,
  UserRound,
  X,
} from 'lucide-react'
import { Avatar, Button, GuacaMap, GuacaMark, Input, formatUpdateTime, useInfoStore, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'

/** Puerto Cabello — the pilot area; also the geolocation fallback. */
const PILOT_CENTER: [number, number] = [-68.0056, 10.4716]
const BBOX_HALF_DEG = 0.06 // ~6.5 km — the walkable pilot zone
const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://guaca.live'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.guaca.live'

const THREAD_KEY = 'guaca:thread'
const PLAN_KEY = 'guaca:plan'
const STATS_KEY = 'guaca:stats'
const GEO_KEY = 'guaca:geo'

/** Device-local impact counters. Questions are anonymous on the server by
 *  design (COMPLIANCE.md), so the personal tally lives here, not there. */
interface LocalStats {
  asked: number
  commissioned: number
}

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
  postsCount?: number
  avgRating?: number | null
  ratingCount?: number
}

interface CandidatePlace {
  id: string
  name: string
  category: string
  lat: number
  lon: number
}

type AskState =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'answer'; text: string; placeIds: string[] }
  | { kind: 'refusal'; text: string; questionId?: string }
  | { kind: 'error' }

interface ChatMsg {
  id: string
  role: 'user' | 'guaca'
  kind?: 'answer' | 'refusal' | 'error'
  text: string
  placeIds?: string[]
  questionId?: string
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

interface PlacePost {
  id: string
  body: string
  mediaUrl: string | null
  createdAt: string
  visited: boolean
  rating: number | null
  author: {
    kind: 'spotter' | 'traveler'
    name: string | null
    level: number
    photoUrl: string | null
  }
}

interface Favorite {
  placeId: string
  name: string
  category: string
  lat: number
  lon: number
}

interface Watch {
  questionId: string
  text: string
  askedAt: string
}

interface MyPost {
  id: string
  body: string
  media_url: string | null
  visited: boolean
  rating: number | null
  created_at: string
  place_id: string
  place_name: string
  category: string
}

function mediaPlatform(url: string): string {
  if (url.includes('tiktok')) return 'TikTok'
  if (url.includes('instagram')) return 'Instagram'
  if (url.includes('youtu')) return 'YouTube'
  return 'Video'
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

/** crypto.randomUUID only exists in secure contexts (HTTPS/localhost) —
 *  phones on a LAN IP get plain http, so these local keys need a fallback. */
function localId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
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
  // A real device fix, or null. `center` falls back to the pilot centre for
  // display; sending that as evidence let a 5-star "Visited" review be
  // posted with location denied.
  const [fix, setFix] = useState<[number, number] | null>(null)
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
  const [doubted, setDoubted] = useState<Set<string>>(new Set())
  const [notified, setNotified] = useState<Set<string>>(new Set())
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [posts, setPosts] = useState<PlacePost[]>([])
  const [postsOpen, setPostsOpen] = useState(false)
  const [postText, setPostText] = useState('')
  const [postLink, setPostLink] = useState('')
  const [postRating, setPostRating] = useState(0)
  const [postBusy, setPostBusy] = useState(false)
  const [postErr, setPostErr] = useState(false)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [candidates, setCandidates] = useState<CandidatePlace[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<CandidatePlace | null>(null)
  const [stats, setStats] = useState<LocalStats>({ asked: 0, commissioned: 0 })
  const [watching, setWatching] = useState<Watch[]>([])
  const [fulfilled, setFulfilled] = useState(0)
  const [myPosts, setMyPosts] = useState<MyPost[]>([])
  const [reported, setReported] = useState<Set<string>>(new Set())
  const [villaCode, setVillaCode] = useState('')
  const [villaErr, setVillaErr] = useState(false)
  const [offline, setOffline] = useState(false)
  // Play's User Data policy wants a disclosure BEFORE the runtime prompt.
  const [geoAsked, setGeoAsked] = useState(true)
  const threadEndRef = useRef<HTMLDivElement | null>(null)
  const favIds = useMemo(() => new Set(favorites.map((f) => f.placeId)), [favorites])

  useEffect(() => {
    setThread(loadJson<ChatMsg[]>(THREAD_KEY) ?? [])
    setPlan(loadJson<SavedPlan>(PLAN_KEY))
    setStats(loadJson<LocalStats>(STATS_KEY) ?? { asked: 0, commissioned: 0 })
  }, [])

  const bumpStats = (refused: boolean) => {
    setStats((prev) => {
      const next = {
        asked: prev.asked + 1,
        commissioned: prev.commissioned + (refused ? 1 : 0),
      }
      saveJson(STATS_KEY, next)
      return next
    })
  }

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread, guacaBusy])

  // Centre on the guest if they allow it; the pilot area otherwise (§T1.4).
  // The disclosure runs first: Play requires explaining why we want location
  // before the system prompt appears.
  const useMyLocation = () => {
    setGeoAsked(true)
    try { localStorage.setItem(GEO_KEY, 'asked') } catch { /* ignore */ }
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.longitude, pos.coords.latitude])
        setFix([pos.coords.longitude, pos.coords.latitude])
      },
      () => setFix(null),
      { timeout: 5000, maximumAge: 300_000 },
    )
  }

  const skipLocation = () => {
    setGeoAsked(true)
    try { localStorage.setItem(GEO_KEY, 'skipped') } catch { /* ignore */ }
  }

  useEffect(() => {
    let seen: string | null = null
    try { seen = localStorage.getItem(GEO_KEY) } catch { /* ignore */ }
    if (!seen) return setGeoAsked(false)
    if (seen === 'asked' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.longitude, pos.coords.latitude])
          setFix([pos.coords.longitude, pos.coords.latitude])
        },
        () => setFix(null),
        { timeout: 5000, maximumAge: 300_000 },
      )
    }
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
      .then((data: { places: ApiPlace[] }) => {
        setPlaces(data.places ?? [])
        setOffline(false)
      })
      // A silent catch here left testers staring at an empty map with no
      // explanation when the API was down.
      .catch(() => setOffline(true))
    // The open-data backdrop: OSM candidates as dots, never pins.
    fetch(`/api/places/candidates?bbox=${bbox}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { candidates: [] }))
      .then((data: { candidates: CandidatePlace[] }) => setCandidates(data.candidates ?? []))
      .catch(() => {})
  }, [center])

  // Saved places ride the session.
  useEffect(() => {
    fetch('/api/tourist/favorites', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { favorites: Favorite[] } | null) => {
        if (data) setFavorites(data.favorites)
      })
      .catch(() => {})
  }, [])

  // "What locals say" for the open place — fetched eagerly so the toggle
  // can show a count before it is opened.
  useEffect(() => {
    if (!selected) return
    setPosts([])
    setPostsOpen(false)
    setPostText('')
    setPostLink('')
    setPostRating(0)
    setPostErr(false)
    fetch(`/api/places/${selected.id}/posts`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { posts: PlacePost[] } | null) => {
        if (data) setPosts(data.posts)
      })
      .catch(() => {})
  }, [selected?.id])

  // Account details, watches and posts for the Profile tab.
  useEffect(() => {
    if (activeTab !== 'profile') return
    fetch('/api/tourist/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Me | null) => {
        if (data) setMe(data)
      })
      .catch(() => {})
    fetch('/api/tourist/watching', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { pending: Watch[]; fulfilled: number } | null) => {
        if (d) {
          setWatching(d.pending)
          setFulfilled(d.fulfilled)
        }
      })
      .catch(() => {})
    fetch('/api/tourist/posts', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { posts: MyPost[] } | null) => {
        if (d) setMyPosts(d.posts)
      })
      .catch(() => {})
  }, [activeTab])

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
      (catFilter ? places.filter((p) => p.category === catFilter) : places).map((p) => {
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
          ...(p.avgRating != null && (p.ratingCount ?? 0) > 0
            ? { ratingBadge: p.avgRating.toFixed(1) }
            : {}),
        }
      }),
    [places, catFilter],
  )

  const dots = useMemo(
    () =>
      (catFilter ? candidates.filter((c) => c.category === catFilter) : candidates).map((c) => ({
        id: c.id,
        lat: c.lat,
        lng: c.lon,
        label: c.name,
        category: c.category,
      })),
    [candidates, catFilter],
  )

  // Review-activity heat: verified places weighted by their post volume.
  const heat = useMemo(
    () =>
      places
        .filter((p) => (p.postsCount ?? 0) > 0)
        .map((p) => ({ lat: p.lat, lng: p.lon, weight: Math.min(p.postsCount ?? 0, 10) })),
    [places],
  )

  /** One grounded call for the map box AND the Guaca thread (§7.3). */
  const askApi = async (
    text: string,
  ): Promise<{
    kind: 'answer' | 'refusal'
    text: string
    placeIds: string[]
    questionId?: string
  } | null> => {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, language: lang, lat: center[1], lon: center[0] }),
    })
    if (!res.ok) return null
    return (await res.json()) as {
      kind: 'answer' | 'refusal'
      text: string
      placeIds: string[]
      questionId?: string
    }
  }

  const openWindow = (url: string) => window.open(url, '_blank', 'noopener')
  const waShare = (text: string) => openWindow(`https://wa.me/?text=${encodeURIComponent(text)}`)

  const sharePlace = (p: ApiPlace) =>
    waShare(
      `${p.name} — ${t.shareVia}${p.spotter_name ? ` (${t.verifiedBy} ${p.spotter_name})` : ''}. ${APP_URL}`,
    )

  const directionsTo = (p: ApiPlace) =>
    openWindow(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`)

  /** Prefill the Guaca tab with a question about this place — every tap is
   *  a demand signal for exactly this spot. */
  const askAboutPlace = (p: ApiPlace) => {
    setSelected(null)
    setGuacaText(t.askAboutPlace.replace('{name}', p.name))
    setActiveTab('guaca')
  }

  /** A doubt, not a review: creates re-check demand, publishes nothing. */
  const doubtPlace = (p: ApiPlace) => {
    if (doubted.has(p.id)) return
    setDoubted((prev) => new Set(prev).add(p.id))
    fetch(`/api/places/${p.id}/doubt`, { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  const notifyMe = (questionId: string) => {
    if (notified.has(questionId)) return
    setNotified((prev) => new Set(prev).add(questionId))
    fetch(`/api/questions/${questionId}/notify`, { method: 'POST', credentials: 'include' }).catch(
      () => {},
    )
  }

  const addToPlan = (id: string) => {
    setPlan((prev) => {
      const next: SavedPlan = prev
        ? prev.placeIds.includes(id)
          ? prev
          : { ...prev, placeIds: [...prev.placeIds, id] }
        : { question: '', text: '', placeIds: [id], savedAt: new Date().toISOString() }
      saveJson(PLAN_KEY, next)
      return next
    })
  }

  const removeStop = (id: string) => {
    setPlan((prev) => {
      if (!prev) return prev
      const ids = prev.placeIds.filter((x) => x !== id)
      if (ids.length === 0) {
        try { localStorage.removeItem(PLAN_KEY) } catch { /* best-effort */ }
        return null
      }
      const next = { ...prev, placeIds: ids }
      saveJson(PLAN_KEY, next)
      return next
    })
  }

  const toggleFavorite = (p: ApiPlace) => {
    const saved = favIds.has(p.id)
    setFavorites((prev) =>
      saved
        ? prev.filter((f) => f.placeId !== p.id)
        : [{ placeId: p.id, name: p.name, category: p.category, lat: p.lat, lon: p.lon }, ...prev],
    )
    fetch(`/api/places/${p.id}/favorite`, {
      method: saved ? 'DELETE' : 'POST',
      credentials: 'include',
    }).catch(() => {})
  }

  const submitPost = async () => {
    if (!selected || postBusy || postText.trim().length === 0) return
    setPostBusy(true)
    setPostErr(false)
    try {
      const res = await fetch(`/api/places/${selected.id}/posts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: postText.trim(),
          ...(postLink.trim() ? { mediaUrl: postLink.trim() } : {}),
          ...(postRating > 0 ? { rating: postRating } : {}),
          ...(fix ? { lat: fix[1], lon: fix[0] } : {}),
        }),
      })
      if (!res.ok) {
        setPostErr(true)
        return
      }
      setPostText('')
      setPostLink('')
      setPostRating(0)
      const list = await fetch(`/api/places/${selected.id}/posts`, { credentials: 'include' })
      if (list.ok) setPosts(((await list.json()) as { posts: PlacePost[] }).posts)
    } catch {
      setPostErr(true)
    } finally {
      setPostBusy(false)
    }
  }

  const sharePlanWa = () => {
    if (!plan) return
    const stops = plan.placeIds.map((id) => placeById(id)?.name).filter(Boolean).join(' → ')
    waShare(`${t.planTitle}: ${stops} — ${t.shareVia}. ${APP_URL}`)
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
      bumpStats(body.kind === 'refusal')
      if (body.kind === 'answer') {
        setAskState({ kind: 'answer', text: body.text, placeIds: body.placeIds })
        savePlanFromAnswer(text, body.text, body.placeIds)
      } else {
        setAskState({
          kind: 'refusal',
          text: body.text,
          ...(body.questionId ? { questionId: body.questionId } : {}),
        })
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
    const userMsg: ChatMsg = { id: localId(), role: 'user', text }
    setThread((prev) => {
      const next = [...prev, userMsg]
      saveJson(THREAD_KEY, next)
      return next
    })
    let reply: ChatMsg
    try {
      const body = await askApi(text)
      if (!body) {
        reply = { id: localId(), role: 'guaca', kind: 'error', text: t.askError }
      } else {
        bumpStats(body.kind === 'refusal')
        reply = {
          id: localId(),
          role: 'guaca',
          kind: body.kind,
          text: body.text,
          placeIds: body.placeIds,
          ...(body.questionId ? { questionId: body.questionId } : {}),
        }
        if (body.kind === 'answer') savePlanFromAnswer(text, body.text, body.placeIds)
      }
    } catch {
      reply = { id: localId(), role: 'guaca', kind: 'error', text: t.askError }
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
        // Merge over what we knew: the detail route has no review stats.
        if (full) setSelected((prev) => (prev && prev.id === full.id ? { ...prev, ...full } : full))
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

  /** Flag a post — two reports auto-hide it and the operator reviews. */
  const reportPost = (postId: string) => {
    if (reported.has(postId)) return
    setReported((prev) => new Set(prev).add(postId))
    fetch(`/api/posts/${postId}/report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason: 'other' }),
    }).catch(() => {})
  }

  const cancelWatch = (questionId: string) => {
    setWatching((prev) => prev.filter((w) => w.questionId !== questionId))
    fetch(`/api/questions/${questionId}/notify`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {})
  }

  const linkVilla = async () => {
    const code = villaCode.trim()
    if (!code) return
    setVillaErr(false)
    try {
      const res = await fetch('/api/tourist/villa-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      if (!res.ok) return setVillaErr(true)
      const body = (await res.json()) as { propertyName: string }
      setMe((prev) => (prev ? { ...prev, propertyName: body.propertyName } : prev))
      setVillaCode('')
    } catch {
      setVillaErr(true)
    }
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
          dots={dots}
          heat={heat}
          selectedPinId={selected?.id ?? null}
          onPinClick={(id) => { setSelectedCandidate(null); openPlace(id) }}
          onDotClick={(id) => {
            const c = candidates.find((x) => x.id === id)
            if (c) { setSelected(null); setSelectedCandidate(c) }
          }}
          mapStyle="streets"
          center={center}
          zoom={13.4}
          fallbackImage="/assets/landing-caribbean-phone.jpg"
        />
      </div>
      {offline && (
        <p role="alert" className="absolute inset-x-4 top-[104px] z-[700] rounded-2xl bg-guaca-coral px-4 py-2.5 text-center text-[11px] font-black text-white shadow-lg">
          {t.offline}
        </p>
      )}

      {!geoAsked && (
        <div className="absolute inset-0 z-[900] flex items-end bg-guaca-ocean-deep/45 p-4">
          <div className="guaca-card w-full rounded-[30px] p-5">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[.1em] text-guaca-teal">
              <MapPin className="h-4 w-4" /> {t.geoTitle}
            </p>
            <p className="mt-2 text-[12px] font-semibold leading-relaxed text-guaca-ink/70">{t.geoBody}</p>
            <Button type="button" onClick={useMyLocation} className="mt-4 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark">
              {t.geoAllow}
            </Button>
            <button type="button" onClick={skipLocation} className="mt-2 w-full py-2 text-[11px] font-bold text-guaca-ink/45 underline-offset-2 hover:underline">
              {t.geoSkip}
            </button>
          </div>
        </div>
      )}

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
        {/* Category filter — browse without typing. */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setCatFilter(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black shadow-md backdrop-blur-md ${catFilter === null ? 'bg-guaca-ocean-deep text-white' : 'bg-guaca-sand-light/92 text-guaca-ink/70'}`}
          >
            {t.allCategories}
          </button>
          {Object.entries(CATEGORY_GLYPH).map(([key, glyph]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCatFilter((prev) => (prev === key ? null : key))}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black shadow-md backdrop-blur-md ${catFilter === key ? 'bg-guaca-ocean-deep text-white' : 'bg-guaca-sand-light/92 text-guaca-ink/70'}`}
            >
              {glyph.emoji} {t.categoryLabels[key] ?? key}
            </button>
          ))}
        </div>
      </div>

      {/* Place sheet — landmark first, the Spotter's face on the record. */}
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 z-[650]">
          <div className="guaca-card rounded-[30px] p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black leading-tight text-guaca-ink">{selected.name}</h3>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label={favIds.has(selected.id) ? t.favSaved : t.favSave}
                  aria-pressed={favIds.has(selected.id)}
                  onClick={() => toggleFavorite(selected)}
                  className={`grid h-8 w-8 place-items-center rounded-full ${favIds.has(selected.id) ? 'bg-guaca-coral/12 text-guaca-coral' : 'bg-guaca-ink/6 text-guaca-ink/60 hover:bg-guaca-ink/10'}`}
                >
                  <Heart className={`h-4 w-4 ${favIds.has(selected.id) ? 'fill-guaca-coral' : ''}`} />
                </button>
                <button type="button" aria-label={t.close} onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-full bg-guaca-ink/6 text-guaca-ink/60 hover:bg-guaca-ink/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {(selected.ratingCount ?? 0) > 0 && selected.avgRating != null && (
              <p className="mt-1 flex items-center gap-1 text-[12px] font-black text-guaca-mango-dark">
                <Star className="h-3.5 w-3.5 fill-guaca-mango text-guaca-mango" />
                {selected.avgRating.toFixed(1)}
                <span className="font-bold text-guaca-ink/40">({selected.ratingCount})</span>
              </p>
            )}
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
              <Avatar url={selected.spotter_photo_url} name={selected.spotter_name} className="h-10 w-10" textClassName="text-xs" />
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

            {/* Actions: navigate, ask, share, doubt — tourists can only
                ask and doubt; nothing here publishes content. */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" onClick={() => directionsTo(selected)} className="h-10 rounded-xl bg-guaca-teal text-[11px] font-black text-white hover:bg-guaca-teal-dark">
                <Navigation className="mr-1.5 h-3.5 w-3.5" /> {t.sheetDirections}
              </Button>
              <Button type="button" variant="ghost" onClick={() => askAboutPlace(selected)} className="h-10 rounded-xl bg-guaca-teal/8 text-[11px] font-black text-guaca-teal hover:bg-guaca-teal/15">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {t.sheetAsk}
              </Button>
              <Button type="button" variant="ghost" onClick={() => sharePlace(selected)} className="h-10 rounded-xl bg-guaca-ocean/8 text-[11px] font-black text-guaca-ocean hover:bg-guaca-ocean/15">
                <Share2 className="mr-1.5 h-3.5 w-3.5" /> {t.sheetShare}
              </Button>
              {doubted.has(selected.id) ? (
                <span className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-guaca-mango/15 px-2 text-[10px] font-black text-guaca-mango-dark">
                  <Check className="h-3.5 w-3.5" /> {t.sheetDoubtSent}
                </span>
              ) : (
                <Button type="button" variant="ghost" onClick={() => doubtPlace(selected)} className="h-10 rounded-xl bg-guaca-ink/5 text-[11px] font-black text-guaca-ink/60 hover:bg-guaca-ink/10">
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> {t.sheetDoubt}
                </Button>
              )}
            </div>

            {/* "What locals say" — commentary + social videos, spotters first. */}
            <button
              type="button"
              onClick={() => setPostsOpen((v) => !v)}
              aria-expanded={postsOpen}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-guaca-ink/4 px-3.5 py-2.5 text-[11px] font-black text-guaca-ink/70 hover:bg-guaca-ink/8"
            >
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-guaca-teal" /> {t.postsTitle}
                {posts.length > 0 && <span className="rounded-full bg-guaca-teal/10 px-1.5 py-0.5 text-[9px] text-guaca-teal">{posts.length}</span>}
              </span>
              <ArrowRight className={`h-3.5 w-3.5 transition-transform ${postsOpen ? 'rotate-90' : ''}`} />
            </button>

            {postsOpen && (
              <div className="mt-2">
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {posts.length === 0 && (
                    <p className="px-1 py-2 text-[11px] font-semibold text-guaca-ink/45">{t.postsEmpty}</p>
                  )}
                  {posts.map((p) => (
                    <div key={p.id} className="rounded-2xl bg-guaca-ink/4 p-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          url={p.author.photoUrl}
                          name={p.author.name ?? t.postsTraveler}
                          className="h-6 w-6"
                          textClassName="text-[9px]"
                          fallbackClassName={p.author.kind === 'spotter' ? 'bg-guaca-teal text-white' : 'bg-guaca-ink/30 text-white'}
                        />
                        <span className="truncate text-[11px] font-black text-guaca-ink">
                          {p.author.name ?? t.postsTraveler}
                        </span>
                        {p.author.kind === 'spotter' && (
                          <span className="flex items-center gap-0.5 rounded-full bg-guaca-teal/10 px-1.5 py-0.5 text-[8px] font-black text-guaca-teal">
                            <BadgeCheck className="h-2.5 w-2.5" /> Spotter · Lv{p.author.level}
                          </span>
                        )}
                        {p.visited && (
                          <span className="flex items-center gap-0.5 rounded-full bg-guaca-mango/15 px-1.5 py-0.5 text-[8px] font-black text-guaca-mango-dark">
                            <MapPin className="h-2.5 w-2.5" /> {t.postsVisited}
                          </span>
                        )}
                        {p.rating != null && (
                          <span className="ml-auto flex items-center gap-0.5 text-[9px] font-black text-guaca-mango-dark">
                            <Star className="h-3 w-3 fill-guaca-mango text-guaca-mango" /> {p.rating}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-guaca-ink/75">{p.body}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {p.mediaUrl && (
                          <a href={p.mediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-guaca-ocean-deep px-3 py-1.5 text-[9px] font-black text-white hover:bg-guaca-ocean">
                            ▶ {t.postsWatch} · {mediaPlatform(p.mediaUrl)}
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => reportPost(p.id)}
                          disabled={reported.has(p.id)}
                          className="ml-auto flex items-center gap-1 text-[9px] font-black text-guaca-ink/35 hover:text-guaca-coral-dark disabled:text-guaca-ink/25"
                        >
                          <Flag className="h-3 w-3" /> {reported.has(p.id) ? t.postsReported : t.postsReport}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 space-y-1.5 rounded-2xl bg-white p-2.5 ring-1 ring-guaca-sand">
                  <Input
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder={t.postsPlaceholder}
                    maxLength={500}
                    className="h-9 rounded-xl border-guaca-sand text-[12px]"
                  />
                  <Input
                    value={postLink}
                    onChange={(e) => setPostLink(e.target.value)}
                    placeholder={t.postsLinkPlaceholder}
                    className="h-9 rounded-xl border-guaca-sand text-[11px]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-0.5" title={t.postsRatingHint}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" aria-label={`${n}★`} onClick={() => setPostRating((r) => (r === n ? 0 : n))}>
                          <Star className={`h-4 w-4 ${n <= postRating ? 'fill-guaca-mango text-guaca-mango' : 'text-guaca-ink/25'}`} />
                        </button>
                      ))}
                    </div>
                    <Button type="button" onClick={() => void submitPost()} disabled={postBusy || postText.trim().length === 0} className="h-8 rounded-xl bg-guaca-teal px-4 text-[11px] font-black text-white hover:bg-guaca-teal-dark">
                      {t.postsSend}
                    </Button>
                  </div>
                  <p className="text-[9px] font-semibold text-guaca-ink/40">{postErr ? t.postsError : t.postsRatingHint}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Candidate card — an OSM dot: known to open data, unknown to us. */}
      {!selected && selectedCandidate && (
        <div className="absolute bottom-4 left-4 right-4 z-[650]">
          <div className="guaca-card rounded-[30px] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black leading-tight text-guaca-ink">
                  {(CATEGORY_GLYPH[selectedCandidate.category] ?? { emoji: '📍' }).emoji} {selectedCandidate.name}
                </h3>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-guaca-ink/6 px-2 py-0.5 text-[9px] font-black uppercase tracking-[.1em] text-guaca-ink/55">
                  {t.candidateTitle}
                </p>
              </div>
              <button type="button" aria-label={t.close} onClick={() => setSelectedCandidate(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-guaca-ink/6 text-guaca-ink/60 hover:bg-guaca-ink/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-guaca-ink/60">{t.candidateBody}</p>
            <Button
              type="button"
              onClick={() => {
                setGuacaText(t.candidateAsk.replace('{name}', selectedCandidate.name))
                setSelectedCandidate(null)
                setActiveTab('guaca')
              }}
              className="mt-3 h-10 w-full rounded-xl bg-guaca-teal text-[11px] font-black text-white hover:bg-guaca-teal-dark"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {t.candidateCta}
            </Button>
          </div>
        </div>
      )}

      {/* Ask result / teaser card. */}
      {!selected && !selectedCandidate && (
        <div className="absolute bottom-4 left-4 right-4 z-[650]">
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
              {askState.questionId && (
                notified.has(askState.questionId) ? (
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] font-black text-guaca-mango-light">
                    <Check className="h-3.5 w-3.5" /> {t.refusalNotifySaved}
                  </p>
                ) : (
                  <Button type="button" onClick={() => notifyMe(askState.questionId!)} className="mt-3 h-10 w-full rounded-xl bg-guaca-mango text-[11px] font-black text-guaca-ocean-deep hover:bg-guaca-mango-light">
                    <Bell className="mr-1.5 h-3.5 w-3.5" /> {t.refusalNotify}
                  </Button>
                )
              )}
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
                {m.questionId && (
                  notified.has(m.questionId) ? (
                    <p className="mt-2.5 flex items-center gap-1.5 text-[10px] font-black text-guaca-mango-light">
                      <Check className="h-3 w-3" /> {t.refusalNotifySaved}
                    </p>
                  ) : (
                    <button type="button" onClick={() => notifyMe(m.questionId!)} className="mt-2.5 flex items-center gap-1.5 rounded-full bg-guaca-mango px-3 py-2 text-[10px] font-black text-guaca-ocean-deep hover:bg-guaca-mango-light">
                      <Bell className="h-3 w-3" /> {t.refusalNotify}
                    </button>
                  )
                )}
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
                      const inPlan = plan?.placeIds.includes(id) ?? false
                      return (
                        <span key={id} className="inline-flex items-stretch overflow-hidden rounded-full bg-guaca-teal/8">
                          <button type="button" onClick={() => openPlaceOnMap(id)} className="px-3 py-1.5 text-[10px] font-black text-guaca-teal hover:bg-guaca-teal/15">
                            {(CATEGORY_GLYPH[p.category] ?? { emoji: '📍' }).emoji} {p.name}
                          </button>
                          <button
                            type="button"
                            aria-label={inPlan ? t.addedToPlan : t.addToPlan}
                            title={inPlan ? t.addedToPlan : t.addToPlan}
                            onClick={() => (inPlan ? removeStop(id) : addToPlan(id))}
                            className="border-l border-guaca-teal/15 px-2 text-guaca-teal hover:bg-guaca-teal/15"
                          >
                            {inPlan ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          </button>
                        </span>
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
        className="shrink-0 px-4 pb-4"
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
    <div className="h-full overflow-y-auto bg-guaca-sand-light px-5 pb-8 pt-12">
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
                  <button
                    type="button"
                    aria-label={t.removeStop}
                    title={t.removeStop}
                    onClick={() => removeStop(id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-guaca-ink/5 text-guaca-ink/45 hover:bg-guaca-coral/12 hover:text-guaca-coral-dark"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          <Button type="button" onClick={sharePlanWa} className="mt-4 h-11 w-full rounded-2xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark">
            <Share2 className="mr-1.5 h-4 w-4" /> {t.sharePlan}
          </Button>

          <button
            type="button"
            onClick={() => { setPlan(null); localStorage.removeItem(PLAN_KEY) }}
            className="mx-auto mt-4 block text-[10px] font-bold text-guaca-ink/38 underline-offset-2 hover:underline"
          >
            {t.planClear}
          </button>
        </>
      )}

      {/* Saved places — the ♥ list, private to this account. */}
      <div className="mt-6">
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">
          <Heart className="h-3.5 w-3.5 text-guaca-coral" /> {t.favTitle}
        </p>
        {favorites.length === 0 ? (
          <p className="mt-2 rounded-[24px] border border-dashed border-guaca-sand bg-white/60 px-4 py-4 text-center text-[11px] font-semibold text-guaca-ink/45">{t.favEmpty}</p>
        ) : (
          <div className="mt-2 space-y-2">
            {favorites.map((f) => {
              const glyph = CATEGORY_GLYPH[f.category] ?? { emoji: '📍', color: '#0D8B8B' }
              return (
                <div key={f.placeId} className="flex items-center gap-3 rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-guaca-sand/75">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base" style={{ backgroundColor: `${glyph.color}18` }}>{glyph.emoji}</span>
                  <p className="min-w-0 flex-1 truncate text-[13px] font-black text-guaca-ink">{f.name}</p>
                  <button type="button" onClick={() => openPlaceOnMap(f.placeId)} className="shrink-0 rounded-full bg-guaca-teal/8 px-3 py-2 text-[10px] font-black text-guaca-teal hover:bg-guaca-teal/15">
                    {t.planViewOnMap}
                  </button>
                  <button
                    type="button"
                    aria-label={t.favSaved}
                    onClick={() => toggleFavorite({ id: f.placeId, name: f.name, category: f.category, lat: f.lat, lon: f.lon } as ApiPlace)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-guaca-coral/10 text-guaca-coral hover:bg-guaca-coral/20"
                  >
                    <Heart className="h-3.5 w-3.5 fill-guaca-coral" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const renderProfile = () => (
    <div className="h-full overflow-y-auto bg-guaca-sand-light px-5 pb-8 pt-12">
      <div className="rounded-[32px] bg-white p-6 text-center shadow-sm ring-1 ring-guaca-sand/75">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-guaca-teal text-2xl font-black text-white">
          {(me?.email?.[0] ?? '·').toUpperCase()}
        </span>
        <h2 className="mt-3 truncate text-[15px] font-black text-guaca-ink">{me?.email ?? '…'}</h2>
        {me?.propertyName && (
          <p className="mt-1 text-[11px] font-bold text-guaca-teal">{t.profileGuestOf} {me.propertyName}</p>
        )}
      </div>

      {/* Impact — the loop, made personal. */}
      <div className="mt-4 rounded-[28px] bg-gradient-to-br from-guaca-ocean to-guaca-ocean-deep p-5 text-white shadow-lg">
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/75">{t.impactTitle}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <p className="text-xl font-black">{stats.asked}</p>
            <p className="mt-0.5 text-[9px] font-bold leading-tight text-white/70">{t.impactAsked}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <p className="text-xl font-black text-guaca-mango-light">{stats.commissioned}</p>
            <p className="mt-0.5 text-[9px] font-bold leading-tight text-white/70">{t.impactCommissioned}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <p className="text-xl font-black text-guaca-mango-light">{fulfilled}</p>
            <p className="mt-0.5 text-[9px] font-bold leading-tight text-white/70">{t.impactVerified}</p>
          </div>
        </div>
        <p className="mt-2.5 text-[9px] font-semibold leading-relaxed text-white/55">{t.impactNote}</p>
      </div>

      {/* Watches — questions a local is going out to answer. */}
      <div className="mt-4">
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">
          <Bell className="h-3.5 w-3.5 text-guaca-mango-dark" /> {t.watchingTitle}
        </p>
        {watching.length === 0 ? (
          <p className="mt-2 rounded-[24px] border border-dashed border-guaca-sand bg-white/60 px-4 py-4 text-center text-[11px] font-semibold text-guaca-ink/45">{t.watchingEmpty}</p>
        ) : (
          <div className="mt-2 space-y-2">
            {watching.map((w) => (
              <div key={w.questionId} className="flex items-center gap-3 rounded-[24px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-guaca-mango/15 text-guaca-mango-dark">
                  <Clock3 className="h-4 w-4" />
                </span>
                <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-guaca-ink">{w.text}</p>
                <button type="button" onClick={() => cancelWatch(w.questionId)} className="shrink-0 rounded-full bg-guaca-ink/5 px-3 py-1.5 text-[9px] font-black text-guaca-ink/50 hover:bg-guaca-ink/10">
                  {t.watchingCancel}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Their own posts — the travel passport. */}
      <div className="mt-4">
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">
          <MessageCircle className="h-3.5 w-3.5 text-guaca-teal" /> {t.myPostsTitle}
        </p>
        {myPosts.length === 0 ? (
          <p className="mt-2 rounded-[24px] border border-dashed border-guaca-sand bg-white/60 px-4 py-4 text-center text-[11px] font-semibold text-guaca-ink/45">{t.myPostsEmpty}</p>
        ) : (
          <div className="mt-2 space-y-2">
            {myPosts.map((p) => (
              <button key={p.id} type="button" onClick={() => openPlaceOnMap(p.place_id)} className="flex w-full items-center gap-3 rounded-[24px] bg-white p-3.5 text-left shadow-sm ring-1 ring-guaca-sand/75 hover:bg-guaca-sand/20">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-guaca-teal/10 text-base">
                  {(CATEGORY_GLYPH[p.category] ?? { emoji: '📍' }).emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-black text-guaca-ink">{p.place_name}</span>
                    {p.visited && <MapPin className="h-3 w-3 shrink-0 text-guaca-mango-dark" />}
                    {p.rating != null && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-black text-guaca-mango-dark">
                        <Star className="h-3 w-3 fill-guaca-mango text-guaca-mango" />{p.rating}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold text-guaca-ink/50">{p.body}</span>
                </span>
              </button>
            ))}
          </div>
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

      {/* Link a stay after the fact — for guests who never scanned the QR. */}
      {!me?.propertyName && (
        <div className="mt-4 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
          <label htmlFor="villa-code" className="block text-[11px] font-black text-guaca-ink/70">
            {t.villaCodeLabel}
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="villa-code"
              value={villaCode}
              onChange={(e) => setVillaCode(e.target.value)}
              placeholder="qr-XXXXXXXX"
              className="h-10 flex-1 rounded-xl border-guaca-sand text-[12px]"
            />
            <Button type="button" onClick={() => void linkVilla()} disabled={!villaCode.trim()} className="h-10 rounded-xl bg-guaca-teal px-4 text-[11px] font-black text-white hover:bg-guaca-teal-dark">
              {t.villaCodeCta}
            </Button>
          </div>
          {villaErr && <p className="mt-2 text-[10px] font-bold text-guaca-coral-dark">{t.villaCodeBad}</p>}
        </div>
      )}

      {/* Legal — Play requires a reachable privacy policy. */}
      <div className="mt-5 flex items-center justify-center gap-4 text-[11px] font-bold text-guaca-ink/45">
        <a href={`${LANDING_URL}/privacy`} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          {t.legalPrivacy}
        </a>
        <span aria-hidden="true">·</span>
        <a href={`${LANDING_URL}/terms`} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          {t.legalTerms}
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
    <div className="h-full overflow-y-auto bg-guaca-sand-light px-5 pb-8 pt-14">
      <div className="rounded-[32px] bg-gradient-to-br from-guaca-teal to-guaca-ocean p-6 text-white shadow-xl shadow-guaca-teal/18">
        <GuacaMark className="h-12 w-auto" />
        <h1 className="mt-3 text-3xl font-black tracking-[-.04em]">{t.updatesTitle}</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-white/88">{t.updatesLede}</p>
      </div>

      <div className="relative mt-5">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-guaca-teal" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.updatesSearch} className="h-12 rounded-2xl border-guaca-sand bg-white pl-11 focus-visible:ring-guaca-teal" />
      </div>

      {filteredUpdates.length === 0 ? (
        <div className="mt-4 rounded-[28px] border border-dashed border-guaca-teal/28 bg-white/60 p-6 text-center">
          <Store aria-hidden="true" className="mx-auto h-8 w-8 text-guaca-teal/55" />
          <h3 className="mt-4 text-[13px] font-black text-guaca-ink">{updates.length === 0 ? t.updatesEmpty : t.updatesEmptySearch}</h3>
          <p className="mx-auto mt-2 max-w-[260px] text-[11px] font-semibold leading-relaxed text-guaca-ink/48">{t.updatesLede}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredUpdates.map((update) => (
            <article key={update.id} className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-guaca-teal/8 px-2.5 py-1 text-[9px] font-black text-guaca-teal">{update.category}</span>
                <span className={`flex items-center gap-1 text-[9px] font-black ${update.status === 'verified' ? 'text-emerald-700' : 'text-guaca-ink/42'}`}>
                  {update.status === 'verified' ? <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />}
                  {update.status === 'verified' ? `${t.updatesVerifiedBy} ${update.verifiedBy}` : t.updatesPublished}
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
    <div className="relative flex h-screen flex-col overflow-hidden bg-guaca-paper sm:h-full">
      {/* min-h-0 lets this region scroll instead of growing the page and
          pushing the tab bar past the fold. */}
      <div className="relative min-h-0 flex-1">{tabScreens[activeTab]()}</div>
      <div className="z-[500] shrink-0 border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-4 pb-5 pt-2 backdrop-blur-md">
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
