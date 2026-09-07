import { Navigation } from 'lucide-react'
import { useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'
import { cancelReservation, type LoadStatus, type ReservationCard } from '../lib/recordingApi'
import { formatLocalInstant, nightsBetween } from '../lib/recordingUi'
import { SurfaceState } from './SurfaceState'

export function TouristReservations({
  reservations,
  status,
  onRetry,
  onOpenPlace,
  onDirections,
  onChanged,
}: {
  reservations: ReservationCard[]
  status: LoadStatus
  onRetry: () => void
  onOpenPlace: (placeId: string) => void
  onDirections: (stay: ReservationCard) => void
  onChanged: (reservation: ReservationCard) => void
}) {
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist

  const statusCopy = (statusValue: ReservationCard['status']) => {
    if (statusValue === 'requested') return t.stayPending
    if (statusValue === 'confirmed') return t.stayConfirmed
    if (statusValue === 'declined') return t.stayDeclined
    if (statusValue === 'expired') return t.stayExpired
    if (statusValue === 'cancelled') return t.stayCancelled
    return t.stayCompleted
  }

  const cancel = async (reservation: ReservationCard) => {
    if (!window.confirm(t.stayCancelConfirm)) return
    const next = await cancelReservation(reservation.id)
    if (next) onChanged(next)
  }

  return (
    <section className="bookings-block" aria-label={t.bookTitle}>
      <h2>{t.bookTitle}</h2>
      <p className="recording-lede">{t.bookPrivate}</p>
      <SurfaceState status={status} loading={t.bookLoading} empty={t.bookEmpty} error={t.bookError} retry={t.bookRetry} onRetry={onRetry}>
        {reservations.map((reservation) => {
          const nights = nightsBetween(reservation.checkIn, reservation.checkOut).length
          const placeId = reservation.stay?.placeId
          return (
            <article key={reservation.id} className={`booking-card is-${reservation.status}`}>
              <p className="booking-status">{statusCopy(reservation.status)}</p>
              <button type="button" className="booking-name" onClick={() => placeId && onOpenPlace(placeId)}>
                {reservation.placeName}
              </button>
              <p>
                {reservation.checkIn} → {reservation.checkOut} · {t.stayNights.replace('{n}', String(nights))} · {reservation.guests} {t.stayGuests.toLowerCase()}
              </p>
              <p>{t.stayReference.replace('{code}', reservation.referenceCode)}</p>
              {reservation.status === 'requested' && reservation.holdExpiresAt && (
                <p>{t.stayHoldUntil.replace('{when}', formatLocalInstant(reservation.holdExpiresAt, lang, reservation.timezone))}</p>
              )}
              <div className="booking-actions">
                {placeId && (
                  <button type="button" onClick={() => onDirections(reservation)}>
                    <Navigation size={16} /> {t.bookDirections}
                  </button>
                )}
                {(reservation.status === 'requested' || reservation.status === 'confirmed') && (
                  <button type="button" onClick={() => void cancel(reservation)}>
                    {t.stayCancel}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </SurfaceState>
    </section>
  )
}
