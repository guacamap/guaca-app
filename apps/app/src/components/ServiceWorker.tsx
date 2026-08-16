'use client'

import { useEffect } from 'react'

/**
 * Registers the installability service worker. Skipped inside the native
 * wrapper (which has its own offline screen) and on http, where the API
 * is unavailable anyway.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (navigator.userAgent.includes('GuacaApp/')) return
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* installability is a bonus, never a failure path */
    })
  }, [])
  return null
}
