import type { ActivityInterestTagType as ActivityInterestTag, PlaceCategory } from '@guaca/shared'

/** Scenario clock used for stay date defaults. Inventory nights are venue-local calendar dates. */
export const RECORDING_CLOCK = {
  date: '2026-09-12',
  timezone: 'America/Bogota',
  instant: '2026-09-12T14:00:00-05:00',
} as const

export const PLAN_INTERESTS: ActivityInterestTag[] = ['relax', 'adventure', 'culture', 'food']

export const INTEREST_CATEGORIES: Record<ActivityInterestTag, PlaceCategory[]> = {
  relax: ['beach_water', 'nature_walk'],
  adventure: ['nature_walk', 'beach_water'],
  culture: ['culture_history'],
  food: ['eat_drink', 'market_shop'],
}

export function categoriesForInterests(tags: readonly ActivityInterestTag[]): PlaceCategory[] {
  const seen = new Set<PlaceCategory>()
  for (const tag of tags) {
    for (const category of INTEREST_CATEGORIES[tag]) seen.add(category)
  }
  return [...seen]
}

export function nextCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) + 1)
  return new Date(utc).toISOString().slice(0, 10)
}

/** Half-open stay nights: checkout is not consumed. */
export function nightsBetween(checkIn: string, checkOut: string): string[] {
  const nights: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) return nights
  if (checkOut <= checkIn) return nights
  let cursor = checkIn
  while (cursor < checkOut) {
    nights.push(cursor)
    cursor = nextCalendarDate(cursor)
  }
  return nights
}

export function formatMinor(minor: number, currency: string, lang: 'en' | 'es'): string {
  try {
    return new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(0)} ${currency}`
  }
}

export function formatLocalInstant(iso: string, lang: 'en' | 'es', timeZone: string = RECORDING_CLOCK.timezone): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date)
}

export function formatClock(min: number): string {
  const wrapped = ((min % 1440) + 1440) % 1440
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0')
  const mm = String(wrapped % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export type TravelKind = 'walk' | 'taxi' | 'boat'

export function travelKind(mode?: string | null, gettingThere?: string | null): TravelKind {
  const text = (gettingThere ?? '').toLowerCase()
  if (/boat|ferry|lancha|isla|island|barco|water taxi|water-taxi/.test(text)) return 'boat'
  if (mode === 'taxi' || mode === 'mixed') return 'taxi'
  return 'walk'
}

export function estimateTravelMin(
  from: { lat: number; lon: number } | null | undefined,
  to: { lat: number; lon: number } | null | undefined,
  kind: TravelKind,
): number {
  if (!from || !to) return kind === 'boat' ? 30 : kind === 'taxi' ? 12 : 8
  const km = haversineKm(from, to)
  const resolved: TravelKind = kind === 'walk' && km > 8 ? 'taxi' : kind
  if (resolved === 'boat') return Math.max(20, Math.round(km * 4 + 15))
  if (resolved === 'taxi') return Math.max(8, Math.round(km * 3 + 6))
  return Math.max(5, Math.round(km * 12))
}

export function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `stay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const KNOWN_AMENITIES = [
  'wifi',
  'ac',
  'fan',
  'breakfast',
  'pool',
  'ocean_view',
  'rooftop',
  'courtyard',
  'shared_courtyard',
  'hammocks',
] as const
