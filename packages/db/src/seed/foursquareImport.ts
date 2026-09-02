import type { Pool } from 'pg';
import { categoryForOverture, humanizeCategory, nameSimilarity } from './overtureImport.js';
import { recordSource } from './placeSources.js';

/**
 * Foursquare OS Places (Apache 2.0) for an area: the third open dataset,
 * which is what makes "corroborated" mean something. A row that matches a
 * place within 120 m by name becomes another source on that place; anything
 * else becomes a `foursquare_candidate`, as unverified as any other dot.
 */
export interface FoursquareRow {
  fsq_place_id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
  locality?: string | null;
  tel?: string | null;
  website?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  date_refreshed?: string | null;
  /** "Dining and Drinking > Restaurant > Seafood Restaurant" */
  fsq_category_labels?: string[] | null;
}

export interface FoursquareImportResult {
  linked: number;
  inserted: number;
  skipped: number;
  preview: Array<{ name: string; action: 'link' | 'insert' | 'skip'; reason?: string; target?: string }>;
}

/** Foursquare labels are a path; the last segment is the specific kind. */
export function categoryForFoursquare(labels: readonly string[] | null | undefined): { category: string | null; subcategory: string | null } {
  const leaves = (labels ?? []).map((l) => l.split('>').map((s) => s.trim()).filter(Boolean));
  // Leaf first: "Landmarks and Outdoors > Beach" is a beach, not a landmark.
  const keys = leaves.flatMap((path) => [...path].reverse()).map((s) => s.toLowerCase().replace(/[^a-z]+/g, '_'));
  const category = categoryForOverture(keys[0] ?? null, keys.slice(1));
  const leaf = leaves[0]?.at(-1) ?? null;
  return { category, subcategory: leaf ? humanizeCategory(leaf) : null };
}

export async function importFoursquare(
  pool: Pool,
  areaId: string,
  rows: readonly FoursquareRow[],
  opts: { apply: boolean; matchRadiusM?: number },
): Promise<FoursquareImportResult> {
  const radius = opts.matchRadiusM ?? 120;
  const out: FoursquareImportResult = { linked: 0, inserted: 0, skipped: 0, preview: [] };
  for (const r of rows) {
    const name = (r.name ?? '').trim();
    if (!name || r.latitude == null || r.longitude == null) { out.skipped++; continue; }
    const { category, subcategory } = categoryForFoursquare(r.fsq_category_labels);
    if (!category) { out.skipped++; out.preview.push({ name, action: 'skip', reason: `no category for ${r.fsq_category_labels?.[0] ?? 'none'}` }); continue; }
    const lat = r.latitude; const lon = r.longitude;
    const socials = [r.instagram ? `https://instagram.com/${r.instagram}` : null, r.twitter ? `https://twitter.com/${r.twitter}` : null].filter((s): s is string => !!s);
    const attrs = { phone: r.tel ?? undefined, website: r.website ?? undefined, address: r.address ?? undefined, locality: r.locality ?? undefined, socials: socials.length ? socials : undefined, subcategory: subcategory ?? undefined, refreshed: r.date_refreshed ?? undefined };

    const near = await pool.query<{ id: string; name: string }>(
      `select id, name from places
        where area_id = $3 and ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
        order by ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) asc limit 12`,
      [lon, lat, areaId, radius],
    );
    const match = near.rows.find((x) => nameSimilarity(x.name, name) >= 0.6);
    if (match) {
      out.linked++; out.preview.push({ name, action: 'link', target: match.name });
      if (!opts.apply) continue;
      await recordSource(pool, { placeId: match.id, source: 'foursquare', sourceId: r.fsq_place_id, name, category, lat, lon, attrs });
      // Fill public gaps only; another source's value already there stays.
      await pool.query(
        `update places set
           public_phone = coalesce(public_phone, $2), public_website = coalesce(public_website, $3),
           public_address = coalesce(public_address, $4), public_subcategory = coalesce(public_subcategory, $5),
           public_socials = case when public_socials = '[]'::jsonb and jsonb_array_length($6::jsonb) > 0 then $6::jsonb else public_socials end,
           public_source = coalesce(public_source, 'foursquare'), public_refreshed_at = coalesce(public_refreshed_at, now()), updated_at = now()
         where id = $1`,
        [match.id, r.tel ?? null, r.website ?? null, r.address ?? null, subcategory, JSON.stringify(socials)],
      );
      continue;
    }
    out.preview.push({ name, action: 'insert' });
    if (!opts.apply) { out.inserted++; continue; }
    const ins = await pool.query<{ id: string }>(
      `insert into places
         (area_id, name, category, landmark_description, location, h3_8, source, verification_status,
          public_phone, public_website, public_socials, public_address, public_source, public_subcategory, public_refreshed_at)
       select $1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, h3_lat_lng_to_cell(point($5, $6), 8)::text,
              'foursquare_candidate', 'candidate', $7, $8, $9::jsonb, $10, 'foursquare', $11, now()
        where ST_Covers((select geom from areas where id = $1), ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)
          and not exists (select 1 from place_sources where source = 'foursquare' and source_id = $12)
        returning id`,
      [areaId, name, category, r.address ? `Cerca de ${r.address}` : 'Listado público (Foursquare)', lon, lat, r.tel ?? null, r.website ?? null, JSON.stringify(socials), r.address ?? null, subcategory, r.fsq_place_id],
    );
    const id = ins.rows[0]?.id;
    if (!id) continue; // outside the area polygon, or already imported
    out.inserted++;
    await recordSource(pool, { placeId: id, source: 'foursquare', sourceId: r.fsq_place_id, name, category, lat, lon, attrs });
  }
  return out;
}
