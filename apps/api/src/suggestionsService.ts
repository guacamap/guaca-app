import type { Pool } from 'pg';
import { q, trendsForPlaces } from '@guaca/db';

export interface Suggestion {
  placeId: string;
  name: string;
  why: 'trending' | 'asked_about' | 'fresh';
}

/**
 * Grounded recommendations — the deterministic seam between the trend
 * engine and the tourist. A suggestion is a VERIFIED place carrying an
 * honestly-earned badge, ranked by its computed trend score. No model
 * output, no invented venue: if the trend table has nothing to say, the
 * answer is an empty list, not a guess.
 */
export async function suggestionsNear(
  pool: Pool,
  opts: { lat: number; lon: number; exclude?: readonly string[]; limit?: number },
): Promise<Suggestion[]> {
  const rows = await q.places.findVerifiedNear(pool, opts.lat, opts.lon, 2000, undefined);
  const trends = await trendsForPlaces(pool, rows.map((r) => r.id));
  const exclude = new Set(opts.exclude ?? []);
  return rows
    .map((r) => ({ row: r, trend: trends.get(r.id) }))
    .filter((x) => x.trend?.badge && !exclude.has(x.row.id))
    .sort((a, b) => (b.trend!.score ?? 0) - (a.trend!.score ?? 0))
    .slice(0, opts.limit ?? 3)
    .map((x) => ({ placeId: x.row.id, name: x.row.name, why: x.trend!.badge! }));
}
