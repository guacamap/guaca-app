import type { Pool } from 'pg';

export interface SpotterRosterRow {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  level: number;
  active: boolean;
}

/** Operator-issued accounts only — there is deliberately no self-signup. */
export async function addSpotter(
  pool: Pool,
  input: {
    name: string;
    /** The login. Lower-cased here; the roster is the allowlist. */
    email?: string;
    /** Contact number, shown to nobody; no longer the login. */
    phone: string;
    areaId: string;
    language?: string;
    /** Territory identity — the face shown on every pin they verify. */
    photoUrl?: string;
    /** The zone they own (home_h3). */
    homeH3?: string;
  },
): Promise<{ id: string }> {
  const res = await pool.query<{ id: string }>(
    `insert into spotters (name, email, phone, area_id, language, photo_url, home_h3)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      input.name,
      input.email?.trim().toLowerCase() ?? null,
      input.phone,
      input.areaId,
      input.language ?? 'es',
      input.photoUrl ?? null,
      input.homeH3 ?? null,
    ],
  );
  return { id: res.rows[0]!.id };
}

export async function listSpotters(pool: Pool): Promise<SpotterRosterRow[]> {
  const res = await pool.query(
    `select id, name, email, phone, level, active from spotters order by created_at asc`,
  );
  return res.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: (r.email as string | null) ?? null,
    phone: r.phone as string,
    level: r.level as number,
    active: r.active as boolean,
  }));
}

/**
 * Operator-minted code, the break-glass path for a spotter whose email is
 * not reaching them. Stores only the hash; valid for a day, single use.
 */
export async function issueLoginCode(
  pool: Pool,
  spotterId: string,
  codeHash: string,
): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `update spotters set login_code_hash = $2, login_code_expires_at = now() + interval '24 hours'
      where id = $1 and active returning id`,
    [spotterId, codeHash],
  );
  if (res.rows.length === 0) throw new Error('spotter not found or inactive');
  return res.rows[0]!.id;
}

export interface SpotterLoginRow {
  id: string;
  email: string;
  name: string;
  language: string;
  loginCodeHash: string | null;
  loginCodeExpiresAt: Date | null;
}

/** The roster lookup behind the email door. Inactive spotters do not exist here. */
export async function findSpotterByEmail(pool: Pool, email: string): Promise<SpotterLoginRow | null> {
  const res = await pool.query(
    `select id, email, name, language, login_code_hash, login_code_expires_at
       from spotters where email = $1 and active`,
    [email.trim().toLowerCase()],
  );
  const r = res.rows[0];
  return r
    ? {
        id: r.id as string, email: r.email as string, name: r.name as string,
        language: r.language as string,
        loginCodeHash: (r.login_code_hash as string | null) ?? null,
        loginCodeExpiresAt: (r.login_code_expires_at as Date | null) ?? null,
      }
    : null;
}

/** Emailed one-time code: hash only, ten minutes, single use. */
export async function setSpotterLoginCode(
  pool: Pool, email: string, codeHash: string, expiresAt: Date,
): Promise<void> {
  await pool.query(
    `update spotters set login_code_hash = $2, login_code_expires_at = $3 where email = $1 and active`,
    [email.trim().toLowerCase(), codeHash, expiresAt],
  );
}

/** Success clears the code: the gate promises single use. */
export async function clearSpotterLoginCode(pool: Pool, spotterId: string): Promise<void> {
  await pool.query(
    `update spotters set login_code_hash = null, login_code_expires_at = null where id = $1`,
    [spotterId],
  );
}
