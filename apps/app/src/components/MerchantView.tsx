import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, BedDouble, CalendarDays, ClipboardList, Eye, LogOut } from 'lucide-react'
import { Button, GuacaLogo, Input, Textarea, useLanguage, type Lang } from '@guaca/ui'
import type { ObservationKindType, Reservation, Stay } from '@guaca/shared'
import { appCopy } from '../lib/copy'
import { VENUE_TZ } from '../lib/scenarioActors'
import { MobileViewport } from './MobileViewport'
import { RailArt } from './RailArt'

type Tab = 'today' | 'reservations' | 'place' | 'visibility'

interface MerchantMe {
  id: string
  email?: string
  name: string
  language?: string
}

interface MerchantLicense {
  id: string
  status: 'active' | 'expired' | 'revoked' | string
  visibility: 'standard' | 'promoted' | string
  labelEn: string
  labelEs: string
  startsAt?: string | null
  endsAt?: string | null
}

interface InventoryNight {
  nightDate: string
  allotment: number
  reservedCount: number
}

interface StayBundle {
  stay: Stay
  placeName: string
  inventory: InventoryNight[]
}

interface InboxRow extends Reservation {
  touristName?: string | null
  placeName?: string | null
}

const AMENITY_KEYS = [
  'fan',
  'shared_courtyard',
  'hammocks',
  'wifi',
  'ac',
  'breakfast',
  'courtyard',
  'pool',
  'ocean_view',
  'rooftop',
] as const

const OBSERVATION_KINDS: ObservationKindType[] = ['schedule', 'access', 'service', 'condition']

