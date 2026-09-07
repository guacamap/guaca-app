import { useState } from 'react'
import { CarTaxiFront, Footprints, Sailboat, X } from 'lucide-react'
import { useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'
import { estimateTravelMin, formatClock, travelKind, type TravelKind } from '../lib/recordingUi'

export interface TimelineStop {
  placeId: string
  name: string
  category: string
  thumbnail: string | null
  icon: string
  startMin: number
  durationMin: number
  lat: number | null
  lon: number | null
  gettingThere?: string | null
  travelMode?: string | null
}

export function ItineraryTimeline({
  stops,
  substitutes,
  onOpen,
  onRemove,
  onSubstitute,
  editable = true,
}: {
  stops: TimelineStop[]
  substitutes: Array<{ id: string; name: string; category: string }>
  onOpen: (placeId: string) => void
  onRemove: (placeId: string) => void
  onSubstitute: (fromId: string, toId: string) => void
  editable?: boolean
}) {
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist
  const [swapId, setSwapId] = useState<string | null>(null)

  return (
    <ol className="itinerary-timeline">
      {stops.map((stop, index) => {
        const next = stops[index + 1]
        const from = stop.lat != null && stop.lon != null ? { lat: stop.lat, lon: stop.lon } : null
        const to = next && next.lat != null && next.lon != null ? { lat: next.lat, lon: next.lon } : null
        const kind: TravelKind = travelKind(stop.travelMode ?? next?.travelMode, `${stop.gettingThere ?? ''} ${next?.gettingThere ?? ''}`)
        const travelMin = next ? estimateTravelMin(from, to, kind) : 0
        const options = substitutes.filter((place) => place.id !== stop.placeId && place.category === stop.category)
        return (
          <li key={`${stop.placeId}-${index}`} className="itinerary-stop">
            <div className="itinerary-stop-card">
              {stop.thumbnail ? (
                <img src={stop.thumbnail} alt="" width={56} height={56} className="itinerary-thumb" />
              ) : (
                <span className="itinerary-thumb itinerary-thumb-fallback" aria-hidden="true">
                  {stop.icon}
                </span>
              )}
              <div className="itinerary-copy">
                <p className="itinerary-time">{formatClock(stop.startMin)}</p>
                <button type="button" className="itinerary-name" onClick={() => onOpen(stop.placeId)}>
                  {stop.name}
                </button>
                <p>{t.timelineDuration.replace('{n}', String(stop.durationMin))}</p>
              </div>
              {editable && (
              <div className="itinerary-actions">
                {options.length > 0 && (
                  <button type="button" onClick={() => setSwapId(swapId === stop.placeId ? null : stop.placeId)}>
                    {t.timelineSubstitute}
                  </button>
                )}
                <button type="button" aria-label={t.removeStop} onClick={() => onRemove(stop.placeId)}>
                  <X size={16} />
                </button>
              </div>
              )}
            </div>
            {editable && swapId === stop.placeId && options.length > 0 && (
              <div className="itinerary-swap">
                {options.slice(0, 6).map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => {
                      onSubstitute(stop.placeId, place.id)
                      setSwapId(null)
                    }}
                  >
                    {place.name}
                  </button>
                ))}
              </div>
            )}
            {next && (
              <p className={`itinerary-travel is-${kind}`}>
                {kind === 'boat' ? <Sailboat size={14} /> : kind === 'taxi' ? <CarTaxiFront size={14} /> : <Footprints size={14} />}
                {kind === 'boat'
                  ? t.timelineBoat.replace('{n}', String(travelMin))
                  : kind === 'taxi'
                    ? t.timelineTaxi.replace('{n}', String(travelMin))
                    : t.timelineWalk.replace('{n}', String(travelMin))}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
