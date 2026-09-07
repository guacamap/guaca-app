import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { migrate } from '../../src/migrate.js';
import { seedPuertoCabello } from '../../src/seed/puertoCabello.js';
import { seedCartagena } from '../../src/seed/cartagena.js';
import { seedScenario, SCENARIO_IDS } from '../../src/seed/scenario.js';
import { PC_MISSION_OSM } from '../../src/seed/puertoCabelloMissions.js';
import { checkScenario, resetScenario } from '../../src/seed/scenarioLifecycle.js';
import { rewardBalance } from '../../src/rewards.js';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.js';

const name = `guaca_recording_pcmissions_${process.pid}`;
let pool: Pool;

describe('Puerto Cabello recording missions', () => {
  beforeAll(async () => {
    pool = await createTempDb(name);
    const client = await pool.connect();
    try {
      await migrate(client);
    } finally {
      client.release();
    }
    await seedPuertoCabello(pool);
    await seedCartagena(pool);
    await seedScenario(pool);
  }, 60000);

  afterAll(async () => {
    await dropTempDb(name, pool);
  });

  it('seeds four offered, one accepted, two awaiting a second local, three completed', async () => {
    const alejandro = await pool.query<{ id: string }>(
      `select id from spotters where email = $1`,
      ['viajero@guaca.live'],
    );
    expect(alejandro.rows).toHaveLength(1);
    const aid = alejandro.rows[0]!.id;

    const byStatus = await pool.query<{ status: string; n: number; owner: string }>(
      `select m.status, count(*)::int as n,
              case when m.spotter_id = $1 then 'alejandro' else 'other' end as owner
         from missions m
        where m.id = any($2::uuid[])
        group by 1, 3
        order by 1, 3`,
      [aid, Object.values(SCENARIO_IDS.pcMissions)],
    );
    const key = (s: string, o: string) => `${s}:${o}`;
    const counts = Object.fromEntries(byStatus.rows.map((r) => [key(r.status, r.owner), r.n]));
    expect(counts['offered:alejandro']).toBe(4);
    expect(counts['accepted:alejandro']).toBe(1);
    expect(counts['submitted:other']).toBe(2);
    expect(counts['verified:alejandro']).toBe(3);
    expect(counts['submitted:alejandro']).toBeUndefined();
    expect(counts['verified:other']).toBeUndefined();
  });

  it('keeps public listings as candidates and never lets Alejandro confirm his own work', async () => {
    const listed = await pool.query<{ name: string; verification_status: string; witness_count: number }>(
      `select p.name, p.verification_status, p.witness_count
         from places p
        where p.osm_id = any($1::bigint[])`,
      [[
        PC_MISSION_OSM.breakfast,
        PC_MISSION_OSM.entrance,
        PC_MISSION_OSM.beach,
        PC_MISSION_OSM.fortin,
        PC_MISSION_OSM.accepted,
        PC_MISSION_OSM.witnessA,
        PC_MISSION_OSM.witnessB,
        ...PC_MISSION_OSM.completed,
        ...PC_MISSION_OSM.unverified,
      ]],
    );
    expect(listed.rows.length).toBeGreaterThanOrEqual(10);
    for (const row of listed.rows) {
      expect(row.verification_status).toBe('candidate');
      expect(row.witness_count).toBe(0);
    }

    const self = await pool.query<{ n: number }>(
      `select count(*)::int as n from missions
        where id = any($1::uuid[])
          and status = 'submitted'
          and spotter_id = (select id from spotters where email = 'viajero@guaca.live')`,
      [Object.values(SCENARIO_IDS.pcMissions)],
    );
    expect(self.rows[0]!.n).toBe(0);
  });

  it('credits Alejandro a matching ledger for the three completed checks', async () => {
    const aid = (await pool.query<{ id: string }>(
      `select id from spotters where email = $1`,
      ['viajero@guaca.live'],
    )).rows[0]!.id;
    const pts = await rewardBalance(pool, aid);
    expect(pts).toBe(360);
    const rows = await pool.query<{ n: number }>(
      `select count(*)::int as n from reward_ledger
        where spotter_id = $1 and reason = 'completed_local_check'`,
      [aid],
    );
    expect(rows.rows[0]!.n).toBe(3);
  });

  it('leaves four public listings without a mission', async () => {
    const rows = await pool.query<{ n: number }>(
      `select count(*)::int as n from places p
         join areas a on a.id = p.area_id
        where a.slug = 'puerto-cabello'
          and p.verification_status = 'candidate'
          and p.osm_id = any($1::bigint[])
          and not exists (
            select 1 from missions m where m.result_place_id = p.id
          )`,
      [PC_MISSION_OSM.unverified],
    );
    expect(rows.rows[0]!.n).toBe(4);
  });

  it('is idempotent and reset restores the same Puerto Cabello mission counts', async () => {
    const second = await seedScenario(pool);
    expect(second.pcMissions).toBe(0);
    const reset = await resetScenario(pool, 'deck-2026-09-12');
    expect(reset.ok).toBe(true);
    expect(reset.pcOffered).toBe(4);
    expect(reset.pcAccepted).toBe(1);
    expect(reset.pcWitness).toBe(2);
    expect(reset.pcCompleted).toBe(3);
    expect(reset.pcUnverified).toBe(4);
    expect(reset.alejandroPts).toBe(360);
  });
});
