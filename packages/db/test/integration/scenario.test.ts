import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { migrate } from '../../src/migrate.js';
import { seedPuertoCabello } from '../../src/seed/puertoCabello.js';
import { seedCartagena } from '../../src/seed/cartagena.js';
import { seedScenario, SCENARIO_IDS, SCENARIO_CLOCK, SCENARIO_KEY } from '../../src/seed/scenario.js';
import { checkScenario, resetScenario, SCENARIO_CHECKPOINT, ScenarioTargetError } from '../../src/seed/scenarioLifecycle.js';
import { occupyStayNights, StayInventoryError } from '../../src/stays.js';
import { currentObservations } from '../../src/observations.js';
import { rewardBalance } from '../../src/rewards.js';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.js';

const name = `guaca_recording_scenario_${process.pid}`;
let pool: Pool;

const SCENARIO_PLACE_IDS = Object.values(SCENARIO_IDS.places);

interface PlaceFingerprint {
  id: string;
  name: string;
  category: string;
  verification_status: string;
  witness_count: number;
  updated_at: string;
  public_profile: unknown;
}

async function fingerprintExisting(): Promise<{ count: number; rows: PlaceFingerprint[] }> {
  const res = await pool.query<PlaceFingerprint>(
    `select id, name, category, verification_status, witness_count,
            updated_at::text, public_profile
       from places
      where id <> all($1::uuid[])
      order by id`,
    [SCENARIO_PLACE_IDS],
  );
  return { count: res.rows.length, rows: res.rows };
}