function guard401(r: Response): Response {
  if (r.status === 401) {
    window.location.reload()
    throw new Error('session expired')
  }
  return r
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStay(raw: Record<string, unknown>): Stay | null {
  const id = asString(raw.id)
  const placeId = asString(raw.placeId ?? raw.place_id)
  if (!id || !placeId) return null
  const merchant = raw.merchantId ?? raw.merchant_id
  return {
    id,
    placeId,
    merchantId: merchant == null ? null : String(merchant),
    roomTypeEn: asString(raw.roomTypeEn ?? raw.room_type_en) || 'Room',
    roomTypeEs: asString(raw.roomTypeEs ?? raw.room_type_es) || 'Habitación',
    amenities: Array.isArray(raw.amenities) ? raw.amenities.map(String) : [],
    currency: asString(raw.currency) || 'USD',
    nightlyPriceMinor: Number(raw.nightlyPriceMinor ?? raw.nightly_price_minor ?? 0),
    guestsMax: Number(raw.guestsMax ?? raw.guests_max ?? 1),
    timezone: asString(raw.timezone) || VENUE_TZ,
  }
}

function asReservation(raw: Record<string, unknown>): InboxRow | null {
  if (raw.reservation && typeof raw.reservation === 'object' && !Array.isArray(raw.reservation)) {
    raw = raw.reservation as Record<string, unknown>
  }
  const id = asString(raw.id)
  if (!id) return null
  return {
    id,
    stayId: asString(raw.stayId ?? raw.stay_id),
    merchantId: asString(raw.merchantId ?? raw.merchant_id),
    touristId: asString(raw.touristId ?? raw.tourist_id),
    checkIn: asString(raw.checkIn ?? raw.check_in),
    checkOut: asString(raw.checkOut ?? raw.check_out),
    guests: Number(raw.guests ?? 1),
    nightlyPriceMinor: Number(raw.nightlyPriceMinor ?? raw.nightly_price_minor ?? 0),
    currency: asString(raw.currency) || 'USD',
    status: asString(raw.status) as Reservation['status'],
    referenceCode: asString(raw.referenceCode ?? raw.reference_code),
    holdExpiresAt: raw.holdExpiresAt == null && raw.hold_expires_at == null
      ? null
      : String(raw.holdExpiresAt ?? raw.hold_expires_at),
    note: raw.note == null ? null : String(raw.note),
    touristName: (raw.touristName ?? raw.tourist_name ?? null) as string | null,
    placeName: (raw.placeName ?? raw.place_name ?? null) as string | null,
  }
}

function asLicense(raw: Record<string, unknown>): MerchantLicense | null {
  const id = asString(raw.id)
  if (!id) return null
  return {
    id,
    status: asString(raw.status) || 'active',
    visibility: asString(raw.visibility) || 'standard',
    labelEn: asString(raw.labelEn ?? raw.label_en),
    labelEs: asString(raw.labelEs ?? raw.label_es),
    startsAt: raw.startsAt == null && raw.starts_at == null ? null : String(raw.startsAt ?? raw.starts_at),
    endsAt: raw.endsAt == null && raw.ends_at == null ? null : String(raw.endsAt ?? raw.ends_at),
  }
}

function nightCount(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`)
  const b = Date.parse(`${checkOut}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1
  return Math.round((b - a) / 86_400_000)
}

function money(minor: number, currency: string, lang: Lang): string {
  try {
    return new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(0)} ${currency}`
  }
}

function formatInstant(value: string | null | undefined, lang: Lang): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: VENUE_TZ,
  }).format(d)
}

function formatDay(value: string, lang: Lang): string {
  const d = new Date(`${value}T12:00:00-05:00`)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
    dateStyle: 'medium',
    timeZone: VENUE_TZ,
  }).format(d)
}

export function MerchantView() {
  const { lang, setLang } = useLanguage()
  const t = appCopy[lang].merchant
  const [tab, setTab] = useState<Tab>('today')
  const [me, setMe] = useState<MerchantMe | null>(null)
  const [stay, setStay] = useState<StayBundle | null>(null)
  const [reservations, setReservations] = useState<InboxRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [license, setLicense] = useState<MerchantLicense | null>(null)
  const [banner, setBanner] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [roomEn, setRoomEn] = useState('')
  const [roomEs, setRoomEs] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [obsKind, setObsKind] = useState<ObservationKindType>('schedule')
  const [obsEn, setObsEn] = useState('')
  const [obsEs, setObsEs] = useState('')
  const [declineReason, setDeclineReason] = useState('')

  const selected = reservations.find((r) => r.id === selectedId) ?? reservations[0] ?? null
  const pendingCount = reservations.filter((r) => r.status === 'requested').length

  const loadMe = useCallback(() => {
    fetch('/api/merchant/me', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Record<string, unknown> | null) => {
        if (!d) return
        if (d.merchant && typeof d.merchant === 'object' && !Array.isArray(d.merchant)) {
          d = d.merchant as Record<string, unknown>
        }
        setMe({
          id: asString(d.id),
          email: asString(d.email) || undefined,
          name: asString(d.name) || 'Host',
          language: asString(d.language) || undefined,
        })
        if (d.language === 'en' || d.language === 'es') {
          if (!localStorage.getItem('guaca-lang')) setLang(d.language)
        }
      })
      .catch((e) => {
        if (!String(e).includes('session')) setLoadError(true)
      })
  }, [setLang])

  const loadStay = useCallback(() => {
    fetch('/api/merchant/stay', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Record<string, unknown> | null) => {
        if (!d) return
        const stayRaw = (d.stay ?? d) as Record<string, unknown>
        const parsed = asStay(stayRaw)
        if (!parsed) return
        const place = (d.place ?? stayRaw.place) as Record<string, unknown> | undefined
        const inventoryRaw = (d.inventory ?? stayRaw.inventory ?? []) as unknown[]
        const inventory: InventoryNight[] = inventoryRaw.map((row) => {
          const rec = (row ?? {}) as Record<string, unknown>
          return {
            nightDate: asString(rec.nightDate ?? rec.night_date ?? rec.date),
            allotment: Number(rec.allotment ?? 0),
            reservedCount: Number(rec.reservedCount ?? rec.reserved_count ?? 0),
          }
        }).filter((n) => n.nightDate)
        setStay({
          stay: parsed,
          placeName: asString(place?.name) || asString(d.placeName) || 'Casa del Baluarte',
          inventory,
        })
        setRoomEn(parsed.roomTypeEn)
        setRoomEs(parsed.roomTypeEs)
        setAmenities(parsed.amenities)
      })
      .catch((e) => {
        if (!String(e).includes('session')) setLoadError(true)
      })
  }, [])

  const loadReservations = useCallback(() => {
    fetch('/api/merchant/reservations', { credentials: 'include' })
      .then(guard401)
      .then((r) => {
        if (!r.ok) throw new Error('reservations failed')
        return r.json()
      })
      .then((d: { reservations?: unknown[] }) => {
        const rows = (d.reservations ?? [])
          .map((row) => asReservation((row ?? {}) as Record<string, unknown>))
          .filter((row): row is InboxRow => row !== null)
        setReservations(rows)
        setLoadError(false)
      })
      .catch((e) => {
        if (String(e).includes('session')) return
        setLoadError(true)
      })
  }, [])

  const loadLicense = useCallback(() => {
    fetch('/api/merchant/license', { credentials: 'include' })
      .then(guard401)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Record<string, unknown> | null) => {
        if (!d) return
        const raw = (d.license ?? d) as Record<string, unknown>
        const parsed = asLicense(raw)
        if (parsed) setLicense(parsed)
      })
      .catch((e) => {
        if (!String(e).includes('session')) setLoadError(true)
      })
  }, [])

  useEffect(() => {
    loadMe()
    loadStay()
    loadReservations()
    loadLicense()
  }, [loadMe, loadStay, loadReservations, loadLicense])

  useEffect(() => {
    if (tab !== 'today' && tab !== 'reservations') return
    const id = window.setInterval(loadReservations, 3000)
    return () => window.clearInterval(id)
  }, [tab, loadReservations])

  const statusLabel: Record<string, string> = {
    requested: t.awaitingConfirmation,
    confirmed: t.statusConfirmed,
    declined: t.statusDeclined,
    expired: t.statusExpired,
    cancelled: t.statusCancelled,
    completed: t.statusCompleted,
  }

  const act = async (id: string, kind: 'confirm' | 'decline') => {
    if (busy) return
    setBusy(true)
    setBanner(null)
    try {
      const res = guard401(
        await fetch(`/api/merchant/reservations/${id}/${kind}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(kind === 'decline' ? { reason: declineReason || undefined } : {}),
        }),
      )
      if (res.ok) {
        setBanner({ kind: 'info', text: kind === 'confirm' ? t.confirmed : t.declined })
        setDeclineReason('')
        loadReservations()
      } else setBanner({ kind: 'error', text: t.error })
    } catch (e) {
      if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.error })
    } finally {
      setBusy(false)
    }
  }

  const savePlace = async () => {
    if (busy) return
    setBusy(true)
    setBanner(null)
    try {
      const res = guard401(
        await fetch('/api/merchant/stay', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            roomTypeEn: roomEn,
            roomTypeEs: roomEs,
            amenities,
          }),
        }),
      )
      if (res.ok) {
        setBanner({ kind: 'info', text: t.saved })
        loadStay()
      } else setBanner({ kind: 'error', text: t.error })
    } catch (e) {
      if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.error })
    } finally {
      setBusy(false)
    }
  }

  const publishUpdate = async () => {
    if (busy || !obsEn.trim() || !obsEs.trim()) return
    setBusy(true)
    setBanner(null)
    try {
      const res = guard401(
        await fetch('/api/merchant/stay/observations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            kind: obsKind,
            statementEn: obsEn.trim(),
            statementEs: obsEs.trim(),
          }),
        }),
      )
      if (res.ok) {
        setBanner({ kind: 'info', text: t.published })
        setObsEn('')
        setObsEs('')
      } else setBanner({ kind: 'error', text: t.error })
    } catch (e) {
      if (!String(e).includes('session')) setBanner({ kind: 'error', text: t.error })
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Tab, string> = {
    today: t.todayTitle,
    reservations: t.reservationsTitle,
    place: t.placeTitle,
    visibility: t.visibilityTitle,
  }

  const kindLabel: Record<ObservationKindType, string> = {
    schedule: t.kindSchedule,
    access: t.kindAccess,
    service: t.kindService,
    condition: t.kindCondition,
  }

  return (
    <MobileViewport className="relative flex h-dvh flex-col overflow-hidden bg-guaca-paper lg:flex-row">
      <div className="relative min-h-0 flex-1 lg:order-2">
        <div className="h-full overflow-y-auto px-5 pb-8 pt-12 lg:px-[max(1.25rem,calc((100%-44rem)/2))]">
          <div className="rounded-[32px] bg-gradient-to-br from-guaca-ocean-deep to-guaca-ocean p-6 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <GuacaLogo variant="reversed" className="h-10" />
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black tracking-[.08em]">HOST</span>
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-[-.03em]">{titles[tab]}</h1>
            <p className="mt-2 text-sm font-semibold text-white/85">{me?.name ?? t.loading}</p>
            {stay && <p className="mt-1 text-[12px] font-bold text-white/70">{stay.placeName}</p>}
          </div>

          {banner && (
            <p
              role={banner.kind === 'error' ? 'alert' : 'status'}
              className={`mt-4 rounded-2xl px-4 py-3 text-xs font-bold ${
                banner.kind === 'error' ? 'bg-guaca-coral/10 text-guaca-coral-dark' : 'bg-guaca-ocean/10 text-guaca-ocean-deep'
              }`}
            >
              {banner.text}
            </p>
          )}
          {loadError && (
            <button
              type="button"
              onClick={() => { setLoadError(false); loadMe(); loadStay(); loadReservations(); loadLicense() }}
              className="mt-3 h-11 w-full rounded-xl bg-guaca-ocean/10 text-xs font-black text-guaca-ocean-deep"
            >
              {t.retry}
            </button>
          )}

          {tab === 'today' && (
            <div className="mt-5 space-y-3">
              <p className="text-[13px] font-semibold leading-relaxed text-guaca-ink/65">{t.todayLede}</p>
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                {pendingCount > 0 ? (
                  <>
                    <p className="text-[15px] font-black text-guaca-ocean-deep">{t.todayPending(pendingCount)}</p>
                    <Button
                      type="button"
                      onClick={() => setTab('reservations')}
                      className="mt-4 h-11 w-full rounded-xl bg-guaca-ocean text-xs font-black text-white hover:bg-guaca-ocean-deep"
                    >
                      {t.todayOpenInbox}
                    </Button>
                  </>
                ) : (
                  <p className="text-[13px] font-semibold leading-relaxed text-guaca-ink/60">{t.todayEmpty}</p>
                )}
              </article>
              {stay && (
                <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                  <p className="text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/45">{t.noPayment}</p>
                  <p className="mt-2 text-[15px] font-black text-guaca-ink">
                    {lang === 'es' ? stay.stay.roomTypeEs : stay.stay.roomTypeEn}
                  </p>
                  <p className="mt-1 text-[12px] font-bold text-guaca-ocean-deep">
                    {money(stay.stay.nightlyPriceMinor, stay.stay.currency, lang)}
                  </p>
                  {stay.inventory.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-[11px] font-semibold text-guaca-ink/60">
                      {stay.inventory.slice(0, 8).map((n) => (
                        <li key={n.nightDate} className="flex justify-between">
                          <span>{formatDay(n.nightDate, lang)}</span>
                          <span>{`${n.reservedCount}/${n.allotment}`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              )}
            </div>
          )}

          {tab === 'reservations' && (
            <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-4">
              <div className="space-y-3">
                <p className="text-[13px] font-semibold leading-relaxed text-guaca-ink/65">{t.reservationsLede}</p>
                {reservations.length === 0 && (
                  <p className="rounded-[28px] border border-dashed border-guaca-ocean/25 bg-white/70 p-6 text-center text-[12px] font-semibold text-guaca-ink/55">
                    {t.reservationsEmpty}
                  </p>
                )}
                {reservations.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full rounded-[24px] p-4 text-left shadow-sm ring-1 ${
                      selected?.id === row.id ? 'bg-guaca-ocean/8 ring-guaca-ocean/30' : 'bg-white ring-guaca-sand/75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-black text-guaca-ink">{row.touristName ?? t.requestStay}</span>
                      <span className="text-[10px] font-black text-guaca-ocean-deep">{statusLabel[row.status] ?? row.status}</span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-guaca-ink/55">
                      {formatDay(row.checkIn, lang)} → {formatDay(row.checkOut, lang)}
                    </p>
                  </button>
                ))}
              </div>
              {selected && (
                <article className="mt-4 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75 lg:mt-0">
                  <p className="text-[10px] font-black uppercase tracking-[.1em] text-guaca-ocean-deep">
                    {selected.status === 'requested' ? t.awaitingConfirmation : statusLabel[selected.status]}
                  </p>
                  <h2 className="mt-2 text-[18px] font-black text-guaca-ink">{selected.placeName ?? stay?.placeName ?? t.requestStay}</h2>
                  <dl className="mt-3 space-y-1.5 text-[12px] font-semibold text-guaca-ink/70">
                    <div className="flex justify-between gap-3"><dt>{t.nights}</dt><dd>{nightCount(selected.checkIn, selected.checkOut)}</dd></div>
                    <div className="flex justify-between gap-3"><dt>{t.guests}</dt><dd>{selected.guests}</dd></div>
                    <div className="flex justify-between gap-3"><dt>{t.reference}</dt><dd className="font-black">{selected.referenceCode || '—'}</dd></div>
                    {selected.holdExpiresAt && selected.status === 'requested' && (
                      <div className="flex justify-between gap-3"><dt>{t.holdUntil}</dt><dd>{formatInstant(selected.holdExpiresAt, lang)}</dd></div>
                    )}
                  </dl>
                  <p className="mt-3 text-[12px] font-bold text-guaca-ocean-deep">
                    {money(selected.nightlyPriceMinor, selected.currency, lang)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-guaca-ink/45">{t.noPayment}</p>
                  {selected.note && (
                    <p className="mt-3 rounded-2xl bg-guaca-paper px-3 py-2 text-[12px] font-semibold text-guaca-ink/70">
                      {t.note}: {selected.note}
                    </p>
                  )}
                  {selected.status === 'requested' && (
                    <div className="mt-4 space-y-2">
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(selected.id, 'confirm')}
                        className="h-11 w-full rounded-xl bg-guaca-ocean text-xs font-black text-white hover:bg-guaca-ocean-deep disabled:opacity-60"
                      >
                        <BadgeCheck className="mr-1.5 h-4 w-4" /> {t.confirmCta}
                      </Button>
                      <label className="block text-[11px] font-black text-guaca-ink/50" htmlFor="decline-reason">{t.declineReason}</label>
                      <Input
                        id="decline-reason"
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder={t.declineReasonPlaceholder}
                        className="bg-white"
                      />
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(selected.id, 'decline')}
                        className="h-11 w-full rounded-xl bg-guaca-coral/10 text-xs font-black text-guaca-coral-dark hover:bg-guaca-coral/20 disabled:opacity-60"
                      >
                        {t.declineCta}
                      </Button>
                    </div>
                  )}
                </article>
              )}
            </div>
          )}

          {tab === 'place' && (
            <div className="mt-5 space-y-4">
              <p className="text-[13px] font-semibold leading-relaxed text-guaca-ink/65">{t.placeLede}</p>
              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                <label className="text-xs font-black text-guaca-ink/70" htmlFor="room-en">{t.roomTypeEn}</label>
                <Input id="room-en" value={roomEn} onChange={(e) => setRoomEn(e.target.value)} className="mt-1 bg-white" />
                <label className="mt-3 block text-xs font-black text-guaca-ink/70" htmlFor="room-es">{t.roomTypeEs}</label>
                <Input id="room-es" value={roomEs} onChange={(e) => setRoomEs(e.target.value)} className="mt-1 bg-white" />
                <p className="mt-3 text-xs font-black text-guaca-ink/70">{t.amenities}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AMENITY_KEYS.map((key) => {
                    const on = amenities.includes(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setAmenities((prev) => (on ? prev.filter((a) => a !== key) : [...prev, key]))}
                        className={`min-h-11 rounded-full px-3 text-[11px] font-black ${on ? 'bg-guaca-ocean text-white' : 'bg-guaca-ink/6 text-guaca-ink/60'}`}
                      >
                        {t.amenityLabels[key] ?? key}
                      </button>
                    )
                  })}
                </div>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void savePlace()}
                  className="mt-4 h-11 w-full rounded-xl bg-guaca-ocean text-xs font-black text-white hover:bg-guaca-ocean-deep disabled:opacity-60"
                >
                  {busy ? t.saving : t.savePlace}
                </Button>
              </div>

              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                <h2 className="text-[15px] font-black text-guaca-ink">{t.publishTitle}</h2>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-guaca-ink/55">{t.publishLede}</p>
                <p className="mt-3 text-xs font-black text-guaca-ink/70">{t.publishKind}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OBSERVATION_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={obsKind === kind}
                      onClick={() => setObsKind(kind)}
                      className={`min-h-11 rounded-full px-3 text-[11px] font-black ${obsKind === kind ? 'bg-guaca-ocean text-white' : 'bg-guaca-ink/6 text-guaca-ink/60'}`}
                    >
                      {kindLabel[kind]}
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-xs font-black text-guaca-ink/70" htmlFor="obs-en">{t.publishEn}</label>
                <Textarea id="obs-en" value={obsEn} onChange={(e) => setObsEn(e.target.value)} className="mt-1 min-h-24 bg-white" />
                <label className="mt-3 block text-xs font-black text-guaca-ink/70" htmlFor="obs-es">{t.publishEs}</label>
                <Textarea id="obs-es" value={obsEs} onChange={(e) => setObsEs(e.target.value)} className="mt-1 min-h-24 bg-white" />
                <Button
                  type="button"
                  disabled={busy || !obsEn.trim() || !obsEs.trim()}
                  onClick={() => void publishUpdate()}
                  className="mt-4 h-11 w-full rounded-xl bg-guaca-ocean text-xs font-black text-white hover:bg-guaca-ocean-deep disabled:opacity-60"
                >
                  {t.publishCta}
                </Button>
                <p className="mt-2 text-[11px] font-semibold text-guaca-ink/45">{t.publishedNote}</p>
              </div>
            </div>
          )}

          {tab === 'visibility' && (
            <div className="mt-5 space-y-3">
              <p className="text-[13px] font-semibold leading-relaxed text-guaca-ink/65">{t.visibilityLede}</p>
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/75">
                {license ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-guaca-ocean/10 px-3 py-1.5 text-[11px] font-black text-guaca-ocean-deep">
                        {license.status === 'expired' ? t.licenseExpired : license.status === 'revoked' ? t.licenseRevoked : t.licenseActive}
                      </span>
                      {license.visibility === 'promoted' ? (
                        <span className="rounded-full bg-guaca-mango/20 px-3 py-1.5 text-[11px] font-black text-guaca-mango-dark">
                          {t.promotedLabel}
                        </span>
                      ) : (
                        <span className="rounded-full bg-guaca-ink/6 px-3 py-1.5 text-[11px] font-black text-guaca-ink/55">
                          {t.visibilityStandard}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[14px] font-bold leading-relaxed text-guaca-ink">
                      {lang === 'es' ? license.labelEs : license.labelEn}
                    </p>
                    {license.visibility === 'promoted' && (
                      <p className="mt-2 text-[12px] font-black uppercase tracking-[.08em] text-guaca-mango-dark">{t.visibilityPromoted}</p>
                    )}
                    <p className="mt-3 text-[12px] font-semibold leading-relaxed text-guaca-ink/55">{t.licenseNote}</p>
                  </>
                ) : (
                  <p className="text-[13px] font-semibold text-guaca-ink/55">{t.loading}</p>
                )}
              </article>
              <div className="mx-auto flex w-max overflow-hidden rounded-full bg-guaca-sand/60 p-0.5">
                {(['en', 'es'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    aria-pressed={lang === code}
                    className={`min-h-11 rounded-full px-3.5 text-[11px] font-black ${lang === code ? 'bg-guaca-ocean text-white' : 'text-guaca-ink/55'}`}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  fetch('/api/merchant/logout', { method: 'POST', credentials: 'include' })
                    .catch(() => {})
                    .finally(() => { window.location.href = '/' })
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[12px] font-black text-guaca-ink shadow-sm ring-1 ring-guaca-sand/75"
              >
                <LogOut className="h-4 w-4" /> {t.signOut}
              </button>
            </div>
          )}
        </div>
      </div>

      <nav className="relative z-[500] shrink-0 border-t border-guaca-sand/70 bg-guaca-paper/96 px-6 pb-5 pt-2 backdrop-blur-md lg:order-1 lg:w-24 lg:border-r lg:border-t-0 lg:px-2 lg:py-6">
        <a href="/" className="mb-6 hidden flex-col items-center gap-1 lg:flex" aria-label="Guaca">
          <img src="/brand/guaca-mark.png" alt="" className="h-12 w-12 object-contain" />
          <span className="text-[15px] font-black lowercase tracking-tight text-guaca-ocean-deep">guaca</span>
        </a>
        <div className="flex items-center justify-around lg:flex-col lg:justify-start lg:gap-5">
          {(
            [
              { id: 'today', label: t.tabToday, icon: CalendarDays },
              { id: 'reservations', label: t.tabReservations, icon: ClipboardList },
              { id: 'place', label: t.tabPlace, icon: BedDouble },
              { id: 'visibility', label: t.tabVisibility, icon: Eye },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-14 min-w-20 flex-col items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-ocean ${
                  active ? 'bg-guaca-ocean/10 text-guaca-ocean-deep' : 'text-guaca-ink-light hover:bg-guaca-sand'
                }`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                {label}
              </button>
            )
          })}
        </div>
        <RailArt />
      </nav>
    </MobileViewport>
  )
}
