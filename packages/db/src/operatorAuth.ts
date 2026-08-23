import type { Pool } from 'pg';

export interface OperatorRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'moderator';
  active: boolean;
  lastLoginAt: Date | null;
}

export interface OperatorAuthResult {
  ok: boolean;
  reason?: 'not found' | 'inactive' | 'code expired' | 'wrong code';
  operator?: OperatorRow;
}

/** Seed an operator — idempotent on email. */
export async function upsertOperator(
  pool: Pool,
  input: { email: string; name: string; role?: string },
): Promise<OperatorRow> {
  const email = input.email.trim().toLowerCase();
  const res = await pool.query(
    `insert into operators (email, name, role)
     values ($1, $2, $3)
     on conflict (email) do update set name = excluded.name, active = true
     returning id, email, name, role, active, last_login_at`,
    [email, input.name, input.role ?? 'operator'],
  );
  const r = res.rows[0] as { id: string; email: string; name: string; role: string; active: boolean; last_login_at: Date | null };
  return {
    id: r.id, email: r.email, name: r.name,
    role: r.role as OperatorRow['role'], active: r.active,
    lastLoginAt: r.last_login_at,
  };
}

/** Store a login code hash + expiry (the code itself is never stored). */
export async function setOperatorLoginCode(
  pool: Pool,
  email: string,
  codeHash: string,
  expiresAt: Date,
): Promise<OperatorRow | null> {
  const res = await pool.query(
    `update operators
        set login_code_hash = $2, login_code_expires_at = $3
      where email = $1 and active
      returning id, email, name, role, active, last_login_at`,
    [email.toLowerCase(), codeHash, expiresAt],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0] as { id: string; email: string; name: string; role: string; active: boolean; last_login_at: Date | null };
  return {
    id: r.id, email: r.email, name: r.name,
    role: r.role as OperatorRow['role'], active: r.active,
    lastLoginAt: r.last_login_at,
  };
}

/** Verify the code (single-use: clears it on success). */
export async function consumeOperatorLoginCode(
  pool: Pool,
  email: string,
  codeHash: string,
): Promise<OperatorAuthResult> {
  const res = await pool.query(
    `select id, email, name, role, active, login_code_hash, login_code_expires_at
       from operators where email = $1`,
    [email.toLowerCase()],
  );
  if (res.rows.length === 0) return { ok: false, reason: 'not found' };
  const r = res.rows[0] as { id: string; email: string; name: string; role: string; active: boolean; login_code_hash: string | null; login_code_expires_at: Date | null; last_login_at: Date | null };
  if (!r.active) return { ok: false, reason: 'inactive' };
  if (!r.login_code_hash || !r.login_code_expires_at || r.login_code_expires_at < new Date()) {
    return { ok: false, reason: 'code expired' };
  }
  if (r.login_code_hash !== codeHash) return { ok: false, reason: 'wrong code' };

  // Success: clear the code + record the login.
  await pool.query(
    `update operators set login_code_hash = null, login_code_expires_at = null, last_login_at = now()
      where id = $1`,
    [r.id],
  );
  return {
    ok: true,
    operator: {
      id: r.id, email: r.email, name: r.name,
      role: r.role as OperatorRow['role'], active: r.active,
      lastLoginAt: new Date(),
    },
  };
}

/** Find an operator by email (for token verification / profile). */
export async function operatorByEmail(
  pool: Pool,
  email: string,
): Promise<OperatorRow | null> {
  const res = await pool.query(
    `select id, email, name, role, active, last_login_at
       from operators where email = $1 and active`,
    [email.toLowerCase()],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0] as { id: string; email: string; name: string; role: string; active: boolean; last_login_at: Date | null };
  return {
    id: r.id, email: r.email, name: r.name,
    role: r.role as OperatorRow['role'], active: r.active,
    lastLoginAt: r.last_login_at,
  };
}

export async function listOperators(pool: Pool): Promise<OperatorRow[]> {
  const res = await pool.query(
    `select id, email, name, role, active, last_login_at
       from operators order by created_at asc`,
  );
  return res.rows.map((r: { id: string; email: string; name: string; role: string; active: boolean; last_login_at: Date | null }) => ({
    id: r.id, email: r.email, name: r.name,
    role: r.role as OperatorRow['role'], active: r.active,
    lastLoginAt: r.last_login_at,
  }));
}
