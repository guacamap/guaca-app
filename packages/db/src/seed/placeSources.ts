import type { Pool } from 'pg';

export type PlaceSource = 'osm' | 'overture' | 'foursquare' | 'wikidata';

export interface SourceRecord {
  placeId: string;
  source: PlaceSource;
  sourceId: string;
  name: string;
  category: string | null;
  lat: number;
  lon: number;
  attrs?: Record<string, unknown>;
  confidence?: number | null;
}

/**
 * One row per open dataset that knows a place. The count of distinct
 * sources is what makes a place "corroborated" rather than "listed once",
 * so every importer records itself here and refreshes the count. A re-run
 * of the same source updates its own row and changes nothing else.
 */
export async function recordSource(pool: Pool, r: SourceRecord): Promise<void> {
  await pool.query(
    `insert into place_sources (place_id, source, source_id, name, category, lat, lon, attrs, confidence, refreshed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, now())
     on conflict (source, source_id) do update set
       place_id = excluded.place_id, name = excluded.name, category = excluded.category,
       lat = excluded.lat, lon = excluded.lon, attrs = excluded.attrs, confidence = excluded.confidence, refreshed_at = now()`,
    [r.placeId, r.source, r.sourceId, r.name, r.category, r.lat, r.lon, JSON.stringify(r.attrs ?? {}), r.confidence ?? null],
  );
  await pool.query(
    `update places set corroboration = (select count(distinct source) from place_sources where place_id = $1) where id = $1`,
    [r.placeId],
  );
}
