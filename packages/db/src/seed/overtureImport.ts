import type { Pool } from 'pg';

/**
 * Overture Maps places (CDLA Permissive 2.0) for an area. Two outcomes per
 * feature: an existing place within 120 m with the same name gains the
 * public phone, website, socials and address; anything else becomes an
 * `overture_candidate`, as unverified as an OSM dot. Nothing here changes
 * what "verified" means; a local still has to stand there.
 */
const CATEGORY: Array<[RegExp, string]> = [
  [/beach/, 'beach_water'],
  [/restaurant|cafe|coffee|bakery|bar$|pub|food|pizza|burger|arepa|ice_cream|dessert|diner|grill|seafood/, 'eat_drink'],
  [/night_club|nightclub|karaoke|music_venue|live_music|dance/, 'nightlife_music'],
  [/museum|landmark|historical|monument|church|cathedral|religious|fort|castle|art_gallery|theater|theatre|cultural/, 'culture_history'],
  [/park|trail|hiking|nature|garden|mountain|waterfall|lagoon|river|island|zoo|botanical/, 'nature_walk'],
  [/market|grocery|supermarket|shop|store|mall|boutique|souvenir|crafts/, 'market_shop'],
  [/hospital|clinic|pharmacy|doctor|dentist|bank|atm|laundry|gas_station|fuel|car_repair|auto|police|veterinar/, 'services'],
  [/hotel|lodging|hostel|motel|resort|posada|bed_and_breakfast|bus|taxi|ferry|port|airport|terminal|parking/, 'practical'],
];

export interface OvertureFeature {
  properties: {
    id?: string | null;
    names?: { primary?: string | null } | null;
    categories?: { primary?: string | null; alternate?: string[] | null } | null;
    phones?: string[] | null;
    websites?: string[] | null;
    socials?: string[] | null;
    addresses?: Array<{ freeform?: string | null; locality?: string | null }> | null;
    confidence?: number | null;
    brand?: { names?: { primary?: string | null } | null } | null;
  };
  geometry?: { type: string; coordinates: [number, number] } | null;
}

export interface OvertureImportResult {
  enriched: number;
  inserted: number;
  skipped: number;
}

export function categoryForOverture(primary: string | null | undefined, alternate?: string[] | null): string | null {
  const keys = [primary ?? '', ...(alternate ?? [])].map((k) => k.toLowerCase());
  for (const k of keys) for (const [re, cat] of CATEGORY) if (re.test(k)) return cat;
  return null;
}

/** "mexican_restaurant" -> "Mexican restaurant". Overture and Foursquare
 *  both use this snake_case style; readable is enough, it is a label, not
 *  prose written for the sentence it sits in. */
