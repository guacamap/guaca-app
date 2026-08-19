import type { Pool } from 'pg';

export interface TrendSignalsRow {
  placeId: string;
  category: string;
  /** Days since the place was last verified. */
  ageDays: number;
  /** Questions whose answer cited this place, last 30 days. */
  interestCount: number;
  /** Age in days of the most recent citing question — null when none. */
  lastInterestAgeDays: number | null;
  /** Tourists who saved the place. A save is durable, so no window. */
  favoriteCount: number;
  /** Visible posts in the last 60 days. */
  postCount: number;
  avgRating: number | null;
  ratingCount: number;
  /** Posts carrying a social link (TikTok/IG/YouTube), last 30 days. */
  socialCount: number;
  /** Age in days of the newest post/rating/social link — null when none. */
  lastEngagementAgeDays: number | null;
  /** Re-check doubts in this place's cell and category, last 60 days. */
  doubtCount: number;
}

/**
 * Gather the trend engine's raw inputs for every verified place in an area.
 * The aggregation mirrors `loadGapSignals`: all counts and ages are computed
 * in Postgres so they match what the map and the operator CLI would show.
 *
 * What each signal IS, so nobody "improves" it into a fabrication:
 * - interest: `questions.answer_place_ids` — answers that actually cited the
 *   place. The interest graph was recorded from day one; this is its first
 *   reader.
 * - doubts: RECHECK_REQUESTED questions clustered to the place's own cell
 *   and category — travellers explicitly questioning freshness.
 * - favourites: a private save-list. It feeds the score; it must never
 *   surface as a public counter (migration 0007's stance).
 */
export async function loadTrendSignals(
  pool: Pool,
  areaId: string | null,
): Promise<TrendSignalsRow[]> {
  const res = await pool.query<{
    place_id: string;
    category: string;
    age_days: string | number;
    interest_count: number;
    last_interest_age_days: string | number | null;
    favorite_count: number;
    post_count: number;
    avg_rating: string | null;
    rating_count: number;
    social_count: number;
    last_engagement_age_days: string | number | null;
    doubt_count: number;
  }>(
    `select p.id as place_id,
            p.category,
            extract(epoch from (now() - coalesce(p.verified_at, p.created_at))) / 86400.0 as age_days,
            coalesce(i.n, 0) as interest_count,
            i.last_age as last_interest_age_days,
            coalesce(f.n, 0) as favorite_count,
            coalesce(po.n, 0) as post_count,
            po.avg_rating,
            coalesce(po.rating_count, 0) as rating_count,
            coalesce(so.n, 0) as social_count,
            least(po.last_age, so.last_age) as last_engagement_age_days,
            coalesce(d.n, 0) as doubt_count
       from places p
       left join lateral (
         select count(*)::int as n,
                min(extract(epoch from (now() - q.created_at)) / 86400.0) as last_age
           from questions q
          where q.answer_place_ids @> array[p.id]
            and q.created_at > now() - interval '30 days'
       ) i on true
       left join lateral (
         select count(*)::int as n from tourist_favorites tf
          where tf.place_id = p.id
       ) f on true
       left join lateral (
         select count(*)::int as n,
                avg(pp.rating) as avg_rating,
                count(pp.rating)::int as rating_count,
                min(extract(epoch from (now() - pp.created_at)) / 86400.0) as last_age
           from place_posts pp
          where pp.place_id = p.id
            and pp.status = 'visible'
            and pp.created_at > now() - interval '60 days'
       ) po on true
       left join lateral (
         select count(*)::int as n,
                min(extract(epoch from (now() - sp.created_at)) / 86400.0) as last_age
           from place_posts sp
          where sp.place_id = p.id
            and sp.status = 'visible'
            and sp.media_url is not null
            and sp.created_at > now() - interval '30 days'
       ) so on true
       left join lateral (
         select count(*)::int as n
           from questions q
          where q.refusal_reason = 'RECHECK_REQUESTED'
            and q.intent->>'h3_8' = p.h3_8
            and q.intent->>'category' = p.category
            and q.created_at > now() - interval '60 days'
       ) d on true
      where p.verification_status = 'verified'
        and p.witness_count >= 2
        and ($1::uuid is null or p.area_id = $1)`,
    [areaId],
  );
  return res.rows.map((r) => ({
    placeId: r.place_id,
    category: r.category,
    ageDays: Number(r.age_days),
    interestCount: r.interest_count,
    lastInterestAgeDays:
      r.last_interest_age_days === null ? null : Number(r.last_interest_age_days),
    favoriteCount: r.favorite_count,
    postCount: r.post_count,
    avgRating: r.avg_rating === null ? null : Number(r.avg_rating),
    ratingCount: r.rating_count,
    socialCount: r.social_count,
    lastEngagementAgeDays:
      r.last_engagement_age_days === null ? null : Number(r.last_engagement_age_days),
    doubtCount: r.doubt_count,
  }));
}

export interface TrendWriteEntry {
  placeId: string;
  score: number;
  breakdown: Record<string, unknown>;
  weatherState: string | null;
  trendVersion: string;
}

/**
 * Replace the trend table's contents with a freshly computed set. Rows for
 * places that no longer qualify (or were deleted) disappear, so a badge can
 * never outlive the evidence that earned it.
 */
export async function writeTrends(
  pool: Pool,
  entries: TrendWriteEntry[],
): Promise<number> {
  if (entries.length === 0) {
    await pool.query('delete from place_trends');
    return 0;
  }
  const ids = entries.map((e) => e.placeId);
  const values: unknown[] = [];
  const tuples = entries.map((e) => {
    const base = values.length;
    values.push(e.placeId, e.score, JSON.stringify(e.breakdown), e.weatherState, e.trendVersion);
    return `($${base + 1}::uuid, $${base + 2}::int, $${base + 3}::jsonb, $${base + 4}::text, now(), $${base + 5}::text)`;
  });
  const written = await pool.query(
    `insert into place_trends (place_id, score, breakdown, weather_state, computed_at, trend_version)
     values ${tuples.join(', ')}
     on conflict (place_id) do update set
       score = excluded.score,
       breakdown = excluded.breakdown,
       weather_state = excluded.weather_state,
       computed_at = excluded.computed_at,
       trend_version = excluded.trend_version`,
    values,
  );
  // Prune rows whose place left the verified set since the last cycle.
  await pool.query('delete from place_trends where not (place_id = any($1::uuid[]))', [ids]);
  return written.rowCount ?? entries.length;
}

export interface TrendRow {
  placeId: string;
  score: number;
  badge: 'trending' | 'asked_about' | 'fresh' | null;
  computedAt: string;
}

/** Read trend rows for a set of places — the API-facing read path. */
export async function trendsForPlaces(
  pool: Pool,
  placeIds: string[],
): Promise<Map<string, TrendRow>> {
  if (placeIds.length === 0) return new Map();
  const res = await pool.query<{
    place_id: string;
    score: number;
    badge: string | null;
    computed_at: Date;
  }>(
    `select place_id, score, breakdown->>'badge' as badge, computed_at
       from place_trends
      where place_id = any($1::uuid[])`,
    [placeIds],
  );
  return new Map(
    res.rows.map((r) => [
      r.place_id,
      {
        placeId: r.place_id,
        score: r.score,
        badge: (r.badge as TrendRow['badge']) ?? null,
        computedAt: r.computed_at.toISOString(),
      },
    ]),
  );
}
