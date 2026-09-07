import { useEffect, useState } from 'react'
import type { TouristEntitlement as Entitlement } from '@guaca/shared'
import { useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'
import { fetchEntitlement } from '../lib/recordingApi'
import { SurfaceState } from './SurfaceState'

export function TouristEntitlement() {
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  const load = () => {
    setStatus('loading')
    void fetchEntitlement().then((result) => {
      if (!result.ok) {
        setStatus('error')
        return
      }
      setEntitlement(result.entitlement)
      setStatus(result.entitlement ? 'ready' : 'empty')
    })
  }

  useEffect(() => {
    load()
  }, [])

  const code = entitlement?.planCode.replaceAll('_', ' ') ?? ''

  return (
    <section className="entitlement-card" aria-label={t.entitlementTitle}>
      <h2>{t.entitlementTitle}</h2>
      <SurfaceState status={status} loading={t.bookLoading} empty={t.entitlementNone} error={t.bookError} retry={t.bookRetry} onRetry={load}>
        {entitlement && (
          <>
            <p className="entitlement-code">{code}</p>
            <p className={entitlement.status === 'active' ? 'entitlement-active' : 'entitlement-expired'}>
              {entitlement.status === 'active' ? t.entitlementActive : t.entitlementExpired}
            </p>
            <p className="recording-lede">{t.entitlementNote}</p>
          </>
        )}
      </SurfaceState>
    </section>
  )
}
