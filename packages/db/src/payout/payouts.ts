import type { Pool } from 'pg';

/**
 * PayoutProvider — the ONLY seam money flows through (§3, §10). The MVP
 * wires MockPayoutProvider only; a real provider (Reloadly airtime top-ups)
 * is a documented skeleton and is NEVER active in the MVP.
 */
export interface PayoutProvider {
  readonly name: string;
  pay(input: {
    idempotencyKey: string;
    amountMinor: number;
    currency: string;
    recipientPhone: string;
  }): Promise<{ status: 'pending' | 'sent' | 'failed'; providerRef?: string }>;
}

/** MVP-only provider: records the payment, sends nothing, never fails. */
export class MockPayoutProvider implements PayoutProvider {
  readonly name = 'mock';
  async pay(input: { idempotencyKey: string; amountMinor: number; currency: string; recipientPhone: string }) {
    return { status: 'sent' as const, providerRef: `mock:${input.idempotencyKey}` };
  }
}

/**
 * DOCUMENTED SKELETON — NOT WIRED. Reloadly airtime top-up: one API covers
 * the Caribbean, needs no bank account, is not money transmission, and reads
 * as a gift rather than a wage. Would use RELOADLY_CLIENT_ID/SECRET.
 */
export class ReloadlyPayoutProvider implements PayoutProvider {
  readonly name = 'reloadly';
  async pay(): Promise<{ status: 'pending' | 'sent' | 'failed'; providerRef?: string }> {
    throw new Error('ReloadlyPayoutProvider is a documented skeleton — not wired in the MVP');
  }
}

export interface PayInput {
  missionId: string;
  spotterId: string;
  amountMinor: number;
  currency: string;
  recipientPhone?: string;
}

export interface PayResult {
  status: 'pending' | 'sent' | 'failed';
  idempotencyKey: string;
}

/**
 * Pay a mission through the configured provider. Idempotency key = mission_id
 * (the payouts.idempotency_key unique index guarantees single payment): a
 * second call for the same mission inserts nothing. Never writes a real
 * payment integration.
 */
export async function payMission(
  pool: Pool,
  input: PayInput,
  provider: PayoutProvider = new MockPayoutProvider(),
): Promise<PayResult> {
  const res = await pool.query(
    `insert into payouts (mission_id, spotter_id, provider, idempotency_key, amount_minor, currency, status)
     values ($1, $2, $3, $6, $4, $5, 'pending')
     on conflict (idempotency_key) do nothing
     returning id`,
    [input.missionId, input.spotterId, provider.name, input.amountMinor, input.currency, input.missionId],
  );
  if (res.rows.length === 0) {
    // Already paid (or in flight) — idempotent no-op.
    return { status: 'sent', idempotencyKey: input.missionId };
  }

  const result = await provider.pay({
    idempotencyKey: input.missionId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    recipientPhone: input.recipientPhone ?? '',
  });
  await pool.query(
    `update payouts set status = $2, provider_ref = $3 where idempotency_key = $1`,
    [input.missionId, result.status, result.providerRef ?? null],
  );
  return { status: result.status, idempotencyKey: input.missionId };
}
