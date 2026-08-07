import type { Pool } from 'pg';

export interface ClusterResult {
  gapsCreated: number;
  questionsClustered: number;
}

/**
 * T5.1 — cluster unanswered questions into gaps keyed by
 * (area_id, category, h3_8). The h3_8 comes from the question's intent
 * (computed at ask time with h3_lat_lng_to_cell at res 8). Upsert into
 * `gaps` bumps question_count and distinct_session_count; the
 * gaps_cluster_idx unique index makes re-runs safe.
 */
export async function clusterUnanswered(
  pool: Pool,
  areaId: string,
): Promise<ClusterResult> {
  const res = await pool.query(
    `insert into gaps (area_id, category, h3_8, question_count, distinct_session_count, last_asked_at)
     select q.area_id,
            q.intent->>'category' as category,
            q.intent->>'h3_8' as h3_8,
            count(*)::int as question_count,
            count(distinct q.session_id)::int as distinct_session_count,
            max(q.created_at) as last_asked_at
     from questions q
     where q.answered = false
       and q.area_id = $1
       and q.intent ? 'category'
       and q.intent ? 'h3_8'
     group by q.area_id, q.intent->>'category', q.intent->>'h3_8'
     on conflict (area_id, category, h3_8) do update set
       question_count = gaps.question_count + excluded.question_count,
       distinct_session_count = greatest(gaps.distinct_session_count, excluded.distinct_session_count),
       last_asked_at = greatest(gaps.last_asked_at, excluded.last_asked_at)
     returning id`,
    [areaId],
  );

  const marked = await pool.query(
    `update questions q set answered = true
     where q.answered = false and q.area_id = $1 and q.intent ? 'category' and q.intent ? 'h3_8'
       and exists (
         select 1 from gaps g
         where g.area_id = q.area_id
           and g.category = q.intent->>'category'
           and g.h3_8 = q.intent->>'h3_8'
       )`,
    [areaId],
  );

  return {
    gapsCreated: res.rowCount ?? 0,
    questionsClustered: marked.rowCount ?? 0,
  };
}
