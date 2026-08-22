'use client'

import { Providers } from '../components/Providers'
import { AdminPanel } from '../components/AdminPanel'

/**
 * The admin panel — token-gated, audit-backed, and REAL: every button maps
 * to an operator API route that writes an operator_actions row. Unlike the
 * old business-publisher demo, nothing here is local-only state, so the
 * panel can ship.
 */
export default function OperatorScreen() {
  return (
    <Providers>
      <AdminPanel />
    </Providers>
  )
}
