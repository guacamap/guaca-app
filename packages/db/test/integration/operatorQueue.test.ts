import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { pendingOperatorQueue } from '../../src/operatorQueue.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_op_queue';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const PLACE_ID = '00000000-0000-4000-8000-0000000000d1';

describe('pendingOperatorQueue', () => {
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
        `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status)
         values ($1, $2, 'Arepera La Guacamaya', 'eat_drink', 'Casa amarilla',
           ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
           '8a0000000000000', 'spotter', 'provisional')`,
        [PLACE_ID, AREA_ID],
      );
      // One run needing an operator, one already decided by agent.
      await client.query(
        `insert into verification_runs (place_id, checks, decision, decided_by) values
          ($1, '{"geo":"INCONCLUSIVE"}'::jsonb, 'needs_operator', 'agent'),
          ($1, '{"vision":"ok"}'::jsonb, 'needs_second_local', 'agent'),
          ($1, '{"vision":"ok"}'::jsonb, 'needs_operator', 'operator')`,
        [PLACE_ID],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('returns only agent-decided needs_operator runs, oldest first', async () => {
    const items = await pendingOperatorQueue(pool);
    expect(items).toHaveLength(1);
    expect(items[0]!.decision).toBe('needs_operator');
    expect(items[0]!.placeName).toBe('Arepera La Guacamaya');
    expect(items[0]!.checks).toEqual({ geo: 'INCONCLUSIVE' });
  });
});
