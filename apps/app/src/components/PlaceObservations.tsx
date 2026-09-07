import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { observationIsCurrent, type PlaceObservation } from '@guaca/shared'
import { useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'
import { fetchObservations, requestObservationCheck, type ObservationBundle } from '../lib/recordingApi'
import { formatLocalInstant, RECORDING_CLOCK } from '../lib/recordingUi'
import { SurfaceState } from './SurfaceState'

function sourceLabel(kind: PlaceObservation['sourceKind'], t: (typeof appCopy)['en']['tourist']): string {
  if (kind === 'public_listing') return t.obsPublicListing
  if (kind === 'business_statement') return t.obsBusinessStatement
  if (kind === 'pending_local_check') return t.obsPendingCheck
  return t.obsLocallyConfirmed
}

function kindLabel(kind: PlaceObservation['kind'], t: (typeof appCopy)['en']['tourist']): string {
  if (kind === 'schedule') return t.obsKindSchedule
  if (kind === 'access') return t.obsKindAccess
  if (kind === 'service') return t.obsKindService
  return t.obsKindCondition
}

export function PlaceObservations({ placeId }: { placeId: string }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist
  const [bundle, setBundle] = useState<ObservationBundle>({ current: [], expired: [] })
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [requested, setRequested] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    setStatus('loading')
    void fetchObservations(placeId).then((result) => {
      if (!result.ok) {
        setStatus('error')
        return
      }
      setBundle(result.bundle)
      setStatus(result.bundle.current.length === 0 && result.bundle.expired.length === 0 ? 'empty' : 'ready')
    })
  }

  useEffect(() => {
    load()
    // Reload when the open place changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId])

  const requestCheck = async (observation: PlaceObservation) => {
    if (busyId || requested.has(observation.id)) return
    setBusyId(observation.id)
    const ok = await requestObservationCheck(placeId, observation.id)
    setBusyId(null)
    if (ok) setRequested((prev) => new Set([...prev, observation.id]))
  }

  const renderRow = (observation: PlaceObservation, expired: boolean) => {
    const current = !expired && observationIsCurrent(observation, RECORDING_CLOCK.instant)
    const statement = lang === 'es' ? observation.statementEs : observation.statementEn
    return (
      <article key={observation.id} className={`observation-row ${current ? 'is-current' : 'is-expired'}`}>
        <p className="observation-meta">
          <span className={`observation-source source-${observation.sourceKind}`}>{sourceLabel(observation.sourceKind, t)}</span>
          <span>{kindLabel(observation.kind, t)}</span>
          {!current && <span className="observation-expired">{t.obsExpired}</span>}
        </p>
        <p className="observation-statement">{current ? statement : t.obsNotCurrent}</p>
        {!current && <p className="observation-stale">{statement}</p>}
        <p className="observation-when">{t.obsObserved.replace('{when}', formatLocalInstant(observation.observedAt, lang))}</p>
        {!current && (
          <button type="button" disabled={busyId === observation.id || requested.has(observation.id)} onClick={() => void requestCheck(observation)}>
            {busyId === observation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {requested.has(observation.id) ? t.obsRequested : busyId === observation.id ? t.obsRequesting : t.obsRequestCheck}
          </button>
        )}
      </article>
    )
  }

  return (
    <section className="observations-block" aria-label={t.obsTitle}>
      <h3>{t.obsTitle}</h3>
      <SurfaceState status={status} loading={t.obsLoading} empty={t.obsEmpty} error={t.obsError} retry={t.obsRetry} onRetry={load}>
        {bundle.current.map((row) => renderRow(row, false))}
        {bundle.expired.map((row) => renderRow(row, true))}
      </SurfaceState>
    </section>
  )
}
