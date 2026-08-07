import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/migrate.ts';
import { operatorVerify } from '../../src/operatorVerify.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_op_verify';
let pool: import('pg').Pool;

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const PLACE_ID = '00000000-0000-4000-8000-0000000000d1';
const RUN_ID = '00000000-0000-4000-8000-0000000000e1';

describe('operatorVerify (T6.2)', () => {
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
          ('00000000-0000-4000-8000-0000000000c1', 'Yorman', '+58 412 000 0001', $1)`,
        [AREA_ID],
      );
      await client.query(
        `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source, verification_status, witness_count, created_by_spotter_id)
         values ($1, $2, 'Arepera La Guacamaya', 'eat_drink', 'Casa amarilla',
           ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography,
           '8a0000000000000', 'spotter', 'provisional', 1, '00000000-0000-4000-8000-0000000000c1')`,
        [PLACE_ID, AREA_ID],
      );
      await client.query(
        `insert into verification_runs (id, place_id, checks, decision, decided_by)
         values ($1, $2, '{}'::jsonb, 'needs_operator', 'agent')`,
        [RUN_ID, PLACE_ID],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('an approval flips status and writes exactly one audit row with before/after state', async () => {
    const r = await operatorVerify(pool, RUN_ID, 'APPROVE', 'ops-lead', 'looks real');
    expect(r.ok).toBe(true);

    const run = await pool.query(
      'select decision, decided_by from verification_runs where id = $1',
      [RUN_ID],
    );
    expect(run.rows[0]!.decision).toBe('verified');
    expect(run.rows[0]!.decided_by).toBe('operator');

    const place = await pool.query(
      'select verification_status from places where id = $1',
      [PLACE_ID],
    );
    // Operator overrides the process, not the two-witness rule: without a
    // second local the place stays provisional.
    expect(place.rows[0]!.verification_status).toBe('provisional');

    const audit = await pool.query(
      `select action, before_state, after_state from operator_actions where target_id = $1`,
      [RUN_ID],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]!.action).toBe('verify.approve');
    expect(audit.rows[0]!.before_state.decision).toBe('needs_operator');
    expect(audit.rows[0]!.after_state.decision).toBe('provisional');
  });
});
