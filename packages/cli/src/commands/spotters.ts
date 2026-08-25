import type { Pool } from 'pg';
import { createHash, randomBytes } from 'node:crypto';

export interface SpotterRow {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  level: number;
  active: boolean;
}

export interface SpottersDb {
  addSpotter(
    pool: Pool,
    input: {
      name: string;
      email?: string;
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

/** `guaca spotter add <name> <phone> --email <email>` — operator-issued accounts. */
export async function spotterAddCommand(input: {
  name: string;
  email: string;
  phone: string;
  areaId: string;
  language?: string;
  photoUrl?: string;
  homeH3?: string;
  db: SpottersDb;
  pool: Pool;
}): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`"${input.email}" is not a valid email; it is the spotter's login`);
  return input.db.addSpotter(input.pool, {
    name: input.name,
    email,
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
 * `guaca spotter code <spotterId>` — break-glass: a one-time login code for a
 * spotter whose email is not reaching them. Stores only the hash; the
 * plaintext is printed once and the spotter enters it at the email door.
 */
export async function spotterCodeCommand(input: {
  spotterId: string;
  db: SpottersDb;
  pool: Pool;
}): Promise<{ code: string }> {
  // Six digits, like the emailed codes, so the gate's numeric input accepts it.
  const code = String(parseInt(randomBytes(4).toString('hex'), 16) % 1_000_000).padStart(6, '0');
  const hash = hashCode(code);
  await input.db.issueLoginCode(input.pool, input.spotterId, hash);
  return { code };
}
