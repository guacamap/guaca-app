import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';

export interface PropertyRow {
  id: string;
  name: string;
  areaId: string;
  qrToken: string;
  plan: string;
  subscriptionMinor: number;
}

/** Short, unambiguous QR slug: qr- + 8 lowercase base32-ish chars. */
function mintQrToken(): string {
  return 'qr-' + randomBytes(5).toString('hex').slice(0, 8);
}

/**
 * Operator-created properties (villas/posadas) — the distribution channel.
 * No self-signup: the registrations inbox captures interest, a human talks
 * to the owner, and only then is a QR minted (README rule).
 */
export async function addProperty(
  pool: Pool,
  input: {
    name: string;
    areaId: string;
    lat: number;
    lon: number;
    plan?: 'free' | 'paid';
    subscriptionMinor?: number;
  },
): Promise<PropertyRow> {
  const qrToken = mintQrToken();
  const res = await pool.query(
    `insert into properties (name, area_id, location, qr_token, plan, subscription_minor)
     values ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5, $6, $7)
     returning id, name, area_id, qr_token, plan, subscription_minor`,
    [
      input.name,
      input.areaId,
      input.lat,
      input.lon,
      qrToken,
      input.plan ?? 'free',
      input.subscriptionMinor ?? 0,
    ],
  );
  const r = res.rows[0]!;
  return {
    id: r.id as string,
    name: r.name as string,
    areaId: r.area_id as string,
    qrToken: r.qr_token as string,
    plan: r.plan as string,
    subscriptionMinor: r.subscription_minor as number,
  };
}

export async function listProperties(pool: Pool): Promise<PropertyRow[]> {
  const res = await pool.query(
    `select id, name, area_id, qr_token, plan, subscription_minor
     from properties order by created_at asc`,
  );
  return res.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    areaId: r.area_id as string,
    qrToken: r.qr_token as string,
    plan: r.plan as string,
    subscriptionMinor: r.subscription_minor as number,
  }));
}

/** Resolve a QR token WITHOUT minting a session (for cards and previews). */
export async function propertyByQrToken(
  pool: Pool,
  qrToken: string,
): Promise<{ id: string; name: string } | null> {
  const res = await pool.query(
    `select id, name from properties where qr_token = $1`,
    [qrToken],
  );
  const r = res.rows[0];
  return r ? { id: r.id as string, name: r.name as string } : null;
}
