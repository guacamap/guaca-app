import type { Pool } from 'pg';
import { rewardBalance } from '../rewards.js';
import {
  BEACH_OSM_ID,
  SCENARIO_CLOCK,
  SCENARIO_IDS,
  SCENARIO_KEY,
  SCENARIO_LEDGER_ROWS,
  SCENARIO_OBSERVATION_COPY,
  seedScenario,
} from './scenario.js';
import { PC_MISSION_OSM, pcGapIds, pcLedgerIds, pcMissionIds } from './puertoCabelloMissions.js';

const SPOTTER_IDS = [SCENARIO_IDS.spotters.lucia, SCENARIO_IDS.spotters.andres];
const PC_MISSION_IDS = pcMissionIds();
const PC_GAP_IDS = pcGapIds();
const PC_LEDGER_IDS = pcLedgerIds();
const PC_OBS_IDS = Object.values(SCENARIO_IDS.pcObservations);
const STAY_IDS = Object.values(SCENARIO_IDS.stays);
const PLACE_IDS = Object.values(SCENARIO_IDS.places);
const LEDGER_IDS = Object.values(SCENARIO_IDS.ledger);

export class ScenarioTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioTargetError';
  }
}

export interface ScenarioCheckpoint {
  stays: number;
  activities: number;
  spotters: number;
  luciaPts: number;
  andresPts: number;
  catalog: number;
  obsPending: number;
  openMissions: number;
  reservations: number;
  redemptions: number;
  pcOffered: number;
  pcAccepted: number;
  pcWitness: number;
  pcCompleted: number;
  pcUnverified: number;
  alejandroPts: number;
}

export const SCENARIO_CHECKPOINT: ScenarioCheckpoint = {
  stays: 3,
  activities: 10,
  spotters: 2,
  luciaPts: 450,
  andresPts: 80,
  catalog: 3,
  obsPending: 1,
  openMissions: 0,
  reservations: 0,
  redemptions: 0,
  pcOffered: 4,
  pcAccepted: 1,
  pcWitness: 2,
  pcCompleted: 3,
  pcUnverified: 4,
  alejandroPts: 360,
};

function assertResetAllowed(scenarioId: string): void {
  if (process.env.NODE_ENV === 'production') {
    throw new ScenarioTargetError('Scenario reset is refused in production.');
  }
  if (scenarioId !== SCENARIO_KEY) {
    throw new ScenarioTargetError(
      `Unknown scenario '${scenarioId}'. The only allowed target is ${SCENARIO_KEY}.`,
    );
  }
}

export async function checkScenario(pool: Pool): Promise<ScenarioCheckpoint & { ok: boolean }> {
  const counts = await pool.query<{ k: string; n: string }>(
    `select 'stays' as k, count(*)::text as n from stays s
      where s.id = any($1::uuid[])
     union all
     select 'activities', count(*)::text from activities where id = any($5::uuid[])
     union all
     select 'spotters', count(*)::text from spotters
      where id = any($2::uuid[])
     union all
     select 'catalog', count(*)::text from reward_catalog
      where id = any($3::uuid[])
     union all
     select 'obs_pending', count(*)::text from place_observations
      where id = $4
        and source_kind = 'pending_local_check'
        and status = 'active'
        and evidence_photo_url is null
     union all
     select 'open_missions', count(*)::text from missions
      where spotter_id = any($2::uuid[])
        and status in ('offered','accepted','submitted')
     union all
     select 'reservations', count(*)::text from reservations
      where stay_id = any($1::uuid[])
     union all
     select 'redemptions', count(*)::text from redemptions
      where spotter_id = any($2::uuid[])
     union all
     select 'pc_offered', count(*)::text from missions
      where id = any($6::uuid[]) and status = 'offered'
     union all
     select 'pc_accepted', count(*)::text from missions
      where id = any($6::uuid[]) and status = 'accepted'
     union all
     select 'pc_witness', count(*)::text from missions
      where id = any($6::uuid[]) and status = 'submitted'
     union all
     select 'pc_completed', count(*)::text from missions
      where id = any($6::uuid[]) and status = 'verified'
     union all
     select 'pc_unverified', count(*)::text from places p
      join areas a on a.id = p.area_id
      where a.slug = 'puerto-cabello'
        and p.verification_status = 'candidate'
        and p.osm_id = any($7::bigint[])
        and not exists (select 1 from missions m where m.result_place_id = p.id)`,
    [
      STAY_IDS,
      SPOTTER_IDS,
      [SCENARIO_IDS.rewards.cap, SCENARIO_IDS.rewards.bottle, SCENARIO_IDS.rewards.voucher],
      SCENARIO_IDS.observation,
      Object.values(SCENARIO_IDS.activities),
      PC_MISSION_IDS,
      [...PC_MISSION_OSM.unverified],
    ],
  );
  const alejandro = await pool.query<{ id: string }>(
    `select id from spotters where email = 'viajero@guaca.live'`,
  );
  const byKey = Object.fromEntries(counts.rows.map((row) => [row.k, Number(row.n)]));
  const snapshot: ScenarioCheckpoint = {
    stays: byKey.stays ?? 0,
    activities: byKey.activities ?? 0,
    spotters: byKey.spotters ?? 0,
    luciaPts: await rewardBalance(pool, SCENARIO_IDS.spotters.lucia),
    andresPts: await rewardBalance(pool, SCENARIO_IDS.spotters.andres),
    catalog: 0,
    obsPending: 0,
    openMissions: 0,
    reservations: 0,
    redemptions: 0,
    pcOffered: 0,
    pcAccepted: 0,
    pcWitness: 0,
    pcCompleted: 0,
    pcUnverified: 0,
    alejandroPts: alejandro.rows[0] ? await rewardBalance(pool, alejandro.rows[0].id) : 0,
  };
  snapshot.catalog = byKey.catalog ?? 0;
  snapshot.obsPending = byKey.obs_pending ?? 0;
  snapshot.openMissions = byKey.open_missions ?? 0;
  snapshot.reservations = byKey.reservations ?? 0;
  snapshot.redemptions = byKey.redemptions ?? 0;
  snapshot.pcOffered = byKey.pc_offered ?? 0;
  snapshot.pcAccepted = byKey.pc_accepted ?? 0;
  snapshot.pcWitness = byKey.pc_witness ?? 0;
  snapshot.pcCompleted = byKey.pc_completed ?? 0;
  snapshot.pcUnverified = byKey.pc_unverified ?? 0;
  const ok = (Object.keys(SCENARIO_CHECKPOINT) as Array<keyof ScenarioCheckpoint>)
    .every((key) => snapshot[key] === SCENARIO_CHECKPOINT[key]);
  return { ...snapshot, ok };
}

