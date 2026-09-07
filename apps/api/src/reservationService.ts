import type { Pool, PoolClient } from 'pg';
import { occupyStayNights, releaseStayNights, StayInventoryError } from '@guaca/db';
import type { Reservation } from '@guaca/shared';
import { randomBytes } from 'node:crypto';

export const HOLD_DURATION_MS = 30 * 60 * 1000;

export const RESERVATION_STATUS_LABEL = {
  requested: { en: 'Awaiting confirmation', es: 'Esperando confirmación' },
  confirmed: { en: 'Stay confirmed', es: 'Estadía confirmada' },
  declined: { en: 'Declined', es: 'Rechazada' },
  expired: { en: 'Request expired', es: 'Solicitud vencida' },
  cancelled: { en: 'Cancelled', es: 'Cancelada' },
  completed: { en: 'Completed', es: 'Completada' },
} as const;

export function venueLocalDate(timezone: string, instant = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function dateOnly(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapReservation(r: Record<string, unknown>): Reservation {
  return {
    id: r.id as string,
    stayId: r.stay_id as string,
    merchantId: r.merchant_id as string,
    touristId: r.tourist_id as string,
    checkIn: dateOnly(r.check_in as Date | string),
    checkOut: dateOnly(r.check_out as Date | string),
    guests: Number(r.guests),
    nightlyPriceMinor: Number(r.nightly_price_minor),
    currency: r.currency as string,
    status: r.status as Reservation['status'],
    referenceCode: r.reference_code as string,
    holdExpiresAt: isoDate(r.hold_expires_at as Date | string | null),
    note: (r.note as string | null) ?? null,
  };
}

export function reservationCopy(status: Reservation['status']): { en: string; es: string } {
  if (status === 'requested') {
    return {
      en: 'Stay requested. Awaiting confirmation.',
      es: 'Estadía solicitada. Esperando confirmación.',
    };
  }
  if (status === 'confirmed') {
    return {
      en: 'Reservation confirmed. No payment was taken.',
      es: 'Reserva confirmada. No se realizó ningún pago.',
    };
  }
  return RESERVATION_STATUS_LABEL[status];
}

function referenceCode(): string {
  return `GUA-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint?: string };
  if (e.code !== '23505') return false;
  if (!constraint) return true;
  return e.constraint === constraint;
}

const SELECT_RESERVATION = `select id, stay_id, merchant_id, tourist_id, check_in, check_out,
         guests, nightly_price_minor, currency, status, reference_code,
         hold_expires_at, note, idempotency_key, created_at, updated_at
    from reservations`;

export interface StayRow {
  id: string;
  placeId: string;
  merchantId: string | null;
  roomTypeEn: string;
  roomTypeEs: string;
  amenities: string[];
  currency: string;
  nightlyPriceMinor: number;
  guestsMax: number;
  timezone: string;
}

export async function loadStay(client: Pool | PoolClient, stayId: string): Promise<StayRow | null> {
  const res = await client.query(
    `select id, place_id, merchant_id, room_type_en, room_type_es, amenities,
            currency, nightly_price_minor, guests_max, timezone
       from stays where id = $1`,
    [stayId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id as string,
    placeId: r.place_id as string,
    merchantId: (r.merchant_id as string | null) ?? null,
    roomTypeEn: r.room_type_en as string,
    roomTypeEs: r.room_type_es as string,
    amenities: r.amenities as string[],
    currency: r.currency as string,
    nightlyPriceMinor: Number(r.nightly_price_minor),
    guestsMax: Number(r.guests_max),
    timezone: r.timezone as string,
  };
}

export async function expireStaleHoldsOnClient(
  client: PoolClient,
  stayId?: string,
): Promise<number> {
  const stale = await client.query<{ id: string }>(
    `select id from reservations
      where status = 'requested'
        and hold_expires_at <= now()
        and ($1::uuid is null or stay_id = $1)
      for update skip locked`,
    [stayId ?? null],
  );
  for (const row of stale.rows) {
    const moved = await client.query(
      `update reservations
          set status = 'expired', updated_at = now()
        where id = $1 and status = 'requested'
        returning id`,
      [row.id],
    );
    if (moved.rowCount === 1) {
      await releaseStayNights(client, row.id);
    }
  }
  return stale.rows.length;
}

export async function expireStaleHolds(pool: Pool, stayId?: string): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const n = await expireStaleHoldsOnClient(client, stayId);
    await client.query('commit');
    return n;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function getReservation(
  pool: Pool | PoolClient,
  id: string,
): Promise<Reservation | null> {
  const res = await pool.query(`${SELECT_RESERVATION} where id = $1`, [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapReservation(row) : null;
}

export class ReservationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'NOT_FOUND'
      | 'NOT_BOOKABLE'
      | 'PAST_CHECK_IN'
      | 'GUESTS'
      | 'UNAVAILABLE'
      | 'DUPLICATE'
      | 'FORBIDDEN'
      | 'CONFLICT',
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'ReservationError';
  }
}

export async function createStayReservation(
  pool: Pool,
  input: {
    stayId: string;
    touristId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    note?: string;
    idempotencyKey: string;
  },
): Promise<Reservation> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const stay = await loadStay(client, input.stayId);
    if (!stay) throw new ReservationError('Stay not found', 'NOT_FOUND', 404);
    const merchantId = stay.merchantId;
    if (!merchantId) {
      throw new ReservationError('This stay is not taking requests', 'NOT_BOOKABLE', 409);
    }
    if (input.guests > stay.guestsMax) {
      throw new ReservationError(
        `This room takes at most ${stay.guestsMax} guests`,
        'GUESTS',
        409,
      );
    }
    const today = venueLocalDate(stay.timezone);
    if (input.checkIn < today) {
      throw new ReservationError('Check-in is in the past for this venue', 'PAST_CHECK_IN', 400);
    }
    if (input.checkOut <= input.checkIn) {
      throw new ReservationError('checkOut must be after checkIn', 'NOT_FOUND', 400);
    }

    const existing = await client.query(
      `${SELECT_RESERVATION}
        where stay_id = $1 and tourist_id = $2 and idempotency_key = $3`,
      [input.stayId, input.touristId, input.idempotencyKey],
    );
    if (existing.rows[0]) {
      await client.query('commit');
      return mapReservation(existing.rows[0] as Record<string, unknown>);
    }

    await expireStaleHoldsOnClient(client, input.stayId);

    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);
    let inserted: Record<string, unknown> | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      await client.query('savepoint create_res');
      try {
        const res = await client.query(
          `insert into reservations (
             stay_id, merchant_id, tourist_id, check_in, check_out, guests,
             nightly_price_minor, currency, status, reference_code,
             hold_expires_at, note, idempotency_key
           ) values (
             $1, $2, $3, $4::date, $5::date, $6, $7, $8, 'requested', $9,
             $10, $11, $12
           ) returning id, stay_id, merchant_id, tourist_id, check_in, check_out,
             guests, nightly_price_minor, currency, status, reference_code,
             hold_expires_at, note, idempotency_key, created_at, updated_at`,
          [
            stay.id,
            merchantId,
            input.touristId,
            input.checkIn,
            input.checkOut,
            input.guests,
            stay.nightlyPriceMinor,
            stay.currency,
            referenceCode(),
            holdExpiresAt,
            input.note ?? null,
            input.idempotencyKey,
          ],
        );
        await client.query('release savepoint create_res');
        inserted = res.rows[0] as Record<string, unknown>;
        break;
      } catch (err) {
        await client.query('rollback to savepoint create_res');
        if (isUniqueViolation(err, 'reservations_idempotency')) {
          const again = await client.query(
            `${SELECT_RESERVATION}
              where stay_id = $1 and tourist_id = $2 and idempotency_key = $3`,
            [input.stayId, input.touristId, input.idempotencyKey],
          );
          if (again.rows[0]) {
            await client.query('commit');
            return mapReservation(again.rows[0] as Record<string, unknown>);
          }
        }
        if (isUniqueViolation(err, 'reservations_active_tourist_stay_dates')) {
          throw new ReservationError(
            'You already have a request for these dates',
            'DUPLICATE',
            409,
          );
        }
        if (isUniqueViolation(err, 'reservations_reference_code_key') && attempt < 4) {
          continue;
        }
        throw err;
      }
    }
    if (!inserted) throw new ReservationError('Could not create reservation', 'CONFLICT', 409);

    try {
      await occupyStayNights(client, {
        reservationId: inserted.id as string,
        stayId: stay.id,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
      });
    } catch (err) {
      if (err instanceof StayInventoryError) {
        throw new ReservationError(err.message, err.code === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'NOT_FOUND', err.code === 'UNAVAILABLE' ? 409 : 400);
      }
      throw err;
    }

    await client.query('commit');
    return mapReservation(inserted);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

async function transitionAndRelease(
  pool: Pool,
  input: {
    reservationId: string;
    from: Reservation['status'][];
    to: Reservation['status'];
    actor: { touristId?: string; merchantId?: string };
    note?: string;
  },
): Promise<Reservation> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const current = await client.query(
      `${SELECT_RESERVATION} where id = $1 for update`,
      [input.reservationId],
    );
    const row = current.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new ReservationError('Reservation not found', 'NOT_FOUND', 404);
    if (input.actor.touristId && row.tourist_id !== input.actor.touristId) {
      throw new ReservationError('Reservation not found', 'NOT_FOUND', 404);
    }
    if (input.actor.merchantId && row.merchant_id !== input.actor.merchantId) {
      throw new ReservationError('Reservation not found', 'NOT_FOUND', 404);
    }
    if (!input.from.includes(row.status as Reservation['status'])) {
      throw new ReservationError(
        `Reservation is ${row.status as string}`,
        'CONFLICT',
        409,
      );
    }
    const updated = await client.query(
      `update reservations
          set status = $2,
              hold_expires_at = case when $2 = 'requested' then hold_expires_at else null end,
              note = coalesce($3, note),
              updated_at = now()
        where id = $1
        returning id, stay_id, merchant_id, tourist_id, check_in, check_out,
                  guests, nightly_price_minor, currency, status, reference_code,
                  hold_expires_at, note, idempotency_key, created_at, updated_at`,
      [input.reservationId, input.to, input.note ?? null],
    );
    await releaseStayNights(client, input.reservationId);
    await client.query('commit');
    return mapReservation(updated.rows[0] as Record<string, unknown>);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmStayReservation(
  pool: Pool,
  input: { reservationId: string; merchantId: string },
): Promise<Reservation> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await expireStaleHoldsOnClient(client);
    const current = await client.query(
      `${SELECT_RESERVATION} where id = $1 for update`,
      [input.reservationId],
    );
    const row = current.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new ReservationError('Reservation not found', 'NOT_FOUND', 404);
    if (row.merchant_id !== input.merchantId) {
      throw new ReservationError('Reservation not found', 'NOT_FOUND', 404);
    }
    if (row.status !== 'requested') {
      throw new ReservationError(`Reservation is ${row.status as string}`, 'CONFLICT', 409);
    }
    const updated = await client.query(
      `update reservations
          set status = 'confirmed', hold_expires_at = null, updated_at = now()
        where id = $1 and status = 'requested'
        returning id, stay_id, merchant_id, tourist_id, check_in, check_out,
                  guests, nightly_price_minor, currency, status, reference_code,
                  hold_expires_at, note, idempotency_key, created_at, updated_at`,
      [input.reservationId],
    );
    if (updated.rowCount !== 1) {
      throw new ReservationError('Reservation is no longer requested', 'CONFLICT', 409);
    }
    await client.query('commit');
    return mapReservation(updated.rows[0] as Record<string, unknown>);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function declineStayReservation(
  pool: Pool,
  input: { reservationId: string; merchantId: string; reason?: string },
): Promise<Reservation> {
  return transitionAndRelease(pool, {
    reservationId: input.reservationId,
    from: ['requested'],
    to: 'declined',
    actor: { merchantId: input.merchantId },
    ...(input.reason ? { note: input.reason } : {}),
  });
}

export async function cancelStayReservation(
  pool: Pool,
  input: { reservationId: string; touristId: string },
): Promise<Reservation> {
  return transitionAndRelease(pool, {
    reservationId: input.reservationId,
    from: ['requested', 'confirmed'],
    to: 'cancelled',
    actor: { touristId: input.touristId },
  });
}

export async function listTouristReservations(
  pool: Pool,
  touristId: string,
): Promise<Reservation[]> {
  await expireStaleHolds(pool);
  const res = await pool.query(
    `${SELECT_RESERVATION} where tourist_id = $1 order by created_at desc`,
    [touristId],
  );
  return res.rows.map((row) => mapReservation(row as Record<string, unknown>));
}

export async function listMerchantReservations(
  pool: Pool,
  merchantId: string,
): Promise<Reservation[]> {
  await expireStaleHolds(pool);
  const res = await pool.query(
    `${SELECT_RESERVATION} where merchant_id = $1 order by created_at desc`,
    [merchantId],
  );
  return res.rows.map((row) => mapReservation(row as Record<string, unknown>));
}
