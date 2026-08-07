import type { Pool } from 'pg';

export interface QrSession {
  sessionId: string;
  propertyId: string;
  propertyName: string;
  language: string;
}

/**
 * T7.7 — the villa QR landing: resolves the QR token to a property and
 * mints a session in the guest's language.
 */
export async function sessionForQr(
  pool: Pool,
  qrToken: string,
  language: string,
): Promise<QrSession | null> {
  const prop = await pool.query<{ id: string; name: string }>(
    'select id, name from properties where qr_token = $1',
    [qrToken],
  );
  if (prop.rows.length === 0) return null;
  const property = prop.rows[0]!;

  const session = await pool.query<{ id: string }>(
    `insert into sessions (property_id, language) values ($1, $2) returning id`,
    [property.id, language],
  );
  return {
    sessionId: session.rows[0]!.id,
    propertyId: property.id,
    propertyName: property.name,
    language,
  };
}
