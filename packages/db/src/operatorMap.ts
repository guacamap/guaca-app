import type { Pool } from 'pg';

export interface OperatorMapPlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  spotterName: string | null;
}

export interface OperatorMapGap {
  id: string;
  category: string;
  questionCount: number;
  lat: number;
  lon: number;
}

export interface OperatorMapCandidate {
  id: string;
  lat: number;
  lon: number;
}

export interface OperatorMapHeat {
  lat: number;
  lon: number;
  weight: number;
}

export interface OperatorMapData {
  places: OperatorMapPlace[];
  gaps: OperatorMapGap[];
  candidates: OperatorMapCandidate[];
  heat: OperatorMapHeat[];
}

/**
 * One query-set for the oversight map: what is verified (pins — the proof),
 * where people are asking (gap pins with counts — the demand), the
 * unverified OSM backdrop (dots — never pins), and per-zone asking heat.
 * Geographies are resolved in Postgres so the panel's layers match the
 * agent's scoring geography exactly.
 */
export async function operatorMapData(pool: Pool): Promise<OperatorMapData> {
  const [places, gaps, candidates, heat] = await Promise.all([
    pool.query(
      `select p.id, p.name, p.category,
              ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon,
              s.name as spotter_name
         from places p
         left join spotters s on s.id = p.created_by_spotter_id
        where p.verification_status = 'verified' and p.witness_count >= 2
        order by p.verified_at desc nulls last
        limit 500`,
    ),
    pool.query(
      `select g.id, g.category, g.question_count,
              (h3_cell_to_lat_lng(g.h3_8::h3index))[1] as lat,
              (h3_cell_to_lat_lng(g.h3_8::h3index))[2] as lon
         from gaps g
        where g.status = 'open' and g.question_count > 0
        order by g.question_count desc
        limit 100`,
    ),
    pool.query(
      `select p.id,
              ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon
         from places p
        where p.source = 'osm_candidate' and p.verification_status = 'candidate'
        order by random()
        limit 2000`,
    ),
    pool.query(
      `select ST_Y(ST_Centroid(z.geom::geometry)) as lat,
              ST_X(ST_Centroid(z.geom::geometry)) as lon,
              zd.people_count as weight
         from zone_demand zd
         join zones z on z.id = zd.zone_id
        where zd.people_count > 0
        order by zd.people_count desc
        limit 50`,
    ),
  ]);

  return {
    places: places.rows.map((r: { id: string; name: string; category: string; lat: number; lon: number; spotter_name: string | null }) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      lat: Number(r.lat),
      lon: Number(r.lon),
      spotterName: r.spotter_name,
    })),
    gaps: gaps.rows.map((r: { id: string; category: string; question_count: number; lat: number; lon: number }) => ({
      id: r.id,
      category: r.category,
      questionCount: r.question_count,
      lat: Number(r.lat),
      lon: Number(r.lon),
    })),
    candidates: candidates.rows.map((r: { id: string; lat: number; lon: number }) => ({
      id: r.id,
      lat: Number(r.lat),
      lon: Number(r.lon),
    })),
    heat: heat.rows
      .map((r: { lat: number; lon: number; weight: number }) => ({
        lat: Number(r.lat),
        lon: Number(r.lon),
        weight: Number(r.weight),
      }))
      .filter((h: OperatorMapHeat) => Number.isFinite(h.lat) && Number.isFinite(h.lon)),
  };
}

export interface ActivityEvent {
  id: string;
  kind: string;
  agent: string;
  loopId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * What people and agents DID, newest first — the oversight feed. Synthesized
 * from the tables that are actually written (the loop_events table was
 * designed but never wired): questions are what travellers did, missions
 * are what the gap agent did, verifications are what spotters did, and
 * operator_actions are what the team did. All real, all timestamped.
 */
export async function recentActivity(pool: Pool, limit = 30): Promise<ActivityEvent[]> {
  const res = await pool.query<{
    id: string;
    kind: string;
    agent: string;
    detail: string;
    created_at: Date;
  }>(
    `(
       select q.id::text, 'QUESTION_ASKED' as kind, 'tourist' as agent,
              left(q.raw_text, 60) as detail, q.created_at
         from questions q
     ) union all (
       select m.id::text, 'MISSION_COMMISSIONED', 'gap',
              left(m.brief, 60), m.offered_at
         from missions m
     ) union all (
       select p.id::text, 'PLACE_VERIFIED', 'spotter',
              p.name, p.verified_at
         from places p
        where p.verified_at is not null
     ) union all (
       select oa.id::text, 'OPERATOR_' || upper(replace(oa.action, '.', '_')),
              'operator', oa.action, oa.created_at
         from operator_actions oa
     )
     order by created_at desc
     limit $1`,
    [limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    agent: r.agent,
    loopId: null,
    payload: { reason: r.detail },
    createdAt: r.created_at.toISOString(),
  }));
}
