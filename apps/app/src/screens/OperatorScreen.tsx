'use client'

import { useState } from 'react'
import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { BusinessComingSoon } from '../components/BusinessComingSoon'
import { OperatorView } from '../components/OperatorView'

/**
 * Everyone sees the coming-soon wall: the publisher behind it is local-only
 * state with no API or business account, so shipping it would claim a
 * capability the product does not have. Dev builds can still open it to
 * exercise the tourist-facing updates surface.
 */
export default function OperatorScreen() {
  const [preview, setPreview] = useState(false)
  const devPreview = process.env.NODE_ENV !== 'production' && preview

  return (
    <Providers>
      <PhoneShell>
        {devPreview ? <OperatorView /> : <BusinessComingSoon onPreview={() => setPreview(true)} />}
      </PhoneShell>
    </Providers>
  )
}
