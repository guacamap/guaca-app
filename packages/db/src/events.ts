import type { Pool } from 'pg';

export interface PostEventInput {
  placeId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  postedBy: string;
  description?: string;
}

export interface PostEventResult {
  ok: boolean;
  eventId?: string;
  reason?: string;
}

/**
 * T7.9 — a business posts a time-bound event attached to an EXISTING
 * verified place (never creating a new place — a self-posted venue is not a
 * witnessed one). Events land `pending` and appear in the operator queue.
 */
export async function postEvent(
  pool: Pool,
  input: PostEventInput,
): Promise<PostEventResult> {
  const place = await pool.query<{ verification_status: string }>(
    'select verification_status from places where id = $1',
    [input.placeId],
  );
  if (place.rows.length === 0) return { ok: false, reason: 'place not found' };
  if (place.rows[0]!.verification_status !== 'verified') {
    return { ok: false, reason: 'events may only attach to verified places' };
  }

  const res = await pool.query<{ id: string }>(
    `insert into events (place_id, title, description, starts_at, ends_at, posted_by, verification_status)
     values ($1, $2, $3, $4, $5, $6, 'pending')
     returning id`,
    [input.placeId, input.title, input.description ?? null, input.startsAt, input.endsAt, input.postedBy],
  );
  return { ok: true, eventId: res.rows[0]!.id };
}
