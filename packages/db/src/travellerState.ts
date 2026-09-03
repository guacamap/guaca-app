import type { Pool } from 'pg';

export interface ActivePlanStop {
  placeId: string;
  name: string;
  category: string;
  startMin: number;
  durationMin: number;
  lat: number;
  lon: number;
  tier: 'verified' | 'corroborated' | 'listed';
}

export interface ActivePlan {
  question: string;
  stops: ActivePlanStop[];
  /** What the plan already knows about the day, so a tick does not repeat it. */
  rainWindows?: string | null;
}

export interface TravellerState {
  touristId: string;
  notes: string[];
  activePlan: ActivePlan | null;
  activePlanDate: string | null;
  lastLat: number | null;
  lastLon: number | null;
  language: string;
  lastSpokeAt: string | null;
  lastHeardAt: string | null;
}

const MAX_NOTES = 24;

export async function getTravellerState(pool: Pool, touristId: string): Promise<TravellerState | null> {
  const r = await pool.query<{
    tourist_id: string; notes: string[]; active_plan: ActivePlan | null; active_plan_date: string | null;
    last_lat: number | null; last_lon: number | null; language: string; last_spoke_at: Date | null; last_heard_at: Date | null;
  }>(`select tourist_id, notes, active_plan, active_plan_date::text, last_lat, last_lon, language, last_spoke_at, last_heard_at from traveller_state where tourist_id = $1`, [touristId]);
  const s = r.rows[0];
  if (!s) return null;
  return {
    touristId: s.tourist_id, notes: s.notes, activePlan: s.active_plan, activePlanDate: s.active_plan_date,
    lastLat: s.last_lat, lastLon: s.last_lon, language: s.language,
    lastSpokeAt: s.last_spoke_at?.toISOString() ?? null, lastHeardAt: s.last_heard_at?.toISOString() ?? null,
  };
}

/**
 * After a turn: where they are, what language, and anything Guaca learned.
 * Notes are short lines; the newest replace the oldest past the cap, and a
 * line already present is not repeated.
 */
export async function heardFromTraveller(
  pool: Pool,
  touristId: string,
  input: { lat: number; lon: number; language: string; learned?: readonly string[] },
): Promise<void> {
  const learned = (input.learned ?? []).map((l) => l.trim()).filter((l) => l.length > 0 && l.length <= 160);
  const cur = await pool.query<{ notes: string[] }>(`select notes from traveller_state where tourist_id = $1`, [touristId]);
  const existing = cur.rows[0]?.notes ?? [];
  // Newest wins on repeats; the oldest lines fall off past the cap.
  const merged = [...existing.filter((n) => !learned.includes(n)), ...learned].slice(-MAX_NOTES);
  await pool.query(
    `insert into traveller_state (tourist_id, notes, last_lat, last_lon, language, last_heard_at, updated_at)
       values ($1, $2, $3, $4, $5, now(), now())
     on conflict (tourist_id) do update set
       notes = $2, last_lat = $3, last_lon = $4, language = $5, last_heard_at = now(), updated_at = now()`,
    [touristId, merged, input.lat, input.lon, input.language],
  );
}

export async function setActivePlan(pool: Pool, touristId: string, plan: ActivePlan | null, localDate: string | null): Promise<void> {
  await pool.query(
    `insert into traveller_state (tourist_id, active_plan, active_plan_date, updated_at) values ($1, $2::jsonb, $3, now())
     on conflict (tourist_id) do update set active_plan = $2::jsonb, active_plan_date = $3, updated_at = now()`,
    [touristId, plan ? JSON.stringify(plan) : null, localDate],
  );
}

export async function travellersToTick(pool: Pool): Promise<TravellerState[]> {
  const r = await pool.query<{ tourist_id: string }>(
    `select tourist_id from traveller_state
      where last_heard_at > now() - interval '48 hours' or active_plan_date >= current_date - 1`,
  );
  const out: TravellerState[] = [];
  for (const row of r.rows) { const s = await getTravellerState(pool, row.tourist_id); if (s) out.push(s); }
  return out;
}

export async function guacaSpoke(
  pool: Pool,
  touristId: string,
  msg: { trigger: string; text: string; payload?: unknown },
): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `insert into guaca_messages (tourist_id, trigger, text, payload) values ($1, $2, $3, $4::jsonb) returning id`,
    [touristId, msg.trigger, msg.text, msg.payload === undefined ? null : JSON.stringify(msg.payload)],
  );
  await pool.query(`update traveller_state set last_spoke_at = now(), updated_at = now() where tourist_id = $1`, [touristId]);
  return r.rows[0]!.id;
}

/**
 * What Guaca already said today: the messages since the traveller's local
 * midnight, which is now() minus the minutes elapsed in their day. Measured
 * against the database clock, the same one that stamps the messages.
 */
export async function spokenToday(pool: Pool, touristId: string, minutesSinceLocalMidnight: number): Promise<{ count: number; triggers: string[] }> {
  const r = await pool.query<{ trigger: string }>(
    `select trigger from guaca_messages where tourist_id = $1 and created_at >= now() - ($2::int * interval '1 minute')`,
    [touristId, Math.max(0, Math.round(minutesSinceLocalMidnight))],
  );
  return { count: r.rows.length, triggers: r.rows.map((x) => x.trigger) };
}

export interface InboxMessage { id: string; trigger: string; text: string; payload: unknown; createdAt: string }

/** Undelivered messages, marked delivered as they are handed over. */
export async function takeInbox(pool: Pool, touristId: string): Promise<InboxMessage[]> {
  const r = await pool.query<{ id: string; trigger: string; text: string; payload: unknown; created_at: Date }>(
    `update guaca_messages set delivered_at = now() where tourist_id = $1 and delivered_at is null
       returning id, trigger, text, payload, created_at`,
    [touristId],
  );
  return r.rows.map((m) => ({ id: m.id, trigger: m.trigger, text: m.text, payload: m.payload, createdAt: m.created_at.toISOString() }));
}

export async function recordStopFeedback(pool: Pool, touristId: string, verdicts: ReadonlyArray<{ placeId: string; verdict: 'good' | 'not_there' | 'skipped' | 'bad' }>): Promise<void> {
  for (const v of verdicts) {
    await pool.query(`insert into stop_feedback (tourist_id, place_id, verdict) values ($1, $2, $3) on conflict do nothing`, [touristId, v.placeId, v.verdict]);
  }
}
