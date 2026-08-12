import type { Pool } from 'pg';

export type RegistrationRole = 'traveler' | 'spotter' | 'owner';

export interface RegistrationInput {
  role: RegistrationRole;
  name: string;
  contact: string;
  language?: string;
  /** Role-specific answers, stored verbatim — zone for spotters, property for owners… */
  details?: Record<string, unknown>;
}

export interface RecordedRegistration {
  id: string;
  role: RegistrationRole;
  createdAt: Date;
}

/**
 * Persist a raised hand. Registration never grants anything by itself:
 * spotters remain invited and hand-picked (§spotters), owners get contacted
 * before any QR is minted, travellers are only a notification list. So this
 * is a plain insert with no side effects — the operator reads the inbox.
 */
export async function recordRegistration(
  pool: Pool,
  input: RegistrationInput,
): Promise<RecordedRegistration> {
  const res = await pool.query(
    `insert into registrations (role, name, contact, language, details)
     values ($1, $2, $3, $4, $5)
     on conflict (role, lower(contact)) do update set
       name = excluded.name,
       language = excluded.language,
       details = registrations.details || excluded.details
     returning id, role, created_at`,
    [
      input.role,
      input.name,
      input.contact,
      input.language ?? 'en',
      JSON.stringify(input.details ?? {}),
    ],
  );
  const r = res.rows[0];
  return {
    id: r.id as string,
    role: r.role as RegistrationRole,
    createdAt: r.created_at as Date,
  };
}
