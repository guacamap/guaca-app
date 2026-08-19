import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import { createTrip, listTrips, tripById, tripBySlug, deleteTrip } from '../../src/tripsDb.ts';
import { deleteTourist, upsertTouristLoginCode } from '../../src/tourists.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_trips_db';

const STOP = {
  placeId: '00000000-0000-4000-8000-0000000000d1',
  dayIndex: 0,
  startMin: 540,
  durationMin: 60,
  reasonCode: 'MATCHES_TOPIC' as const,
};

describe('trips table — CRUD and erasure', () => {
  let pool: pg.Pool;
  let touristId: string;
  let slug: string;
  let tripId: string;

  beforeAll(async () => {
    pool = await createTempDb(DB);
    const c = await pool.connect();
    await migrate(c);
    c.release();

    const email = 'traveler@example.com';
    const row0 = await upsertTouristLoginCode(pool, {
      email,
      codeHash: 'h',
      expiresAt: new Date(Date.now() + 60_000),
    });
    touristId = row0.id;

    const trip = await createTrip(pool, {
      touristId,
      question: 'two days of arepas',
      language: 'en',
      stops: [STOP],
    });
    slug = trip.shareSlug;
    tripId = trip.id;
  });
  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('round-trips stops through jsonb with the shared schema intact', async () => {
    const mine = await listTrips(pool, touristId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.stops).toEqual([STOP]);
    const byId = await tripById(pool, tripId, touristId);
    expect(byId?.shareSlug).toBe(slug);
    // Owner scoping: a different tourist sees nothing.
    expect(await tripById(pool, tripId, '00000000-0000-4000-8000-00000000beef')).toBeNull();
  });

  it('share links are public and read-only', async () => {
    const t = await tripBySlug(pool, slug);
    expect(t?.id).toBe(tripId);
  });

  it('deleteTourist cascades: the trip AND its public link die with the account', async () => {
    await deleteTourist(pool, touristId);
    expect(await tripBySlug(pool, slug)).toBeNull();
    expect(await listTrips(pool, touristId)).toHaveLength(0);
  });

  it('deleteTrip is owner-scoped and idempotent-false for strangers', async () => {
    // Recreate a second tourist + trip for the ownership check.
    const email = 'second@example.com';
    const row1 = await upsertTouristLoginCode(pool, {
      email,
      codeHash: 'h',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const t2 = await createTrip(pool, {
      touristId: row1.id,
      question: 'q',
      language: 'en',
      stops: [STOP],
    });
    expect(await deleteTrip(pool, t2.id, '00000000-0000-4000-8000-00000000beef')).toBe(false);
    expect(await deleteTrip(pool, t2.id, row1.id)).toBe(true);
    expect(await deleteTrip(pool, t2.id, row1.id)).toBe(false);
  });
});