/**
 * Destructive, scoped to the recording fixtures. Leaves Puerto Cabello and
 * Cartagena public catalogs, photos, and the showcase tourist's saved
 * places and trips untouched. Never truncates places.
 */
export async function resetScenario(pool: Pool, scenarioId: string): Promise<ScenarioCheckpoint & { ok: boolean }> {
  assertResetAllowed(scenarioId);
  const target = await pool.query<{ name: string }>('select current_database() as name');
  if (!/^guaca_recording(?:_[a-z0-9]+)*$/.test(target.rows[0]?.name ?? '')) {
    throw new ScenarioTargetError('Reset requires a dedicated guaca_recording database (optional _suffix). The working database is never a reset target.');
  }
  const client = await pool.connect();
  try {
    await client.query('begin');

    const beach = await client.query<{ id: string }>(
      `select p.id from places p
         join areas a on a.id = p.area_id
        where a.slug = 'cartagena' and p.osm_id = $1`,
      [BEACH_OSM_ID],
    );
    const beachId = beach.rows[0]?.id ?? null;

    await client.query(
      `delete from merchant_actions
        where reservation_id in (select id from reservations where stay_id = any($1::uuid[]))
           or stay_id = any($1::uuid[])`,
      [STAY_IDS],
    );
    await client.query(
      `delete from reservation_nights
        where stay_id = any($1::uuid[])
           or reservation_id in (select id from reservations where stay_id = any($1::uuid[]))`,
      [STAY_IDS],
    );
    await client.query(`delete from reservations where stay_id = any($1::uuid[])`, [STAY_IDS]);
    await client.query(
      `update stay_inventory set reserved_count = 0 where stay_id = any($1::uuid[])`,
      [STAY_IDS],
    );

    await client.query(`delete from redemptions where spotter_id = any($1::uuid[])`, [SPOTTER_IDS]);
    await client.query(
      `delete from reward_ledger
        where spotter_id = any($1::uuid[])
          and id <> all($2::uuid[])`,
      [SPOTTER_IDS, LEDGER_IDS],
    );

    await client.query(
      `delete from payouts
        where spotter_id = any($1::uuid[])
           or mission_id in (select id from missions where spotter_id = any($1::uuid[]))`,
      [SPOTTER_IDS],
    );
    await client.query(`delete from missions where spotter_id = any($1::uuid[])`, [SPOTTER_IDS]);
    await client.query(
      `delete from reward_ledger where id = any($1::uuid[]) or mission_id = any($2::uuid[])`,
      [PC_LEDGER_IDS, PC_MISSION_IDS],
    );
    await client.query(`delete from place_observations where id = any($1::uuid[])`, [PC_OBS_IDS]);
    await client.query(`delete from missions where id = any($1::uuid[])`, [PC_MISSION_IDS]);
    await client.query(`delete from gaps where id = any($1::uuid[])`, [PC_GAP_IDS]);

    await client.query(
      `delete from verification_runs
        where photo_id in (
          select id from place_photos where uploaded_by_spotter_id = any($1::uuid[])
        )`,
      [SPOTTER_IDS],
    );
    await client.query(
      `delete from place_photos where uploaded_by_spotter_id = any($1::uuid[])`,
      [SPOTTER_IDS],
    );

    if (beachId) {
      await client.query(
        `delete from place_observations
          where id <> $1
            and (place_id = $2 or place_id = any($3::uuid[]))
            and created_by = any($4::uuid[])`,
        [SCENARIO_IDS.observation, beachId, PLACE_IDS, SPOTTER_IDS],
      );
      await client.query(
        `update place_observations
            set kind = 'access',
                statement_en = $2,
                statement_es = $3,
                source_kind = 'pending_local_check',
                source_label = $4,
                observed_at = $5::timestamptz,
                valid_until = $6::timestamptz,
                status = 'active',
                evidence_photo_url = null,
                created_by = null
          where id = $1`,
        [
          SCENARIO_IDS.observation,
          SCENARIO_OBSERVATION_COPY.statementEn,
          SCENARIO_OBSERVATION_COPY.statementEs,
          SCENARIO_OBSERVATION_COPY.sourceLabel,
          SCENARIO_CLOCK.instant,
          SCENARIO_OBSERVATION_COPY.validUntil,
        ],
      );
    }

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }

  await seedScenario(pool);
  for (const row of SCENARIO_LEDGER_ROWS) {
    await pool.query(
      `insert into reward_ledger (id, spotter_id, delta, reason, mission_id, created_at)
       values ($1, $2, $3, $4, null, $5::timestamptz)
       on conflict (id) do nothing`,
      [row.id, row.spotterId, row.delta, row.reason, row.at],
    );
  }
  return checkScenario(pool);
}
