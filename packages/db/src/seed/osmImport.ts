import { XMLParser } from 'fast-xml-parser';
import type { Pool } from 'pg';
import { recordSource } from './placeSources.js';
import { nameSimilarity } from './overtureImport.js';

/**
 * OSM amenity/shop keys mapped onto the GUACA taxonomy. Candidates import
 * ONLY as `osm_candidate` / `candidate`; promotion to verified requires
 * real spotters (DB constraint verified_needs_two_locals enforces it).
 */
const TAG_TO_CATEGORY: Record<string, string> = {
  // eat_drink
  restaurant: 'eat_drink',
  cafe: 'eat_drink',
  bar: 'eat_drink',
  pub: 'eat_drink',
  fast_food: 'eat_drink',
  food_court: 'eat_drink',
  ice_cream: 'eat_drink',
  // beach_water
  beach: 'beach_water',
  // nature_walk
  park: 'nature_walk',
  viewpoint: 'nature_walk',
  // culture_history
  museum: 'culture_history',
  theatre: 'culture_history',
  castle: 'culture_history',
  memorial: 'culture_history',
  artwork: 'culture_history',
  place_of_worship: 'culture_history',
  church: 'culture_history',
  monument: 'culture_history',
  ruins: 'culture_history',
  fort: 'culture_history',
  plaza: 'culture_history',
  mural: 'culture_history',
  // market_shop
  marketplace: 'market_shop',
  shop: 'market_shop',
  supermarket: 'market_shop',
  convenience: 'market_shop',
  pharmacy: 'market_shop',
  bakery: 'market_shop',
  greengrocer: 'market_shop',
  deli: 'eat_drink',
  // services
  atm: 'services',
  clinic: 'services',
  hospital: 'services',
  laundry: 'services',
  fuel: 'services',
  // nightlife_music
  nightclub: 'nightlife_music',
  music_venue: 'nightlife_music',
  // practical
  bus_stop: 'practical',
  bus_station: 'practical',
  ferry_terminal: 'practical',
  taxi: 'practical',
};

const NODE_KEYS = new Set(['node', 'way', 'relation']);

function landmarkDescriptionFor(tags: OsmTag[]): string {
  const street = tags.find((t) => t['@_k'] === 'addr:street')?.['@_v'];
  return street ? `Cerca de ${street}` : 'Punto en OpenStreetMap';
}

/**
 * OSM contributors sometimes write a `description` tag by hand, or set
 * `cuisine`/`brand` — all more specific than the one bucket
 * TAG_TO_CATEGORY files a place under, and all discarded until now even
 * though every import already reads the tag list they live in.
 */
export function subcategoryForOsmTags(tags: OsmTag[]): string | null {
  const get = (key: string) => tags.find((t) => t['@_k'] === key)?.['@_v']?.trim() || null;
  const description = get('description');
  if (description) return description;
  const brand = get('brand');
  const cuisine = get('cuisine');
  const cuisineLabel = cuisine
    ? cuisine.split(';').map((c) => c.trim()).filter(Boolean).map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
    : null;
  if (brand && cuisineLabel) return `${brand} · ${cuisineLabel}`;
  return brand ?? cuisineLabel;
}

interface OsmTag {
  '@_k'?: string;
  '@_v'?: string;
}

interface OsmNode {
  '@_id'?: string;
  '@_lat'?: string;
  '@_lon'?: string;
  tag?: OsmTag | OsmTag[];
  center?: { '@_lat'?: string; '@_lon'?: string };
}

export interface OsmImportResult {
  inserted: number;
}

export interface OsmImportOptions {
  /** Injectable fetch — tests substitute a fixture; prod uses global fetch. */
  fetchImpl?: typeof fetch;
  /** Overpass endpoint; the kumi mirror is the reliable default. */
  overpassUrl?: string;
  /** Bounding box `latSouth,lonWest,latNorth,lonEast`; defaults to the pilot. */
  bbox?: string;
}

const DEFAULT_BBOX = '10.44,-68.03,10.52,-67.98';

// POI-keyed, not every named thing: elements without a taxonomy-mappable
// tag are discarded on insert anyway, and a generic ["name"] sweep over a
// whole city is what got Overpass returning 500s. This fetches only what
// can become a candidate.
const QUERY = (bbox: string) => `[out:xml][timeout:90];
(
  nwr["name"]["amenity"](${bbox});
  nwr["name"]["shop"](${bbox});
  nwr["name"]["tourism"](${bbox});
  nwr["name"]["leisure"](${bbox});
  nwr["name"]["historic"](${bbox});
  nwr["name"]["natural"="beach"](${bbox});
);
out center;`;

/**
 * Import OSM places for an area as unverified candidates. Idempotent on
 * (osm_type, osm_id): re-running inserts nothing. Points outside the area
 * polygon are dropped. Never promotes anything.
 */
