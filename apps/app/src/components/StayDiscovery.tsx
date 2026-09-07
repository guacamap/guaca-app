import { useMemo, useState } from 'react'
import { BedDouble, UsersRound } from 'lucide-react'
import { useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'
import { formatMinor, KNOWN_AMENITIES } from '../lib/recordingUi'
import { SurfaceState } from './SurfaceState'
import type { LoadStatus, StayCard } from '../lib/recordingApi'

function amenityLabel(key: string, t: (typeof appCopy)['en']['tourist']): string {
  const labels: Record<string, string> = {
    wifi: t.amenityWifi,
    ac: t.amenityAc,
    fan: t.amenityFan,
    breakfast: t.amenityBreakfast,
    pool: t.amenityPool,
    ocean_view: t.amenityOceanView,
    rooftop: t.amenityRooftop,
    courtyard: t.amenityCourtyard,
    shared_courtyard: t.amenitySharedCourtyard,
    hammocks: t.amenityHammocks,
  }
  return labels[key] ?? key.replaceAll('_', ' ')
}

export function StayDiscovery({
  stays,
  status,
  onRetry,
  onOpenPlace,
  onReserve,
}: {
  stays: StayCard[]
  status: LoadStatus
  onRetry: () => void
  onOpenPlace: (placeId: string) => void
  onReserve: (stay: StayCard) => void
}) {
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist
  const [band, setBand] = useState<number | null>(null)
  const [amenity, setAmenity] = useState<string | null>(null)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const amenityOptions = useMemo(() => {
    const present = new Set(stays.flatMap((stay) => stay.amenities))
    return KNOWN_AMENITIES.filter((key) => present.has(key))
  }, [stays])

  const filtered = useMemo(
    () =>
      stays.filter((stay) => (band == null || stay.priceBand === band) && (amenity == null || stay.amenities.includes(amenity))),
    [stays, band, amenity],
  )

  return (
    <div className="recording-list">
      <p className="recording-lede">{t.stayLede}</p>
      <div className="stay-filters" role="group" aria-label={t.stayPriceBand}>
        <button type="button" aria-pressed={band === null} onClick={() => setBand(null)}>
          {t.stayAllAmenities}
        </button>
        {([1, 2, 3] as const).map((value) => (
          <button key={value} type="button" aria-pressed={band === value} onClick={() => setBand((prev) => (prev === value ? null : value))}>
            {value === 1 ? t.stayBandBudget : value === 2 ? t.stayBandMid : t.stayBandUpper}
          </button>
        ))}
      </div>
      {amenityOptions.length > 0 && (
        <div className="stay-filters" role="group" aria-label={t.stayAmenities}>
          {amenityOptions.map((key) => (
            <button key={key} type="button" aria-pressed={amenity === key} onClick={() => setAmenity((prev) => (prev === key ? null : key))}>
              {amenityLabel(key, t)}
            </button>
          ))}
        </div>
      )}
      <SurfaceState
        status={status === 'ready' && filtered.length === 0 ? 'empty' : status}
        loading={t.stayLoading}
        empty={t.stayEmpty}
        error={t.stayError}
        retry={t.stayRetry}
        onRetry={onRetry}
      >
        {filtered.map((stay) => {
          const room = lang === 'es' ? stay.roomTypeEs : stay.roomTypeEn
          const price = formatMinor(stay.nightlyPriceMinor, stay.currency, lang)
          const bookable = Boolean(stay.merchantId)
          return (
            <article key={stay.id} className="stay-card">
              <button type="button" className="stay-card-open" onClick={() => onOpenPlace(stay.placeId)}>
                {stay.imageUrl && !failedImages.has(stay.id) ? (
                  <img
                    src={stay.imageUrl}
                    alt=""
                    width={72}
                    height={80}
                    className="stay-thumb"
                    onError={() => setFailedImages((prev) => new Set([...prev, stay.id]))}
                  />
                ) : (
                  <span className="stay-thumb stay-thumb-fallback" aria-hidden="true">
                    <BedDouble size={22} />
                  </span>
                )}
                <span className="stay-copy">
                  <strong>{stay.placeName}</strong>
                  <span>{room}</span>
                  <small>
                    {t.stayNightly.replace('{price}', price)}
                    <span aria-hidden="true">·</span>
                    <UsersRound size={12} /> {t.stayGuestsMax.replace('{n}', String(stay.guestsMax))}
                  </small>
                  <small className="stay-amenities">
                    {stay.amenities.slice(0, 4).map((key) => (
                      <span key={key}>{amenityLabel(key, t)}</span>
                    ))}
                  </small>
                  {stay.visibility === 'promoted' && <small className="stay-promoted">{t.stayPromoted}</small>}
                </span>
              </button>
              {bookable ? (
                <button type="button" className="stay-reserve" onClick={() => onReserve(stay)}>
                  {t.stayReserve}
                </button>
              ) : (
                <p className="stay-not-bookable">{t.stayNotBookable}</p>
              )}
            </article>
          )
        })}
      </SurfaceState>
    </div>
  )
}
