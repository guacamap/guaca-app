import type { Pool } from 'pg';

export interface SpotterRosterRow {
  id: string;
  name: string;
  phone: string;
  level: number;
  active: boolean;
}

/** Operator-issued accounts only — there is deliberately no self-signup. */
export async function addSpotter(
  pool: Pool,
  input: { name: string; phone: string; areaId: string; language?: string },
): Promise<{ id: string }> {
  const res = await pool.query<{ id: string }>(
    `insert into spotters (name, phone, area_id, language)
     values ($1, $2, $3, $4) returning id`,
    [input.name, input.phone, input.areaId, input.language ?? 'es'],
  );
  return { id: res.rows[0]!.id };
}

export async function listSpotters(pool: Pool): Promise<SpotterRosterRow[]> {
  const res = await pool.query(
    `select id, name, phone, level, active from spotters order by created_at asc`,
  );
  return res.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    phone: r.phone as string,
    level: r.level as number,
    active: r.active as boolean,
  }));
}

/** Stores only the hash — the plaintext code is printed once by the CLI. */
export async function issueLoginCode(
  pool: Pool,
  spotterId: string,
  codeHash: string,
): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `update spotters set login_code_hash = $2 where id = $1 and active returning id`,
    [spotterId, codeHash],
  );
  if (res.rows.length === 0) throw new Error('spotter not found or inactive');
  return res.rows[0]!.id;
}
