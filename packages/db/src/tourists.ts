import type { Pool } from 'pg';

export interface TouristRow {
  id: string;
  email: string;
  language: string;
  attributedPropertyId: string | null;
}

/**
 * §4.1 — request-code upserts the account and stores the hashed one-time
 * code. First writer wins on attribution: a returning tourist scanning a
 * second villa's QR keeps their original property.
 */
export async function upsertTouristLoginCode(
  pool: Pool,
  input: {
    email: string;
    language?: string;
    attributedPropertyId?: string | null;
    codeHash: string;
    expiresAt: Date;
  },
): Promise<TouristRow> {
  const res = await pool.query(
    `insert into tourists (email, language, attributed_property_id, login_code_hash, login_code_expires_at)
     values ($1, $2, $3, $4, $5)
     on conflict (email) do update set
       language = excluded.language,
       attributed_property_id = coalesce(tourists.attributed_property_id, excluded.attributed_property_id),
       login_code_hash = excluded.login_code_hash,
       login_code_expires_at = excluded.login_code_expires_at
     returning id, email, language, attributed_property_id`,
    [
      input.email,
      input.language ?? 'en',
      input.attributedPropertyId ?? null,
      input.codeHash,
      input.expiresAt,
    ],
  );
  const r = res.rows[0]!;
  return {
    id: r.id as string,
    email: r.email as string,
    language: r.language as string,
    attributedPropertyId: (r.attributed_property_id as string) ?? null,
  };
}

/**
 * Verify consumes the code: on a hash+expiry match the code is cleared
 * (single use) and last_login_at is stamped, atomically.
 */
export async function consumeTouristLoginCode(
  pool: Pool,
  email: string,
  codeHash: string,
): Promise<TouristRow | null> {
  const res = await pool.query(
    `update tourists set
       login_code_hash = null,
       login_code_expires_at = null,
       last_login_at = now()
     where email = $1
       and login_code_hash = $2
       and login_code_expires_at > now()
     returning id, email, language, attributed_property_id`,
    [email, codeHash],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id as string,
    email: r.email as string,
    language: r.language as string,
    attributedPropertyId: (r.attributed_property_id as string) ?? null,
  };
}

export async function touristById(pool: Pool, id: string): Promise<TouristRow | null> {
  const res = await pool.query(
    `select id, email, language, attributed_property_id from tourists where id = $1`,
    [id],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id as string,
    email: r.email as string,
    language: r.language as string,
    attributedPropertyId: (r.attributed_property_id as string) ?? null,
  };
}

/**
 * COMPLIANCE.md erasure: the account (email — the only tourist PII) is
 * deleted outright. Questions were never linked to tourist identity, so
 * demand signals survive anonymously by construction.
 */
export async function deleteTourist(pool: Pool, touristId: string): Promise<boolean> {
  const res = await pool.query(`delete from tourists where id = $1`, [touristId]);
  return (res.rowCount ?? 0) > 0;
}
