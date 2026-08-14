import type { Pool } from 'pg';

export interface CategoryCoverageRow {
  category: string;
  verified: number;
  refusedAsks: number;
}

export interface StalePlaceRow {
  id: string;
  name: string;
  category: string;
  verifiedAt: string;
}

export interface WeakLandmarkRow {
  id: string;
  name: string;
  category: string;
  landmarkDescription: string;
}

export interface ZoneCoverageRow {
  zoneId: string;
  zoneName: string;
  verified: number;
}

export interface MapHealthStats {
  areaId: string;
  categories: CategoryCoverageRow[];
  stalePlaces: StalePlaceRow[];
  weakLandmarks: WeakLandmarkRow[];
  zones: ZoneCoverageRow[];
}

/**
 * Map-health aggregates — pure read-only SQL, zero inference. The agent's
 * arithmetic runs over these; a model is only ever asked to narrate them.
 */
export async function loadMapHealthStats(
  pool: Pool,
  areaId: string,
  staleDays = 60,
): Promise<MapHealthStats> {
  const categories = await pool.query(
    `with verified as (
       select category, count(*)::int as n
       from places
       where area_id = $1 and verification_status = 'verified'
       group by category
     ),
     demand as (
       -- Durable demand lives in gaps (the cluster cycle absorbs refused
       -- questions into them); fresh refusals not yet clustered still count.
       select category, sum(n)::int as n from (
         select g.category, sum(g.question_count)::int as n
         from gaps g
         where g.area_id = $1 and g.status in ('open', 'commissioned')
         group by g.category
         union all
         select intent->>'category' as category, count(*)::int as n
         from questions
         where area_id = $1
           and answered = false
           and refusal_reason is not null
           and intent->>'category' is not null
         group by 1
       ) united
       group by category
     )
     select coalesce(v.category, d.category) as category,
            coalesce(v.n, 0) as verified,
            coalesce(d.n, 0) as refused_asks
     from verified v
     full outer join demand d on d.category = v.category
     order by 1`,
    [areaId],
  );

  const stale = await pool.query(
    `select id, name, category, verified_at
     from places
     where area_id = $1
       and verification_status = 'verified'
       and verified_at is not null
       and verified_at < now() - ($2 || ' days')::interval
     order by verified_at asc
     limit 20`,
    [areaId, String(staleDays)],
  );

  const weak = await pool.query(
    `select id, name, category, landmark_description
     from places
     where area_id = $1
       and verification_status = 'verified'
       and length(coalesce(landmark_description, '')) < 25
     order by length(coalesce(landmark_description, '')) asc
     limit 20`,
    [areaId],
  );

  const zones = await pool.query(
    `select z.id as zone_id, z.name as zone_name, count(p.id)::int as verified
     from zones z
     left join places p
       on p.area_id = z.area_id
      and p.verification_status = 'verified'
      and ST_Within(p.location::geometry, z.geom::geometry)
     where z.area_id = $1
     group by z.id, z.name
     order by verified asc, z.name`,
    [areaId],
  );

  return {
    areaId,
    categories: categories.rows.map((r) => ({
      category: r.category as string,
      verified: r.verified as number,
      refusedAsks: r.refused_asks as number,
    })),
    stalePlaces: stale.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      category: r.category as string,
      verifiedAt:
        r.verified_at instanceof Date ? r.verified_at.toISOString() : String(r.verified_at),
    })),
    weakLandmarks: weak.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      category: r.category as string,
      landmarkDescription: (r.landmark_description as string) ?? '',
    })),
    zones: zones.rows.map((r) => ({
      zoneId: r.zone_id as string,
      zoneName: r.zone_name as string,
      verified: r.verified as number,
    })),
  };
}
