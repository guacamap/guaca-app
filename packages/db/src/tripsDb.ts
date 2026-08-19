import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { TripSchema, type Trip, type TripStop } from '@guaca/shared';

/**
 * Saved itineraries. A trip is a demand record with a shape: the question
 * that produced it, and the guard-minted stops that answered it. Erasure
 * cascades from tourists — the account holds the email, the trip and its
 * public share link die with it.
 */

function newShareSlug(): string {
  // URL-safe, unguessable, readable enough to paste into WhatsApp.
  return randomBytes(8).toString('base64url');
}

export interface CreateTripInput {
  touristId: string;
  question: string;
  language: string;
  stops: TripStop[];
}

async function insertTrip(
  pool: Pool,
  input: CreateTripInput,
  slug: string,
): Promise<Trip> {
  const res = await pool.query<{
    id: string;
    question: string;
    language: string;
    stops: unknown;
    share_slug: string;
    created_at: Date;
  }>(
    `insert into trips (tourist_id, question, language, stops, share_slug)
     values ($1, $2, $3, $4::jsonb, $5)
     returning id, question, language, stops, share_slug, created_at`,
    [
      input.touristId,
      input.question,
      input.language.slice(0, 2),
      JSON.stringify(input.stops),
      slug,
    ],
  );
  const r = res.rows[0]!;
  return TripSchema.parse({
    id: r.id,
    question: r.question,
    language: r.language,
    stops: r.stops,
    shareSlug: r.share_slug,
    createdAt: r.created_at.toISOString(),
  });
}

export async function createTrip(pool: Pool, input: CreateTripInput): Promise<Trip> {
  // 8 random bytes make collisions astronomical; the retry is for the
  // unique index, not the entropy.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await insertTrip(pool, input, newShareSlug());
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('trips_share_slug_key')) throw e;
    }
  }
  throw new Error('share slug collision x3 — buy a lottery ticket');
}

function rowToTrip(r: {
  id: string;
  question: string;
  language: string;
  stops: unknown;
  share_slug: string;
  created_at: Date;
}): Trip {
  return TripSchema.parse({
    id: r.id,
    question: r.question,
    language: r.language,
    stops: r.stops,
    shareSlug: r.share_slug,
    createdAt: r.created_at.toISOString(),
  });
}

const TRIP_COLUMNS = 'id, question, language, stops, share_slug, created_at';

/** A tourist's trips, newest first. */
export async function listTrips(pool: Pool, touristId: string): Promise<Trip[]> {
  const res = await pool.query(
    `select ${TRIP_COLUMNS} from trips where tourist_id = $1 order by created_at desc limit 50`,
    [touristId],
  );
  return res.rows.map(rowToTrip);
}

/** Owner-scoped read — one tourist cannot enumerate another's trips. */
export async function tripById(
  pool: Pool,
  tripId: string,
  touristId: string,
): Promise<Trip | null> {
  const res = await pool.query(
    `select ${TRIP_COLUMNS} from trips where id = $1 and tourist_id = $2`,
    [tripId, touristId],
  );
  return res.rows[0] ? rowToTrip(res.rows[0]) : null;
}

/**
 * The public share view — no auth, no owner: anyone holding the link reads
 * the trip (stops reference verified places only; nothing personal is in a
 * trip). Read-only by construction: there is no update path anywhere.
 */
export async function tripBySlug(pool: Pool, slug: string): Promise<Trip | null> {
  const res = await pool.query(
    `select ${TRIP_COLUMNS} from trips where share_slug = $1`,
    [slug],
  );
  return res.rows[0] ? rowToTrip(res.rows[0]) : null;
}

export async function deleteTrip(
  pool: Pool,
  tripId: string,
  touristId: string,
): Promise<boolean> {
  const res = await pool.query(
    'delete from trips where id = $1 and tourist_id = $2',
    [tripId, touristId],
  );
  return (res.rowCount ?? 0) > 0;
}
