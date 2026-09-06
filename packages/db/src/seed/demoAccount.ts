import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { groundFromVerifiedRows } from '@guaca/agents';
import { TripStopSchema } from '@guaca/shared';
import { PUERTO_CABELLO_PROFILES } from './puertoCabello.js';

export const DEMO_TRAVELLER_EMAIL = 'viajero@guaca.live';
const TRIP_ID = 'e23cbabb-80a4-4aa8-85bc-f95594f10c70';

/** A real account and persistent saved itinerary, not reviews or witness evidence.
 * Run explicitly after the public place seed. Never changes login credentials. */
export async function seedDemoAccount(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const places = await client.query<{ id: string; osm_id: string }>(
      `select id, osm_id from places where area_id = $1 and osm_id = any($2::bigint[])
         and ((verification_status = 'candidate' and corroboration >= 1)
           or (verification_status = 'verified' and witness_count >= 2))`,
      ['00000000-0000-4000-8000-00000000000a', PUERTO_CABELLO_PROFILES.map((p) => p.osmId)],
    );
    const byOsm = new Map(places.rows.map((p) => [Number(p.osm_id), p.id]));
    if (byOsm.size !== PUERTO_CABELLO_PROFILES.length) {
      throw new Error('Seed Puerto Cabello first: all eight eligible public profiles are required.');
    }
    const account = await client.query<{ id: string }>(
      `insert into tourists (email, language) values ($1, 'es')
       on conflict (email) do update set email = excluded.email returning id`,
      [DEMO_TRAVELLER_EMAIL],
    );
    const touristId = account.rows[0]!.id;
    await client.query(
      `insert into tourist_favorites (tourist_id, place_id)
       select $1, unnest($2::uuid[]) on conflict do nothing`,
      [touristId, places.rows.map((p) => p.id)],
    );
    // A curated day using actual catalog IDs; suggested times, no opening-hour claims.
    const stops = [
      { osmId: 1482081795, startMin: 9 * 60, durationMin: 60 },
      { osmId: 157189923, startMin: 10 * 60 + 30, durationMin: 45 },
      { osmId: 13588404801, startMin: 12 * 60, durationMin: 90 },
      { osmId: 203615814, startMin: 15 * 60, durationMin: 60 },
    ].map(({ osmId, ...timing }) => TripStopSchema.parse({
      placeId: byOsm.get(osmId), dayIndex: 0, ...timing, reasonCode: 'SEQUENCE_FIT',
    }));
    groundFromVerifiedRows(stops, new Set(places.rows.map((p) => p.id)));
    await client.query(
      `insert into trips (id, tourist_id, question, language, stops, share_slug)
       values ($1, $2, 'Un día entre historia, plazas y sabores de Puerto Cabello', 'es', $3::jsonb, $4)
       on conflict (id) do nothing`,
      [TRIP_ID, touristId, JSON.stringify(stops), randomBytes(8).toString('base64url')],
    );
    const trip = await client.query<{ share_slug: string }>(
      'select share_slug from trips where id = $1 and tourist_id = $2', [TRIP_ID, touristId],
    );
    if (!trip.rows[0]) throw new Error('The starter trip ID belongs to another account; no data was changed.');
    await client.query('commit');
    return { email: DEMO_TRAVELLER_EMAIL, touristId, savedPlaces: places.rows.length, shareSlug: trip.rows[0].share_slug };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
