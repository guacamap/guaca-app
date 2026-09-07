import type { Pool, PoolClient } from 'pg';
import { randomBytes } from 'node:crypto';
import type { Redemption, RewardCatalogItem, RewardLedgerEntry } from '@guaca/shared';
import { isoDate } from './reservationService.js';

type Queryable = Pool | PoolClient;

export class RewardError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_FOUND' | 'INSUFFICIENT_POINTS' | 'ALREADY_REDEEMED' | 'FORBIDDEN',
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'RewardError';
  }
}

export function mapCatalogItem(r: Record<string, unknown>): RewardCatalogItem {
  return {
    id: r.id as string,
    slug: r.slug as string,
    titleEn: r.title_en as string,
    titleEs: r.title_es as string,
    descriptionEn: r.description_en as string,
    descriptionEs: r.description_es as string,
    pointCost: Number(r.point_cost),
    kind: r.kind as RewardCatalogItem['kind'],
  };
}

export function mapLedgerEntry(r: Record<string, unknown>): RewardLedgerEntry {
  return {
    id: r.id as string,
    spotterId: r.spotter_id as string,
    delta: Number(r.delta),
    reason: r.reason as string,
    missionId: (r.mission_id as string | null) ?? null,
    createdAt: isoDate(r.created_at as Date | string)!,
  };
}

export function mapRedemption(r: Record<string, unknown>): Redemption {
  return {
    id: r.id as string,
    spotterId: r.spotter_id as string,
    catalogId: r.catalog_id as string,
    missionId: (r.mission_id as string | null) ?? null,
    pointsSpent: Number(r.points_spent),
    receiptCode: r.receipt_code as string,
    createdAt: isoDate(r.created_at as Date | string)!,
  };
}

/** Credit points for a verified mission once. Retry is a no-op. Points are not money. */
export async function creditMissionLedgerOnce(
  client: Queryable,
  missionId: string,
): Promise<{ credited: boolean; delta: number }> {
  const res = await client.query<{ id: string; delta: number }>(
    `insert into reward_ledger (spotter_id, delta, reason, mission_id)
     select m.spotter_id, m.reward_minor, 'completed_local_check', m.id
       from missions m
      where m.id = $1
        and m.status = 'verified'
        and not exists (
          select 1 from reward_ledger rl
           where rl.mission_id = m.id and rl.delta > 0
        )
     returning id, delta`,
    [missionId],
  );
  if (res.rows[0]) return { credited: true, delta: Number(res.rows[0].delta) };
  return { credited: false, delta: 0 };
}

export async function creditVerifiedMissionsForPlace(
  client: Queryable,
  placeId: string,
): Promise<void> {
  const missions = await client.query<{ id: string }>(
    `select id from missions where result_place_id = $1 and status = 'verified'`,
    [placeId],
  );
  for (const row of missions.rows) {
    await creditMissionLedgerOnce(client, row.id);
  }
}

export async function listCatalog(pool: Queryable): Promise<RewardCatalogItem[]> {
  const res = await pool.query(
    `select id, slug, title_en, title_es, description_en, description_es, point_cost, kind
       from reward_catalog
      order by point_cost asc, slug asc`,
  );
  return res.rows.map((row) => mapCatalogItem(row as Record<string, unknown>));
}

export async function listLedger(
  pool: Queryable,
  spotterId: string,
): Promise<RewardLedgerEntry[]> {
  const res = await pool.query(
    `select id, spotter_id, delta, reason, mission_id, created_at
       from reward_ledger
      where spotter_id = $1
      order by created_at desc`,
    [spotterId],
  );
  return res.rows.map((row) => mapLedgerEntry(row as Record<string, unknown>));
}

export async function redeemCatalogItem(
  pool: Pool,
  input: { spotterId: string; catalogId: string },
): Promise<Redemption> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select id from spotters where id = $1 for update`, [input.spotterId]);
    const itemRes = await client.query(
      `select id, slug, title_en, title_es, description_en, description_es, point_cost, kind
         from reward_catalog where id = $1`,
      [input.catalogId],
    );
    const item = itemRes.rows[0];
    if (!item) throw new RewardError('Catalog item not found', 'NOT_FOUND', 404);

    const prior = await client.query(
      `select id from redemptions where spotter_id = $1 and catalog_id = $2`,
      [input.spotterId, input.catalogId],
    );
    if (prior.rows[0]) {
      throw new RewardError('Already redeemed', 'ALREADY_REDEEMED', 409);
    }

    const balRes = await client.query<{ balance: string | number }>(
      `select coalesce(sum(delta), 0) as balance from reward_ledger where spotter_id = $1`,
      [input.spotterId],
    );
    const balance = Number(balRes.rows[0]?.balance ?? 0);
    const cost = Number(item.point_cost);
    if (balance < cost) {
      throw new RewardError(
        `Need ${cost} points; balance is ${balance}`,
        'INSUFFICIENT_POINTS',
        409,
      );
    }

    const receipt = `RDM-${randomBytes(3).toString('hex').toUpperCase()}`;
    const redemption = await client.query(
      `insert into redemptions (spotter_id, catalog_id, mission_id, points_spent, receipt_code)
       values ($1, $2, null, $3, $4)
       returning id, spotter_id, catalog_id, mission_id, points_spent, receipt_code, created_at`,
      [input.spotterId, input.catalogId, cost, receipt],
    );
    await client.query(
      `insert into reward_ledger (spotter_id, delta, reason, mission_id)
       values ($1, $2, $3, null)`,
      [input.spotterId, -cost, `redeem:${item.slug as string}`],
    );
    await client.query('commit');
    return mapRedemption(redemption.rows[0] as Record<string, unknown>);
  } catch (err) {
    await client.query('rollback');
    const e = err as { code?: string; constraint?: string };
    if (e.code === '23505' && e.constraint === 'redemptions_spotter_id_catalog_id_key') {
      throw new RewardError('Already redeemed', 'ALREADY_REDEEMED', 409);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getRedemption(
  pool: Queryable,
  id: string,
  spotterId: string,
): Promise<Redemption> {
  const res = await pool.query(
    `select id, spotter_id, catalog_id, mission_id, points_spent, receipt_code, created_at
       from redemptions where id = $1`,
    [id],
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new RewardError('Redemption not found', 'NOT_FOUND', 404);
  if (row.spotter_id !== spotterId) {
    throw new RewardError('Redemption not found', 'NOT_FOUND', 404);
  }
  return mapRedemption(row);
}