describe('Recording scenario seed', () => {
  let before: { count: number; rows: PlaceFingerprint[] };

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
    before = await fingerprintExisting();
  }, 60000);

  afterAll(async () => {
    await dropTempDb(name, pool);
  });

  it('is additive and idempotent, and leaves Puerto Cabello and Cartagena rows unchanged', async () => {
    const first = await seedScenario(pool);
    expect(first.stays).toBe(3);
    expect(first.activities).toBe(10);
    expect(first.observations).toBe(1);
    expect(first.spotters).toBe(2);
    expect(first.ledgerEntries).toBe(4);
    expect(first.catalogItems).toBe(3);
    expect(first.entitlements).toBe(1);
    expect(first.licenses).toBe(1);
    expect(first.pcMissions).toBe(10);

    const second = await seedScenario(pool);
    expect(second.stays).toBe(0);
    expect(second.pcMissions).toBe(0);
    expect(second.activities).toBe(0);
    expect(second.observations).toBe(0);
    expect(second.spotters).toBe(0);
    expect(second.ledgerEntries).toBe(0);

    const after = await fingerprintExisting();
    expect(after.count).toBe(before.count);
    expect(after.rows).toEqual(before.rows);
  });

  it('seeds three Cartagena stays on the lodging category with distinct price bands', async () => {
    const stays = await pool.query<{
      name: string;
      category: string;
      price_band: number;
      nightly_price_minor: number;
      verification_status: string;
      witness_count: number;
      inside: boolean;
    }>(
      `select p.name, p.category, p.price_band, s.nightly_price_minor,
              p.verification_status, p.witness_count,
              ST_Covers(a.geom, p.location) as inside
         from stays s
         join places p on p.id = s.place_id
         join areas a on a.id = p.area_id
        where s.id = any($1::uuid[])
        order by p.price_band`,
      [Object.values(SCENARIO_IDS.stays)],
    );
    expect(stays.rows).toHaveLength(3);
    expect(stays.rows.map((r) => r.price_band)).toEqual([1, 2, 3]);
    expect(new Set(stays.rows.map((r) => r.nightly_price_minor)).size).toBe(3);
    for (const row of stays.rows) {
      expect(row.category).toBe('lodging');
      expect(row.verification_status).toBe('candidate');
      expect(row.witness_count).toBe(0);
      expect(row.inside).toBe(true);
    }
  });

  it('seeds activities, a pending beach observation, catalog, ledger, entitlement and license', async () => {
    const activities = await pool.query<{ n: number; cartagena: number }>(
      `select count(*)::int as n,
              count(*) filter (where area_id = (select id from areas where slug = 'cartagena'))::int as cartagena
         from activities`,
    );
    expect(activities.rows[0]!.n).toBe(10);
    expect(activities.rows[0]!.cartagena).toBeGreaterThanOrEqual(6);

    const obs = await pool.query<{ source_kind: string; status: string; name: string }>(
      `select o.source_kind, o.status, p.name
         from place_observations o
         join places p on p.id = o.place_id
        where o.id = $1`,
      [SCENARIO_IDS.observation],
    );
    expect(obs.rows[0]).toMatchObject({
      source_kind: 'pending_local_check',
      status: 'active',
      name: 'Playa de Marbella',
    });
    const current = await currentObservations(pool, (await pool.query<{ place_id: string }>(
      `select place_id from place_observations where id = $1`,
      [SCENARIO_IDS.observation],
    )).rows[0]!.place_id);
    expect(current.some((row) => row.id === SCENARIO_IDS.observation)).toBe(true);

    expect(await rewardBalance(pool, SCENARIO_IDS.spotters.lucia)).toBe(450);
    expect(await rewardBalance(pool, SCENARIO_IDS.spotters.andres)).toBe(80);

    const catalog = await pool.query<{ slug: string }>(
      `select slug from reward_catalog order by point_cost`,
    );
    expect(catalog.rows.map((r) => r.slug)).toEqual([
      'guaca-cap',
      'guaca-bottle',
      'local-experience-voucher',
    ]);

    const entitlement = await pool.query<{ plan_code: string; status: string }>(
      `select plan_code, status from tourist_entitlements`,
    );
    expect(entitlement.rows[0]).toEqual({ plan_code: 'explorer', status: 'active' });

    const license = await pool.query<{ visibility: string; status: string }>(
      `select visibility, status from merchant_zone_licenses where id = $1`,
      [SCENARIO_IDS.license],
    );
    expect(license.rows[0]).toEqual({ visibility: 'standard', status: 'active' });

    const membership = await pool.query<{ role: string }>(
      `select role from merchant_memberships where id = $1`,
      [SCENARIO_IDS.membership],
    );
    expect(membership.rows[0]!.role).toBe('owner');
  });

  it('rejects overlapping nights at SQL level when the last room is taken', async () => {
    const tourist = await pool.query<{ id: string }>(
      `insert into tourists (email, language) values ('overlap@scenario.guaca.live', 'en')
       on conflict (email) do update set email = excluded.email
       returning id`,
    );
    const touristId = tourist.rows[0]!.id;
    const stayId = SCENARIO_IDS.stays.casaBaluarte;
    const merchantId = SCENARIO_IDS.merchant;

    const first = await pool.connect();
    try {
      await first.query('begin');
      const res = await first.query<{ id: string }>(
        `insert into reservations (
           stay_id, merchant_id, tourist_id, check_in, check_out, guests,
           nightly_price_minor, currency, status, reference_code, hold_expires_at
         ) values ($1, $2, $3, '2026-09-12', '2026-09-14', 2, 18000, 'USD',
                   'requested', 'GUA-TEST1', now() + interval '30 minutes')
         returning id`,
        [stayId, merchantId, touristId],
      );
      await occupyStayNights(first, {
        reservationId: res.rows[0]!.id,
        stayId,
        checkIn: '2026-09-12',
        checkOut: '2026-09-14',
      });
      await first.query('commit');
    } catch (err) {
      await first.query('rollback');
      throw err;
    } finally {
      first.release();
    }

    const secondTourist = await pool.query<{ id: string }>(
      `insert into tourists (email, language) values ('overlap2@scenario.guaca.live', 'en')
       returning id`,
    );
    const second = await pool.connect();
    try {
      await second.query('begin');
      const res = await second.query<{ id: string }>(
        `insert into reservations (
           stay_id, merchant_id, tourist_id, check_in, check_out, guests,
           nightly_price_minor, currency, status, reference_code, hold_expires_at
         ) values ($1, $2, $3, '2026-09-13', '2026-09-15', 2, 18000, 'USD',
                   'requested', 'GUA-TEST2', now() + interval '30 minutes')
         returning id`,
        [stayId, merchantId, secondTourist.rows[0]!.id],
      );
      await expect(
        occupyStayNights(second, {
          reservationId: res.rows[0]!.id,
          stayId,
          checkIn: '2026-09-13',
          checkOut: '2026-09-15',
        }),
      ).rejects.toBeInstanceOf(StayInventoryError);
      await second.query('rollback');
    } finally {
      second.release();
    }

    await expect(
      pool.query(
        `insert into reservation_nights (reservation_id, stay_id, night_date, slot)
         select id, stay_id, '2026-09-12'::date, 1 from reservations where reference_code = 'GUA-TEST1'`,
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    await expect(
      pool.query(
        `update stay_inventory set reserved_count = reserved_count + 1
          where stay_id = $1 and night_date = '2026-09-12'::date`,
        [stayId],
      ),
    ).rejects.toThrow(/check/i);
  });

  it('stops describing an expired observation as current', async () => {
    const placeId = (await pool.query<{ place_id: string }>(
      `select place_id from place_observations where id = $1`,
      [SCENARIO_IDS.observation],
    )).rows[0]!.place_id;

    await pool.query(
      `insert into place_observations (
         id, place_id, kind, statement_en, statement_es, source_kind, source_label,
         observed_at, valid_until, status
       ) values (
         '00000000-0000-4000-8000-00000000ae99', $1, 'condition',
         'Yesterday the stairs were taped off.',
         'Ayer las escaleras estaban acordonadas.',
         'public_listing', 'Public listing',
         $2::timestamptz, $3::timestamptz, 'expired'
       )`,
      [placeId, '2026-09-01T12:00:00-05:00', '2026-09-02T12:00:00-05:00'],
    );

    const current = await currentObservations(pool, placeId);
    expect(current.some((row) => row.id === '00000000-0000-4000-8000-00000000ae99')).toBe(false);
    expect(current.some((row) => row.status === 'expired')).toBe(false);

    const clockNote = SCENARIO_CLOCK.timezone;
    expect(clockNote).toBe('America/Bogota');
  });

  it('refuses an unknown reset target', async () => {
    await expect(resetScenario(pool, 'not-a-scenario')).rejects.toBeInstanceOf(ScenarioTargetError);
  });

  it('resets take leftovers to the start checkpoint without touching public places', async () => {
    const before = await fingerprintExisting();
    await pool.query(
      `update place_observations
          set source_kind = 'locally_confirmed',
              source_label = 'Locally confirmed observation',
              evidence_photo_url = 'observations/take.jpg',
              created_by = $2
        where id = $1`,
      [SCENARIO_IDS.observation, SCENARIO_IDS.spotters.lucia],
    );
    await pool.query(
      `insert into reward_ledger (spotter_id, delta, reason)
       values ($1, 150, 'completed_local_check')`,
      [SCENARIO_IDS.spotters.lucia],
    );
    await pool.query(
      `insert into redemptions (spotter_id, catalog_id, points_spent, receipt_code)
       values ($1, $2, 200, 'RDM-TEST1')`,
      [SCENARIO_IDS.spotters.lucia, SCENARIO_IDS.rewards.cap],
    );

    const result = await resetScenario(pool, SCENARIO_KEY);
    expect(result.ok).toBe(true);
    expect(result).toMatchObject(SCENARIO_CHECKPOINT);
    expect(await checkScenario(pool)).toMatchObject({ ok: true, ...SCENARIO_CHECKPOINT });

    const after = await fingerprintExisting();
    expect(after.count).toBe(before.count);
    expect(after.rows).toEqual(before.rows);
  });
});
