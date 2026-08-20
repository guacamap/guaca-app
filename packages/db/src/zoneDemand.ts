import type { Pool } from 'pg';

export interface ZoneDemandRow {
  zoneId: string;
  zoneName: string;
  peopleCount: number;
  askCount: number;
  openGaps: number;
  lastAskedAt: string | null;
}

/**
 * Recompute the per-zone demand snapshot: distinct people (anonymous
 * sessions) who asked in each zone over the last 30 days, how many asks,
 * and how many open gaps sit in the zone. A question belongs to a zone
 * through its intent's h3 cell centre — the same geography the gap agent
 * clusters by, so the number a surface shows is the number the agent
 * scored. Runs after clustering in the scheduler cycle, so a refusal from
 * minutes ago is already counted.
 *
 * h3_cell_to_lat_lng returns a 0-based [lng, lat] array (verified) —
 * c[0], c[1] is exactly MakePoint(lng, lat).
 */
export async function recomputeZoneDemand(
  pool: Pool,
  areaId: string | null,
): Promise<number> {
  const res = await pool.query(
    `insert into zone_demand (zone_id, area_id, people_count, ask_count, open_gaps, last_asked_at, computed_at)
     select z.id, z.area_id,
            coalesce(d.people, 0),
            coalesce(d.asks, 0),
            coalesce(g.n, 0),
            d.last_asked,
            now()
       from zones z
       left join lateral (
         select count(distinct qc.sid)::int as people,
                count(*)::int as asks,
                max(qc.asked_at) as last_asked
           from (
             select q.session_id as sid,
                    q.created_at as asked_at,
                    ST_SetSRID(ST_MakePoint(hc.c[0], hc.c[1]), 4326)::geometry as centre
               from questions q
               cross join lateral (select h3_cell_to_lat_lng((q.intent->>'h3_8')::h3index) as c) hc
              where q.created_at > now() - interval '30 days'
                and q.intent->>'h3_8' is not null
           ) qc
          where ST_Covers(z.geom::geometry, qc.centre)
       ) d on true
       left join lateral (
         select count(*)::int as n
           from gaps g2
           cross join lateral (select h3_cell_to_lat_lng(g2.h3_8::h3index) as c) hc
          where g2.status = 'open'
            and ST_Covers(z.geom::geometry,
                ST_SetSRID(ST_MakePoint(hc.c[0], hc.c[1]), 4326)::geometry)
       ) g on true
      where ($1::uuid is null or z.area_id = $1)
     on conflict (zone_id) do update set
       people_count = excluded.people_count,
       ask_count = excluded.ask_count,
       open_gaps = excluded.open_gaps,
       last_asked_at = excluded.last_asked_at,
       computed_at = now()`,
    [areaId],
  );
  return res.rowCount ?? 0;
}

/** The read path for surfaces: zones ordered by people, zero-demand zones last. */
export async function zoneDemand(
  pool: Pool,
  areaId: string | null,
): Promise<ZoneDemandRow[]> {
  const res = await pool.query<{
    zone_id: string;
    zone_name: string;
    people_count: number;
    ask_count: number;
    open_gaps: number;
    last_asked_at: Date | null;
  }>(
    `select zd.zone_id, z.name as zone_name, zd.people_count, zd.ask_count,
            zd.open_gaps, zd.last_asked_at
       from zone_demand zd
       join zones z on z.id = zd.zone_id
      where ($1::uuid is null or zd.area_id = $1)
      order by zd.people_count desc, zd.ask_count desc, z.name asc`,
    [areaId],
  );
  return res.rows.map((r) => ({
    zoneId: r.zone_id,
    zoneName: r.zone_name,
    peopleCount: r.people_count,
    askCount: r.ask_count,
    openGaps: r.open_gaps,
    lastAskedAt: r.last_asked_at ? r.last_asked_at.toISOString() : null,
  }));
}