export async function importOsmCandidates(
  pool: Pool,
  areaId: string,
  options: OsmImportOptions = {},
): Promise<OsmImportResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const bbox = options.bbox ?? DEFAULT_BBOX;
  // POST + explicit User-Agent: overpass-api.de rejects anonymous GETs
  // (406) and rate-limits hard. Mirrors fall over under load — try kumi,
  // then the main instance, before giving up.
  const endpoints = [
    ...new Set([
      options.overpassUrl ?? 'https://overpass.kumi.systems/api/interpreter',
      'https://overpass-api.de/api/interpreter',
    ]),
  ];

  let xml: string | null = null;
  let lastError = 'overpass unavailable';
  for (const endpoint of endpoints) {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'guaca-app/0.1 (pilot; contact via guaca.live)',
        },
        body: `data=${encodeURIComponent(QUERY(bbox))}`,
      });
      if (!res.ok) {
        lastError = `overpass request failed: ${res.status} ${res.statusText}`;
        continue;
      }
      xml = await res.text();
      break;
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  if (xml === null) {
    throw new Error(lastError);
  }
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const root = parsed?.osm;
  if (!root) return { inserted: 0 };

  let inserted = 0;
  for (const osmType of ['node', 'way', 'relation'] as const) {
    const group = root[osmType];
    if (!group) continue;
    const nodes: OsmNode[] = Array.isArray(group) ? group : [group];
    for (const node of nodes) {
      const id = node['@_id'];
      const lat = node['@_lat'] ?? node.center?.['@_lat'];
      const lon = node['@_lon'] ?? node.center?.['@_lon'];
      if (!id || !lat || !lon) continue;

      const tags = Array.isArray(node.tag) ? node.tag : node.tag ? [node.tag] : [];
      const tagValue = (key: string) => tags.find((t) => t['@_k'] === key)?.['@_v'] ?? null;
      const rawWebsite = tagValue('website') ?? tagValue('contact:website');
      const website = rawWebsite && /^https?:\/\//i.test(rawWebsite) ? rawWebsite : null;
      const address = [tagValue('addr:street'), tagValue('addr:housenumber'), tagValue('addr:city')].filter(Boolean).join(', ') || null;
      const name = tags.find((t) => t['@_k'] === 'name')?.['@_v'];
      if (!name) continue;

      const category = tags
        .map((t) => TAG_TO_CATEGORY[t['@_v'] ?? ''])
        .find((c) => c !== undefined);
      if (!category) continue;

      const osmId = Number(id);
      if (!Number.isFinite(osmId)) continue;

      // Overture and Foursquare matched by name within 120 m when they
      // imported; an OSM element they saw first, and an old tag map skipped,
      // already lives here without an osm id. Attach rather than twin it.
      const twin = await pool.query<{ id: string; name: string }>(
        `select id, name from places
          where area_id = $1 and osm_type is null and verification_status = 'candidate'
            and ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 120)
          order by ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) asc limit 12`,
        [areaId, Number(lon), Number(lat)],
      );
      const match = twin.rows.find((x) => nameSimilarity(x.name, name) >= 0.6);
      if (match) {
        const attached = await pool.query<{ id: string }>(
          `update places set osm_type = $2, osm_id = $3, public_subcategory = coalesce(public_subcategory, $4), updated_at = now()
            where id = $1 and not exists (select 1 from places where osm_type = $2 and osm_id = $3)
            returning id`,
          [match.id, osmType, osmId, subcategoryForOsmTags(tags)],
        );
        if (attached.rows[0]) {
          await recordSource(pool, {
            placeId: attached.rows[0].id, source: 'osm', sourceId: `${osmType}/${osmId}`, name, category,
            lat: Number(lat), lon: Number(lon),
            attrs: Object.fromEntries(tags.filter((t) => t['@_k'] && t['@_v']).map((t) => [t['@_k'] as string, t['@_v'] as string])),
          });
          continue;
        }
      }

      const r = await pool.query<{ id: string; inserted: boolean }>(
        `insert into places
           (area_id, name, category, landmark_description, location, h3_8,
            source, verification_status, tags, osm_type, osm_id, public_source, public_subcategory,
            public_phone, public_website, public_address)
         select $1, $2, $3, $4,
                ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                h3_lat_lng_to_cell(point($5, $6), 8)::text,
                'osm_candidate', 'candidate', $7, $8, $9, 'osm', $10, $11, $12, $13
         where ST_Contains(
           (select geom::geometry from areas where id = $1),
           ST_SetSRID(ST_MakePoint($5, $6), 4326)
         ) and ST_Intersects(
           (select geom::geometry from areas where id = $1),
           ST_SetSRID(ST_MakePoint($5, $6), 4326)
         )
         -- A re-run refreshes the public subcategory on a row it already
         -- created — never name/category/verification_status, so a
         -- candidate a spotter has since promoted is untouched.
         on conflict (osm_type, osm_id) where osm_type is not null do update set
           public_subcategory = case when places.verification_status = 'candidate' then coalesce(excluded.public_subcategory, places.public_subcategory) else places.public_subcategory end,
           public_phone = coalesce(places.public_phone, excluded.public_phone),
           public_website = coalesce(places.public_website, excluded.public_website),
           public_address = coalesce(places.public_address, excluded.public_address)
         returning id, (xmax = 0) as inserted`,
        [
          areaId,
          name,
          category,
          landmarkDescriptionFor(tags),
          Number(lon),
          Number(lat),
          name.split(' '),
          osmType,
          osmId,
          subcategoryForOsmTags(tags),
          tagValue('phone') ?? tagValue('contact:phone'),
          website,
          address,
        ],
      );
      if (r.rows[0]?.inserted) inserted += 1;
      if (r.rows[0]?.id) {
        await recordSource(pool, {
          placeId: r.rows[0].id, source: 'osm', sourceId: `${osmType}/${osmId}`, name, category,
          lat: Number(lat), lon: Number(lon),
          attrs: Object.fromEntries(tags.filter((t) => t['@_k'] && t['@_v']).map((t) => [t['@_k'] as string, t['@_v'] as string])),
        });
      }
    }
  }
  return { inserted };
}
