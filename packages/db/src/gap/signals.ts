import type { Pool } from 'pg';

export interface GapSignalsRow {
  questionCount: number;
  distinctSessions: number;
  askAgeDays: number[];
  properties: Array<{ tier: 'PARTNER_PREMIUM' | 'PARTNER' | 'TRIAL' | 'NONE'; distanceKm: number }>;
  verifiedPlaces: Array<{ ageDays: number }>;
  spotterCapacityInZone: number;
  accessDifficulty: number;
}

export interface SpotterCandidateRow {
  id: string;
  name: string;
  zoneId: string;
  homeH3: string;
  level: number;
  openMissions: number;
}

/**
 * Gather the REAL scoring inputs for a gap (§7.5). Without these the gap
 * agent scores on stubs: no existing coverage means the scarcity term never
 * suppresses spending, and no properties means the paying-property weighting —
 * the thing that makes the autonomy claim commercially honest — never applies.
 *
 * Distances and ages are computed in Postgres so the numbers match what the
 * map and the operator CLI would show.
 */
export async function loadGapSignals(
  pool: Pool,
  gap: { id: string; category: string; h3_8: string },
): Promise<GapSignalsRow> {
  const [demand, props, coverage, capacity] = await Promise.all([
    pool.query<{ q: number; s: number; ages: number[] }>(
      `select count(*)::int as q,
              count(distinct session_id)::int as s,
              coalesce(array_agg(extract(epoch from (now() - created_at)) / 86400.0), '{}') as ages
         from questions
        where intent->>'category' = $1 and intent->>'h3_8' = $2`,
      [gap.category, gap.h3_8],
    ),
    // Properties whose location falls near the gap's cell centre.
    pool.query<{ plan: string; subscription_minor: number; distance_km: number }>(
      `select p.plan, p.subscription_minor,
              ST_Distance(p.location, c.centre) / 1000.0 as distance_km
         from properties p,
              lateral (select h3_cell_to_lat_lng($1::h3index) as ll) h,
              lateral (select ST_SetSRID(ST_MakePoint(h.ll[0], h.ll[1]), 4326)::geography as centre) c
        where ST_DWithin(p.location, c.centre, 5000)`,
      [gap.h3_8],
    ),
    pool.query<{ age_days: number }>(
      `select extract(epoch from (now() - coalesce(verified_at, created_at))) / 86400.0 as age_days
         from places
        where verification_status = 'verified'
          and witness_count >= 2
          and category = $1
          and h3_8 = $2`,
      [gap.category, gap.h3_8],
    ),
    pool.query<{ n: number }>(
      `select count(*)::int as n from spotters
        where active = true and (home_h3 = $1 or home_h3 is null)`,
      [gap.h3_8],
    ),
  ]);

  const tierOf = (plan: string, minor: number): GapSignalsRow['properties'][number]['tier'] => {
    if (plan !== 'paid') return 'TRIAL';
    return minor >= 10_000 ? 'PARTNER_PREMIUM' : 'PARTNER';
  };

  return {
    questionCount: demand.rows[0]?.q ?? 0,
    distinctSessions: demand.rows[0]?.s ?? 0,
    askAgeDays: (demand.rows[0]?.ages ?? []).map((a) => Number(a)),
    properties: props.rows.map((r) => ({
      tier: tierOf(r.plan, Number(r.subscription_minor)),
      distanceKm: Number(r.distance_km),
    })),
    verifiedPlaces: coverage.rows.map((r) => ({ ageDays: Number(r.age_days) })),
    spotterCapacityInZone: capacity.rows[0]?.n ?? 0,
    accessDifficulty: 0,
  };
}

/** Real spotter candidates for a zone, with their current open-mission load. */
export async function listSpotterCandidates(
  pool: Pool,
  zoneId: string,
): Promise<SpotterCandidateRow[]> {
  const res = await pool.query<{
    id: string;
    name: string;
    home_h3: string | null;
    level: number;
    open_missions: number;
  }>(
    `select s.id, s.name, s.home_h3, s.level,
            (select count(*)::int from missions m
              where m.spotter_id = s.id
                and m.status in ('offered','accepted','submitted')) as open_missions
       from spotters s
      where s.active = true
      order by (s.home_h3 = $1) desc nulls last, s.level desc`,
    [zoneId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    zoneId,
    homeH3: r.home_h3 ?? zoneId,
    level: r.level,
    openMissions: r.open_missions,
  }));
}
