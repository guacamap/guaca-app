import type { Pool } from 'pg';

export interface PlacePostRow {
  id: string;
  body: string;
  mediaUrl: string | null;
  createdAt: string;
  visited: boolean;
  rating: number | null;
  author: {
    kind: 'spotter' | 'traveler';
    name: string | null;
    level: number;
    photoUrl: string | null;
  };
}

/**
 * "What locals say" — commentary about a place, never map facts. Exactly one
 * of spotterId/touristId is set (enforced by the table check).
 */
export async function addPlacePost(
  pool: Pool,
  input: {
    placeId: string;
    spotterId?: string | null;
    touristId?: string | null;
    body: string;
    mediaUrl?: string | null;
    visited?: boolean;
    rating?: number | null;
  },
): Promise<{ id: string }> {
  const res = await pool.query(
    `insert into place_posts (place_id, spotter_id, tourist_id, body, media_url, visited, rating)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      input.placeId,
      input.spotterId ?? null,
      input.touristId ?? null,
      input.body,
      input.mediaUrl ?? null,
      input.visited ?? false,
      input.rating ?? null,
    ],
  );
  return { id: res.rows[0]!.id as string };
}

/**
 * Ranked feed: verified spotters first, higher level first, then travelers;
 * newest first within each band. The trust ordering IS the product — a
 * named local who walks the streets outranks an anonymous visitor.
 */
export async function postsForPlace(pool: Pool, placeId: string): Promise<PlacePostRow[]> {
  const res = await pool.query(
    `select pp.id, pp.body, pp.media_url, pp.created_at, pp.visited, pp.rating,
            s.name as spotter_name, s.photo_url as spotter_photo, coalesce(s.level, 0) as level
     from place_posts pp
     left join spotters s on s.id = pp.spotter_id
     where pp.place_id = $1 and pp.status = 'visible'
     order by (pp.spotter_id is not null) desc, coalesce(s.level, 0) desc,
              pp.visited desc, pp.created_at desc
     limit 30`,
    [placeId],
  );
  return res.rows.map((r) => ({
    id: r.id as string,
    body: r.body as string,
    mediaUrl: (r.media_url as string) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    visited: r.visited as boolean,
    rating: (r.rating as number) ?? null,
    author: r.spotter_name
      ? {
          kind: 'spotter' as const,
          name: r.spotter_name as string,
          level: r.level as number,
          photoUrl: (r.spotter_photo as string) ?? null,
        }
      : { kind: 'traveler' as const, name: null, level: 0, photoUrl: null },
  }));
}

export interface FavoriteRow {
  placeId: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
}

export async function addFavorite(pool: Pool, touristId: string, placeId: string): Promise<void> {
  await pool.query(
    `insert into tourist_favorites (tourist_id, place_id)
     select $1, id from places where id = $2 and verification_status = 'verified'
     on conflict do nothing`,
    [touristId, placeId],
  );
}

export async function removeFavorite(
  pool: Pool,
  touristId: string,
  placeId: string,
): Promise<void> {
  await pool.query(`delete from tourist_favorites where tourist_id = $1 and place_id = $2`, [
    touristId,
    placeId,
  ]);
}

export async function listFavorites(pool: Pool, touristId: string): Promise<FavoriteRow[]> {
  const res = await pool.query(
    `select p.id, p.name, p.category,
            ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon
     from tourist_favorites f
     join places p on p.id = f.place_id
     where f.tourist_id = $1
     order by f.created_at desc`,
    [touristId],
  );
  return res.rows.map((r) => ({
    placeId: r.id as string,
    name: r.name as string,
    category: r.category as string,
    lat: r.lat as number,
    lon: r.lon as number,
  }));
}
