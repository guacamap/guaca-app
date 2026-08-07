import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { postEvent } from '../../src/events.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_events';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const VERIFIED = '00000000-0000-4000-8000-0000000000d1';
const CANDIDATE = '00000000-0000-4000-8000-0000000000d2';

describe('postEvent (T7.9)', () => {
  beforeAll(async () => {
    pool = await createTempDb(DB);
    const client = await pool.connect();
    try {
      await client.query('drop schema if exists public cascade');
      await client.query('create schema if not exists public');
      await migrate(client);
      await client.query(
        `insert into areas (id, name, slug, country, timezone, geom) values
          ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
           ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
        [AREA_ID],
      );
      await client.query(
        `insert into spotters (id, name, phone, area_id) values
          ('00000000-0000-4000-8000-0000000000c1', 'Yorman', '+58 412 000 0001', $1),
          ('00000000-0000-4000-8000-0000000000c2', 'María', '+58 412 000 0002', $1)`,
        [AREA_ID],
      );
      const insert = (id: string, status: string, creator?: string) =>
        client.query(
          `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id)
           values ($1, $2, 'Arepera La Guacamaya', 'eat_drink', 'Casa amarilla',
             ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
             '8a0000000000000', 'spotter', $3, $4, $5, $6)`,
          [id, AREA_ID, status, status === 'verified' ? 2 : 0,
           status === 'verified' ? '00000000-0000-4000-8000-0000000000c1' : null,
           status === 'verified' ? '00000000-0000-4000-8000-0000000000c2' : null],
        );
      await insert(VERIFIED, 'verified');
      await insert(CANDIDATE, 'candidate');
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('posts an event against a verified place', async () => {
    const r = await postEvent(pool, {
      placeId: VERIFIED,
      title: 'Noche de música en vivo',
      startsAt: new Date('2026-08-20T20:00:00Z'),
      endsAt: new Date('2026-08-20T23:00:00Z'),
      postedBy: 'Posada La Marina',
    });
    expect(r.ok).toBe(true);
    const row = await pool.query('select verification_status from events where id = $1', [r.eventId]);
    expect(row.rows[0]!.verification_status).toBe('pending');
  });

  it('rejects posting an event against a candidate place', async () => {
    const r = await postEvent(pool, {
      placeId: CANDIDATE,
      title: 'Feria',
      startsAt: new Date('2026-08-21T10:00:00Z'),
      endsAt: new Date('2026-08-21T18:00:00Z'),
      postedBy: 'Cualquiera',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/verified/i);
  });
});