export function humanizeCategory(raw: string): string {
  const words = raw.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The most specific descriptor Overture offers: an alternate category is
 * usually finer-grained than the primary one ("mexican_restaurant" next to
 * "restaurant"); a brand name, when present, is worth more than either.
 * Never the same string as the taxonomy bucket the place was filed under —
 * that would just repeat the category label back at the reader.
 */
export function subcategoryFor(p: OvertureFeature['properties']): string | null {
  const specific = p.categories?.alternate?.[0] ?? p.categories?.primary ?? null;
  const label = specific ? humanizeCategory(specific) : null;
  const brand = p.brand?.names?.primary?.trim() || null;
  if (brand && label) return `${brand} · ${label}`;
  return brand ?? label;
}

/** Lower-case, no accents, no punctuation: "Café Colonial" and "cafe colonial" are one name. */
export function normaliseName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Word overlap in [0,1]; one name containing the other counts as a match. */
export function nameSimilarity(a: string, b: string): number {
  const na = normaliseName(a); const nb = normaliseName(b);
  if (!na || !nb) return 0;
  if (na === nb || na.includes(nb) || nb.includes(na)) return 1;
  const A = new Set(na.split(' ')); const B = new Set(nb.split(' '));
  const inter = [...A].filter((w) => B.has(w) && w.length > 2).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
}

export async function importOverture(
  pool: Pool,
  areaId: string,
  features: readonly OvertureFeature[],
  opts: { apply: boolean; matchRadiusM?: number },
): Promise<OvertureImportResult & { preview: Array<{ name: string; action: 'enrich' | 'insert' | 'skip'; reason?: string; target?: string }> }> {
  const radius = opts.matchRadiusM ?? 120;
  const out = { enriched: 0, inserted: 0, skipped: 0, preview: [] as Array<{ name: string; action: 'enrich' | 'insert' | 'skip'; reason?: string; target?: string }> };
  for (const f of features) {
    const p = f.properties;
    const name = (p.names?.primary ?? '').trim();
    const coords = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
    if (!name || !coords) { out.skipped++; out.preview.push({ name: name || '(no name)', action: 'skip', reason: 'no name or point' }); continue; }
    const [lon, lat] = coords;
    const category = categoryForOverture(p.categories?.primary, p.categories?.alternate);
    if (!category) { out.skipped++; out.preview.push({ name, action: 'skip', reason: `no category for ${p.categories?.primary ?? 'none'}` }); continue; }
    const phone = p.phones?.[0] ?? null;
    const website = p.websites?.[0] ?? null;
    const socials = (p.socials ?? []).filter((u) => typeof u === 'string');
    const address = p.addresses?.[0]?.freeform ?? null;
    const overtureId = p.id ?? null;
    const subcategory = subcategoryFor(p);

    // Match: same name within the radius, verified or candidate, any source.
    const near = await pool.query<{ id: string; name: string; dist: number; overture_id: string | null }>(
      `select id, name, overture_id, ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as dist
         from places where area_id = $3 and ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
        order by dist asc limit 12`,
      [lon, lat, areaId, radius],
    );
    const match = near.rows.find((r) => nameSimilarity(r.name, name) >= 0.6);
    if (match) {
      if (match.overture_id && overtureId && match.overture_id !== overtureId) { out.skipped++; out.preview.push({ name, action: 'skip', reason: 'target already enriched from another record', target: match.name }); continue; }
      out.enriched++; out.preview.push({ name, action: 'enrich', target: match.name });
      if (!opts.apply) continue;
      await pool.query(
        `update places set
           public_phone = coalesce($2, public_phone), public_website = coalesce($3, public_website),
           public_socials = case when jsonb_array_length($4::jsonb) > 0 then $4::jsonb else public_socials end,
           public_address = coalesce($5, public_address), public_source = 'overture', public_confidence = $6,
           public_subcategory = coalesce($8, public_subcategory),
           public_refreshed_at = now(), overture_id = coalesce($7, overture_id), updated_at = now()
         where id = $1`,
        [match.id, phone, website, JSON.stringify(socials), address, p.confidence ?? null, overtureId, subcategory],
      );
      continue;
    }
    out.preview.push({ name, action: 'insert' });
    if (!opts.apply) { out.inserted++; continue; }
    const ins = await pool.query<{ id: string; inserted: boolean }>(
      `insert into places
         (area_id, name, category, landmark_description, location, h3_8, source, verification_status,
          public_phone, public_website, public_socials, public_address, public_source, public_confidence, public_subcategory, public_refreshed_at, overture_id)
       select $1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, h3_lat_lng_to_cell(point($5, $6), 8)::text,
              'overture_candidate', 'candidate', $7, $8, $9::jsonb, $10, 'overture', $11, $13, now(), $12
        where ST_Covers((select geom from areas where id = $1), ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)
        -- A re-run refreshes public metadata on a row it already created —
        -- never name/category/verification_status, so a candidate a spotter
        -- has since promoted is untouched even if it is matched again here.
        on conflict (overture_id) where overture_id is not null do update set
          public_phone = coalesce(excluded.public_phone, places.public_phone),
          public_website = coalesce(excluded.public_website, places.public_website),
          public_socials = case when jsonb_array_length(excluded.public_socials) > 0 then excluded.public_socials else places.public_socials end,
          public_address = coalesce(excluded.public_address, places.public_address),
          public_subcategory = coalesce(excluded.public_subcategory, places.public_subcategory),
          public_confidence = coalesce(excluded.public_confidence, places.public_confidence),
          public_refreshed_at = now()
        returning id, (xmax = 0) as inserted`,
      [areaId, name, category, address ? `Cerca de ${address}` : 'Listado público (Overture Maps)', lon, lat, phone, website, JSON.stringify(socials), address, p.confidence ?? null, overtureId, subcategory],
    );
    // Three outcomes: a genuine new row (xmax = 0), a refresh of a row
    // this importer already created for the same overture_id (matched by
    // the unique index, not counted as new), or zero rows because the
    // WHERE ST_Covers clause found the point outside the area polygon.
    if (ins.rows[0]?.inserted) out.inserted++;
  }
  return out;
}
