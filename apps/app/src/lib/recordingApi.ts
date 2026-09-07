import {
  ActivitySchema,
  PlaceObservationSchema,
  ReservationSchema,
  StaySchema,
  TouristEntitlementSchema,
  type Activity,
  type PlaceObservation,
  type Reservation,
  type Stay,
  type TouristEntitlement,
} from '@guaca/shared'

export type LoadStatus = 'loading' | 'ready' | 'empty' | 'error'

export interface StayCard extends Stay {
  placeName: string
  placeLat: number | null
  placeLon: number | null
  priceBand: number | null
  visibility: 'standard' | 'promoted'
  imageUrl: string | null
  imageCredit: string | null
}

export interface ReservationCard extends Reservation {
  placeName: string
  timezone: string
  stay: Stay | null
}

export interface AvailabilityNight {
  nightDate: string
  allotment: number
  reservedCount: number
}

export interface StayAvailability {
  available: boolean
  nights: AvailabilityNight[]
  unavailableDates: string[]
}

export interface ObservationBundle {
  current: PlaceObservation[]
  expired: PlaceObservation[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function pick(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake]
}

function unwrap(body: unknown, key: string): unknown {
  const row = asRecord(body)
  if (row && key in row) return row[key]
  return body
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function imageUrlOf(value: unknown): { url: string | null; credit: string | null } {
  const row = asRecord(value)
  if (!row) return { url: null, credit: null }
  const nested = asRecord(row.image) ?? asRecord(row.coverImage) ?? asRecord(row.cover_image) ?? row
  return {
    url: asString(nested.url),
    credit: asString(nested.credit),
  }
}

export function asActivity(raw: unknown): Activity | null {
  const row = asRecord(raw)
  if (!row) return null
  const mapped = {
    id: row.id,
    areaId: pick(row, 'areaId', 'area_id'),
    slug: row.slug,
    titleEn: pick(row, 'titleEn', 'title_en'),
    titleEs: pick(row, 'titleEs', 'title_es'),
    summaryEn: pick(row, 'summaryEn', 'summary_en'),
    summaryEs: pick(row, 'summaryEs', 'summary_es'),
    coverImage: pick(row, 'coverImage', 'cover_image'),
    placeIds: pick(row, 'placeIds', 'place_ids') ?? [],
    category: row.category,
    estimatedDurationMin: pick(row, 'estimatedDurationMin', 'estimated_duration_min'),
    travelMode: pick(row, 'travelMode', 'travel_mode'),
    interestTags: pick(row, 'interestTags', 'interest_tags') ?? [],
    suggestedWindow: pick(row, 'suggestedWindow', 'suggested_window') ?? null,
  }
  const parsed = ActivitySchema.safeParse(mapped)
  return parsed.success ? parsed.data : null
}

export function asStay(raw: unknown): Stay | null {
  const row = asRecord(raw)
  if (!row) return null
  const mapped = {
    id: row.id,
    placeId: pick(row, 'placeId', 'place_id'),
    merchantId: pick(row, 'merchantId', 'merchant_id') ?? null,
    roomTypeEn: pick(row, 'roomTypeEn', 'room_type_en'),
    roomTypeEs: pick(row, 'roomTypeEs', 'room_type_es'),
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    currency: row.currency ?? 'USD',
    nightlyPriceMinor: pick(row, 'nightlyPriceMinor', 'nightly_price_minor'),
    guestsMax: pick(row, 'guestsMax', 'guests_max'),
    timezone: row.timezone ?? 'America/Bogota',
  }
  const parsed = StaySchema.safeParse(mapped)
  return parsed.success ? parsed.data : null
}

export function asStayCard(raw: unknown): StayCard | null {
  const stay = asStay(raw)
  const row = asRecord(raw)
  if (!stay || !row) return null
  const place = asRecord(row.place) ?? asRecord(row.public_profile) ?? row
  const profile = asRecord(row.public_profile) ?? asRecord(place.public_profile) ?? asRecord(place.publicProfile)
  const image = imageUrlOf(profile) 
  const cover = image.url ? image : imageUrlOf(row)
  const visibility = asString(row.visibility) === 'promoted' ? 'promoted' : 'standard'
  return {
    ...stay,
    placeName: asString(row.placeName) ?? asString(row.place_name) ?? asString(place.name) ?? stay.roomTypeEn,
    placeLat: asNumber(row.placeLat) ?? asNumber(row.place_lat) ?? asNumber(place.lat),
    placeLon: asNumber(row.placeLon) ?? asNumber(row.place_lon) ?? asNumber(place.lon),
    priceBand: asNumber(row.priceBand) ?? asNumber(row.price_band) ?? asNumber(place.priceBand) ?? asNumber(place.price_band),
    visibility,
    imageUrl: cover.url,
    imageCredit: cover.credit,
  }
}

export function asReservation(raw: unknown): Reservation | null {
  const row = asRecord(unwrap(raw, 'reservation'))
  if (!row) return null
  const mapped = {
    id: row.id,
    stayId: pick(row, 'stayId', 'stay_id'),
    merchantId: pick(row, 'merchantId', 'merchant_id'),
    touristId: pick(row, 'touristId', 'tourist_id'),
    checkIn: pick(row, 'checkIn', 'check_in'),
    checkOut: pick(row, 'checkOut', 'check_out'),
    guests: row.guests,
    nightlyPriceMinor: pick(row, 'nightlyPriceMinor', 'nightly_price_minor'),
    currency: row.currency ?? 'USD',
    status: row.status,
    referenceCode: pick(row, 'referenceCode', 'reference_code'),
    holdExpiresAt: pick(row, 'holdExpiresAt', 'hold_expires_at') ?? null,
    note: row.note ?? null,
  }
  const parsed = ReservationSchema.safeParse(mapped)
  return parsed.success ? parsed.data : null
}

export function asReservationCard(raw: unknown): ReservationCard | null {
  const reservation = asReservation(raw)
  const row = asRecord(unwrap(raw, 'reservation'))
  if (!reservation || !row) return null
  const stay = asStay(row.stay) ?? asStay(row)
  return {
    ...reservation,
    placeName: asString(row.placeName) ?? asString(row.place_name) ?? stay?.roomTypeEn ?? reservation.referenceCode,
    timezone: asString(row.timezone) ?? stay?.timezone ?? 'America/Bogota',
    stay,
  }
}

export function asObservation(raw: unknown): PlaceObservation | null {
  const row = asRecord(raw)
  if (!row) return null
  const mapped = {
    id: row.id,
    placeId: pick(row, 'placeId', 'place_id'),
    kind: row.kind,
    statementEn: pick(row, 'statementEn', 'statement_en'),
    statementEs: pick(row, 'statementEs', 'statement_es'),
    sourceKind: pick(row, 'sourceKind', 'source_kind'),
    sourceLabel: pick(row, 'sourceLabel', 'source_label'),
    observedAt: pick(row, 'observedAt', 'observed_at'),
    validUntil: pick(row, 'validUntil', 'valid_until') ?? null,
    status: row.status ?? 'active',
    evidencePhotoUrl: pick(row, 'evidencePhotoUrl', 'evidence_photo_url') ?? null,
    createdBy: pick(row, 'createdBy', 'created_by') ?? null,
  }
  const parsed = PlaceObservationSchema.safeParse(mapped)
  return parsed.success ? parsed.data : null
}

export function asEntitlement(raw: unknown): TouristEntitlement | null {
  const row = asRecord(unwrap(raw, 'entitlement'))
  if (!row) return null
  const mapped = {
    touristId: pick(row, 'touristId', 'tourist_id'),
    planCode: pick(row, 'planCode', 'plan_code'),
    status: row.status,
    startsAt: pick(row, 'startsAt', 'starts_at'),
    endsAt: pick(row, 'endsAt', 'ends_at') ?? null,
    source: row.source,
  }
  const parsed = TouristEntitlementSchema.safeParse(mapped)
  return parsed.success ? parsed.data : null
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchActivities(areaId: string | null): Promise<{ ok: boolean; activities: Activity[] }> {
  const qs = areaId ? `?areaId=${encodeURIComponent(areaId)}` : ''
  try {
    const res = await fetch(`/api/activities${qs}`, { credentials: 'include' })
    if (!res.ok) return { ok: false, activities: [] }
    const body = await readBody(res)
    const list = unwrap(body, 'activities')
    const activities = Array.isArray(list) ? list.map(asActivity).filter((row): row is Activity => row !== null) : []
    return { ok: true, activities }
  } catch {
    return { ok: false, activities: [] }
  }
}

export async function fetchStays(params: {
  areaId: string | null
  priceBand?: number | null
  amenities?: string[]
}): Promise<{ ok: boolean; stays: StayCard[] }> {
  const search = new URLSearchParams()
  if (params.areaId) search.set('areaId', params.areaId)
  if (params.priceBand) search.set('priceBand', String(params.priceBand))
  if (params.amenities && params.amenities.length > 0) search.set('amenities', params.amenities.join(','))
  const qs = search.toString() ? `?${search.toString()}` : ''
  try {
    const res = await fetch(`/api/stays${qs}`, { credentials: 'include' })
    if (!res.ok) return { ok: false, stays: [] }
    const body = await readBody(res)
    const list = unwrap(body, 'stays')
    const stays = Array.isArray(list) ? list.map(asStayCard).filter((row): row is StayCard => row !== null) : []
    return { ok: true, stays }
  } catch {
    return { ok: false, stays: [] }
  }
}

export async function fetchStay(id: string): Promise<StayCard | null> {
  try {
    const res = await fetch(`/api/stays/${id}`, { credentials: 'include' })
    if (!res.ok) return null
    const body = await readBody(res)
    return asStayCard(unwrap(body, 'stay') ?? body)
  } catch {
    return null
  }
}

export async function fetchAvailability(
  stayId: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): Promise<StayAvailability | null> {
  const qs = new URLSearchParams({ checkIn, checkOut, guests: String(guests) })
  try {
    const res = await fetch(`/api/stays/${stayId}/availability?${qs.toString()}`, { credentials: 'include' })
    if (!res.ok) return null
    const body = asRecord(await readBody(res))
    if (!body) return null
    const nightsRaw = Array.isArray(body.nights) ? body.nights : []
    const nights: AvailabilityNight[] = nightsRaw.flatMap((night) => {
      const row = asRecord(night)
      if (!row) return []
      const nightDate = asString(pick(row, 'nightDate', 'night_date')) ?? asString(row.date)
      const allotment = asNumber(row.allotment)
      const reservedCount = asNumber(pick(row, 'reservedCount', 'reserved_count'))
      if (!nightDate || allotment == null || reservedCount == null) return []
      return [{ nightDate, allotment, reservedCount }]
    })
    const unavailable = Array.isArray(body.unavailableDates)
      ? body.unavailableDates.filter((d): d is string => typeof d === 'string')
      : nights
          .filter((n) => n.reservedCount >= n.allotment || n.allotment === 0)
          .map((n) => n.nightDate)
    return {
      available: typeof body.available === 'boolean'
        ? body.available
        : nights.length > 0 && unavailable.length === 0,
      nights,
      unavailableDates: unavailable,
    }
  } catch {
    return null
  }
}

export async function createStayReservation(
  stayId: string,
  body: { checkIn: string; checkOut: string; guests: number; note?: string; idempotencyKey: string },
): Promise<{ ok: true; reservation: ReservationCard } | { ok: false; code: 'UNAVAILABLE' | 'NOT_FOUND' | 'ERROR' }> {
  try {
    const res = await fetch(`/api/stays/${stayId}/reservations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await readBody(res)
    if (res.status === 409) return { ok: false, code: 'UNAVAILABLE' }
    if (res.status === 404) return { ok: false, code: 'NOT_FOUND' }
    if (!res.ok) return { ok: false, code: 'ERROR' }
    const reservation = asReservationCard(unwrap(payload, 'reservation') ?? payload)
    if (!reservation) return { ok: false, code: 'ERROR' }
    return { ok: true, reservation }
  } catch {
    return { ok: false, code: 'ERROR' }
  }
}

export async function fetchReservations(): Promise<{ ok: boolean; reservations: ReservationCard[] }> {
  try {
    const res = await fetch('/api/tourist/reservations', { credentials: 'include' })
    if (!res.ok) return { ok: false, reservations: [] }
    const body = await readBody(res)
    const list = unwrap(body, 'reservations')
    const reservations = Array.isArray(list)
      ? list.map(asReservationCard).filter((row): row is ReservationCard => row !== null)
      : []
    return { ok: true, reservations }
  } catch {
    return { ok: false, reservations: [] }
  }
}

export async function fetchReservation(id: string): Promise<ReservationCard | null> {
  try {
    const res = await fetch(`/api/tourist/reservations/${id}`, { credentials: 'include' })
    if (!res.ok) return null
    const body = await readBody(res)
    return asReservationCard(unwrap(body, 'reservation') ?? body)
  } catch {
    return null
  }
}

export async function cancelReservation(id: string): Promise<ReservationCard | null> {
  try {
    const res = await fetch(`/api/tourist/reservations/${id}/cancel`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return null
    const body = await readBody(res)
    return asReservationCard(unwrap(body, 'reservation') ?? body)
  } catch {
    return null
  }
}

export async function fetchObservations(placeId: string): Promise<{ ok: boolean; bundle: ObservationBundle }> {
  try {
    const res = await fetch(`/api/places/${placeId}/observations`, { credentials: 'include' })
    if (!res.ok) return { ok: false, bundle: { current: [], expired: [] } }
    const body = asRecord(await readBody(res)) ?? {}
    const currentRaw = body.current ?? body.observations ?? []
    const expiredRaw = body.expired ?? []
    const current = Array.isArray(currentRaw)
      ? currentRaw.map(asObservation).filter((row): row is PlaceObservation => row !== null)
      : []
    const expiredListed = Array.isArray(expiredRaw)
      ? expiredRaw.map(asObservation).filter((row): row is PlaceObservation => row !== null)
      : []
    const expiredFromCurrent = current.filter((row) => row.status === 'expired')
    return {
      ok: true,
      bundle: {
        current: current.filter((row) => row.status !== 'expired'),
        expired: [...expiredListed, ...expiredFromCurrent],
      },
    }
  } catch {
    return { ok: false, bundle: { current: [], expired: [] } }
  }
}

export async function requestObservationCheck(placeId: string, observationId?: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/places/${placeId}/observations/request-check`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(observationId ? { observationId } : {}),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchEntitlement(): Promise<{ ok: boolean; entitlement: TouristEntitlement | null }> {
  try {
    const res = await fetch('/api/tourist/entitlement', { credentials: 'include' })
    if (!res.ok) return { ok: false, entitlement: null }
    return { ok: true, entitlement: asEntitlement(await readBody(res)) }
  } catch {
    return { ok: false, entitlement: null }
  }
}
