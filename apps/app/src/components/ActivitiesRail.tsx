import { useMemo, useState } from 'react'
import { CarTaxiFront, Clock3, Footprints, MapPin, Plus, Sailboat } from 'lucide-react'
import { useLanguage } from '@guaca/ui'
import type { Activity, ActivityInterestTagType as ActivityInterestTag } from '@guaca/shared'
import { appCopy } from '../lib/copy'
import { SurfaceState } from './SurfaceState'
import type { LoadStatus } from '../lib/recordingApi'

function TravelIcon({ mode }: { mode: Activity['travelMode'] }) {
  if (mode === 'taxi') return <CarTaxiFront size={14} aria-hidden="true" />
  if (mode === 'mixed') return <Sailboat size={14} aria-hidden="true" />
  return <Footprints size={14} aria-hidden="true" />
}

export function ActivitiesRail({
  activities,
  status,
  onRetry,
  interests,
  placeNames,
  onOpenPlace,
  onAddPlaces,
}: {
  activities: Activity[]
  status: LoadStatus
  onRetry: () => void
  interests: readonly ActivityInterestTag[]
  placeNames: Record<string, string>
  onOpenPlace: (placeId: string) => void
  onAddPlaces: (placeIds: string[]) => void
}) {
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist
  const [openId, setOpenId] = useState<string | null>(null)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    if (interests.length === 0) return activities
    return activities.filter((activity) => activity.interestTags.some((tag) => interests.includes(tag)))
  }, [activities, interests])

  const windowLabel = (window: Activity['suggestedWindow']) => {
    if (window === 'morning') return t.actMorning
    if (window === 'afternoon') return t.actAfternoon
    if (window === 'sunset') return t.actSunset
    if (window === 'evening') return t.actEvening
    return null
  }

  const modeLabel = (mode: Activity['travelMode']) => {
    if (mode === 'taxi') return t.actTaxi
    if (mode === 'mixed') return t.actMixed
    return t.actWalk
  }

  return (
    <div className="recording-list">
      <p className="recording-lede">{t.actLede}</p>
      <SurfaceState
        status={status === 'ready' && filtered.length === 0 ? 'empty' : status}
        loading={t.actLoading}
        empty={t.actEmpty}
        error={t.actError}
        retry={t.actRetry}
        onRetry={onRetry}
      >
        {filtered.map((activity) => {
          const title = lang === 'es' ? activity.titleEs : activity.titleEn
          const summary = lang === 'es' ? activity.summaryEs : activity.summaryEn
          const open = openId === activity.id
          const cover = activity.coverImage && !failedImages.has(activity.id) ? activity.coverImage : null
          const window = windowLabel(activity.suggestedWindow)
          return (
            <article key={activity.id} className="activity-card">
              <button
                type="button"
                className="activity-card-open"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : activity.id)}
              >
                {cover ? (
                  <img
                    src={cover.url}
                    alt=""
                    width={72}
                    height={72}
                    className="activity-thumb"
                    onError={() => setFailedImages((prev) => new Set([...prev, activity.id]))}
                  />
                ) : (
                  <span className="activity-thumb activity-thumb-fallback" aria-hidden="true">
                    <MapPin size={22} />
                  </span>
                )}
                <span className="activity-copy">
                  <strong>{title}</strong>
                  <span>{summary}</span>
                  <small>
                    <Clock3 size={12} /> {t.actDuration.replace('{n}', String(activity.estimatedDurationMin))}
                    <span aria-hidden="true">·</span>
                    <TravelIcon mode={activity.travelMode} /> {modeLabel(activity.travelMode)}
                    {window ? (
                      <>
                        <span aria-hidden="true">·</span>
                        {window}
                      </>
                    ) : null}
                  </small>
                  <small className="activity-tags">
                    {activity.interestTags.map((tag) => (
                      <span key={tag}>
                        {tag === 'relax' ? t.interestRelax : tag === 'adventure' ? t.interestAdventure : tag === 'culture' ? t.interestCulture : t.interestFood}
                      </span>
                    ))}
                  </small>
                </span>
              </button>
              {open && (
                <div className="activity-places">
                  <p>{t.actPlaces}</p>
                  {activity.placeIds.map((placeId) => (
                    <button key={placeId} type="button" onClick={() => onOpenPlace(placeId)}>
                      <MapPin size={14} /> {placeNames[placeId] ?? t.stayOpenPlace}
                    </button>
                  ))}
                  <button type="button" className="activity-add" onClick={() => onAddPlaces(activity.placeIds)}>
                    <Plus size={16} /> {t.actAddPlan}
                  </button>
                  {cover && (
                    <p className="activity-credit">
                      {cover.credit}
                      {'license' in cover ? ` · ${cover.license}` : ''}
                    </p>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </SurfaceState>
    </div>
  )
}
