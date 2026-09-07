import type { PoolClient } from 'pg';

export class StayInventoryError extends Error {
  constructor(
    message: string,
    readonly code: 'UNAVAILABLE' | 'NOT_FOUND',
  ) {
    super(message);
    this.name = 'StayInventoryError';
  }
}

/** Half-open [checkIn, checkOut) as UTC calendar dates. */
export function stayNights(checkIn: string, checkOut: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    throw new StayInventoryError('checkIn and checkOut must be YYYY-MM-DD', 'NOT_FOUND');
  }
  if (checkOut <= checkIn) {
    throw new StayInventoryError('checkOut must be after checkIn', 'NOT_FOUND');
  }
  const nights: string[] = [];
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

/**
 * Hold every night in [checkIn, checkOut) for a reservation. Caller must
 * already be inside a transaction. Locks inventory rows in date order.
 * reserved_count <= allotment and unique (stay_id, night_date, slot) both
 * reject a last-room double book.
 */
export async function occupyStayNights(
  client: PoolClient,
  input: { reservationId: string; stayId: string; checkIn: string; checkOut: string },
): Promise<{ nights: number }> {
  const nights = stayNights(input.checkIn, input.checkOut);
  for (const night of nights) {
    const row = await client.query<{ allotment: number; reserved_count: number }>(
      `select allotment, reserved_count from stay_inventory
        where stay_id = $1 and night_date = $2::date
        for update`,
      [input.stayId, night],
    );
    const inv = row.rows[0];
    if (!inv || inv.reserved_count >= inv.allotment) {
      throw new StayInventoryError(`No allotment left on ${night}`, 'UNAVAILABLE');
    }
    const slot = inv.reserved_count + 1;
    await client.query(
      `insert into reservation_nights (reservation_id, stay_id, night_date, slot)
       values ($1, $2, $3::date, $4)`,
      [input.reservationId, input.stayId, night, slot],
    );
    const bumped = await client.query(
      `update stay_inventory
          set reserved_count = reserved_count + 1
        where stay_id = $1 and night_date = $2::date and reserved_count < allotment
        returning reserved_count`,
      [input.stayId, night],
    );
    if (bumped.rowCount !== 1) {
      throw new StayInventoryError(`No allotment left on ${night}`, 'UNAVAILABLE');
    }
  }
  return { nights: nights.length };
}

/** Release held nights exactly once. Safe to call on a reservation with none. */
export async function releaseStayNights(
  client: PoolClient,
  reservationId: string,
): Promise<number> {
  const held = await client.query<{ stay_id: string; night_date: string }>(
    `delete from reservation_nights where reservation_id = $1
     returning stay_id, night_date`,
    [reservationId],
  );
  for (const night of held.rows) {
    await client.query(
      `update stay_inventory
          set reserved_count = reserved_count - 1
        where stay_id = $1 and night_date = $2::date and reserved_count > 0`,
      [night.stay_id, night.night_date],
    );
  }
  return held.rowCount ?? 0;
}
