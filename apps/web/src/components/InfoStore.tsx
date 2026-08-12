import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const UPDATE_CATEGORIES = ['Hours', 'Availability', 'Menu', 'Offer', 'Other'] as const

export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number]
export type UpdateStatus = 'published' | 'verified'

export interface BusinessUpdate {
  id: string
  businessName: string
  community?: string
  title: string
  details: string
  category: UpdateCategory
  createdAt: string
  status: UpdateStatus
  verifiedBy?: string
  verifiedAt?: string
}

export type NewBusinessUpdate = Pick<BusinessUpdate, 'businessName' | 'community' | 'title' | 'details' | 'category'>

interface InfoStoreValue {
  updates: BusinessUpdate[]
  addUpdate: (update: NewBusinessUpdate) => string
  verifyUpdate: (id: string, spotterName: string) => void
}

const STORAGE_KEY = 'guaca-business-updates-v1'
const InfoStoreContext = createContext<InfoStoreValue | null>(null)

function isBusinessUpdate(value: unknown): value is BusinessUpdate {
  if (!value || typeof value !== 'object') return false
  const update = value as Partial<BusinessUpdate>

  return (
    typeof update.id === 'string' &&
    typeof update.businessName === 'string' &&
    typeof update.title === 'string' &&
    typeof update.details === 'string' &&
    typeof update.createdAt === 'string' &&
    UPDATE_CATEGORIES.includes(update.category as UpdateCategory) &&
    (update.status === 'published' || update.status === 'verified')
  )
}

function loadUpdates() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return []

    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed.filter(isBusinessUpdate) : []
  } catch {
    return []
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `update-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function InfoProvider({ children }: { children: ReactNode }) {
  const [updates, setUpdates] = useState<BusinessUpdate[]>(loadUpdates)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updates))
    } catch {
      // Keep the in-memory experience working when storage is unavailable.
    }
  }, [updates])

  const value = useMemo<InfoStoreValue>(() => ({
    updates,
    addUpdate: (input) => {
      const id = createId()
      const update: BusinessUpdate = {
        id,
        businessName: input.businessName.trim(),
        community: input.community?.trim(),
        title: input.title.trim(),
        details: input.details.trim(),
        category: input.category,
        createdAt: new Date().toISOString(),
        status: 'published',
      }

      setUpdates((current) => [update, ...current])
      return id
    },
    verifyUpdate: (id, spotterName) => {
      setUpdates((current) => current.map((update) => (
        update.id === id
          ? {
              ...update,
              status: 'verified',
              verifiedBy: spotterName.trim(),
              verifiedAt: new Date().toISOString(),
            }
          : update
      )))
    },
  }), [updates])

  return <InfoStoreContext.Provider value={value}>{children}</InfoStoreContext.Provider>
}

export function useInfoStore() {
  const store = useContext(InfoStoreContext)
  if (!store) throw new Error('useInfoStore must be used inside InfoProvider')
  return store
}

export function formatUpdateTime(isoDate: string) {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
