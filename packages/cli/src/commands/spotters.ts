import type { Pool } from 'pg';
import { createHash, randomBytes } from 'node:crypto';

export interface SpotterRow {
  id: string;
  name: string;
  phone: string;
  level: number;
  active: boolean;
}

export interface SpottersDb {
  addSpotter(
    pool: Pool,
    input: {
      name: string;
      phone: string;
      areaId: string;
      language?: string;
      photoUrl?: string;
      homeH3?: string;
    },
  ): Promise<{ id: string }>;
  listSpotters(pool: Pool): Promise<SpotterRow[]>;
  issueLoginCode(pool: Pool, spotterId: string, codeHash: string): Promise<string>;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** `guaca spotter add <name> <phone>` — operator-issued accounts. */
export async function spotterAddCommand(input: {
  name: string;
  phone: string;
  areaId: string;
  language?: string;
  photoUrl?: string;
  homeH3?: string;
  db: SpottersDb;
  pool: Pool;
}): Promise<{ id: string }> {
  return input.db.addSpotter(input.pool, {
    name: input.name,
    phone: input.phone,
    areaId: input.areaId,
    ...(input.language ? { language: input.language } : {}),
    ...(input.photoUrl ? { photoUrl: input.photoUrl } : {}),
    ...(input.homeH3 ? { homeH3: input.homeH3 } : {}),
  });
}

/** `guaca spotter list` — the curated roster. */
export async function spotterListCommand(input: {
  db: SpottersDb;
  pool: Pool;
}): Promise<SpotterRow[]> {
  return input.db.listSpotters(input.pool);
}

/**
 * `guaca spotter code <spotterId>` — issues a one-time login code and stores
 * only its hash (login_code_hash). The plaintext is printed once.
 */
export async function spotterCodeCommand(input: {
  spotterId: string;
  db: SpottersDb;
  pool: Pool;
}): Promise<{ code: string }> {
  const code = randomBytes(4).toString('hex').toUpperCase();
  const hash = hashCode(code);
  await input.db.issueLoginCode(input.pool, input.spotterId, hash);
  return { code };
}
