import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { Button, Input, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'
import {
  createStayReservation,
  fetchAvailability,
  fetchReservation,
  type ReservationCard,
  type StayCard,
} from '../lib/recordingApi'
import { formatLocalInstant, formatMinor, idempotencyKey, nextCalendarDate, nightsBetween, RECORDING_CLOCK } from '../lib/recordingUi'

export function ReserveStay({
  stay,
  onClose,
  onBooked,
}: {
  stay: StayCard
  onClose: () => void
  onBooked: (reservation: ReservationCard) => void
}) {
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist
  const [checkIn, setCheckIn] = useState<string>(RECORDING_CLOCK.date)
  const [checkOut, setCheckOut] = useState<string>(nextCalendarDate(RECORDING_CLOCK.date))
  const [guests, setGuests] = useState(1)
  const [note, setNote] = useState('')
  const [key, setKey] = useState(idempotencyKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'unavailable' | 'network' | null>(null)
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [reservation, setReservation] = useState<ReservationCard | null>(null)

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut])
  const room = lang === 'es' ? stay.roomTypeEs : stay.roomTypeEn
  const price = formatMinor(stay.nightlyPriceMinor * Math.max(nights.length, 1), stay.currency, lang)

  useEffect(() => {
    setKey(idempotencyKey())
    setError(null)
    setUnavailableDates([])
  }, [checkIn, checkOut, guests])

  useEffect(() => {
    if (!reservation || reservation.status !== 'requested') return
    const timer = window.setInterval(() => {
      void fetchReservation(reservation.id).then((next) => {
        if (next) {
          setReservation(next)
          onBooked(next)
        }
      })
    }, 3000)
    return () => window.clearInterval(timer)
  }, [reservation, onBooked])

  const submit = async () => {
    if (busy || nights.length === 0) return
    setBusy(true)
    setError(null)
    const availability = await fetchAvailability(stay.id, checkIn, checkOut, guests)
    if (availability && !availability.available) {
      setUnavailableDates(availability.unavailableDates)
      setError('unavailable')
      setBusy(false)
      return
    }
    const result = await createStayReservation(stay.id, {
      checkIn,
      checkOut,
      guests,
      idempotencyKey: key,
      ...(note.trim() ? { note: note.trim() } : {}),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.code === 'UNAVAILABLE' ? 'unavailable' : 'network')
      return
    }
    setReservation(result.reservation)
    onBooked(result.reservation)
  }

  const statusCopy = (status: ReservationCard['status']) => {
    if (status === 'requested') return t.stayPending
    if (status === 'confirmed') return t.stayConfirmed
    if (status === 'declined') return t.stayDeclined
    if (status === 'expired') return t.stayExpired
    if (status === 'cancelled') return t.stayCancelled
    return t.stayCompleted
  }

  return (
    <div className="reserve-sheet" role="dialog" aria-labelledby="reserve-title">
      <div className="reserve-heading">
        <div>
          <p id="reserve-title">{stay.placeName}</p>
          <p>{room}</p>
        </div>
        <button type="button" aria-label={t.close} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {reservation ? (
        <div className="reserve-result" role="status">
          <p className={`reserve-status is-${reservation.status}`}>
            {reservation.status === 'confirmed' ? <Check size={16} /> : null}
            {statusCopy(reservation.status)}
          </p>
          <p>{t.stayReference.replace('{code}', reservation.referenceCode)}</p>
          <p>
            {reservation.checkIn} → {reservation.checkOut} · {reservation.guests} {t.stayGuests.toLowerCase()}
          </p>
          {reservation.status === 'requested' && reservation.holdExpiresAt && (
            <p>{t.stayHoldUntil.replace('{when}', formatLocalInstant(reservation.holdExpiresAt, lang, stay.timezone))}</p>
          )}
          {reservation.status === 'requested' && <p>{t.staySuccess}</p>}
          <p className="reserve-note">{t.stayNoPayment}</p>
        </div>
      ) : (
        <form
          className="reserve-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label>
            {t.stayCheckIn}
            <Input type="date" value={checkIn} min={RECORDING_CLOCK.date} onChange={(event) => setCheckIn(event.target.value)} required />
          </label>
          <label>
            {t.stayCheckOut}
            <Input type="date" value={checkOut} min={nextCalendarDate(checkIn)} onChange={(event) => setCheckOut(event.target.value)} required />
          </label>
          <label>
            {t.stayGuests}
            <Input
              type="number"
              min={1}
              max={Math.min(12, stay.guestsMax)}
              value={guests}
              onChange={(event) => setGuests(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
              required
            />
          </label>
          <label>
            {t.stayNote}
            <Input value={note} maxLength={500} placeholder={t.stayNotePlaceholder} onChange={(event) => setNote(event.target.value)} />
          </label>
          <p className="reserve-review">
            {t.stayReview}: {t.stayNights.replace('{n}', String(nights.length))} · {price}
          </p>
          <p className="reserve-note">{t.stayNoPayment}</p>
          {error === 'unavailable' && (
            <p role="alert">
              {t.stayUnavailable}
              {unavailableDates.length > 0 ? ` ${t.stayBusyNights.replace('{dates}', unavailableDates.join(', '))}` : ''}
            </p>
          )}
          {error === 'network' && <p role="alert">{t.stayErrorForm}</p>}
          <Button type="submit" disabled={busy || nights.length === 0} className="h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? t.stayRequesting : t.stayRequestRoom}
          </Button>
        </form>
      )}
    </div>
  )
}
