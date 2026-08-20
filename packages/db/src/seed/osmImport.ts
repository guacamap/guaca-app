import { XMLParser } from 'fast-xml-parser';
import type { Pool } from 'pg';

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
  ferry_terminal: 'practical',
  taxi: 'practical',
};

const NODE_KEYS = new Set(['node', 'way', 'relation']);

function landmarkDescriptionFor(tags: OsmTag[]): string {
  const street = tags.find((t) => t['@_k'] === 'addr:street')?.['@_v'];
  return street ? `Cerca de ${street}` : 'Punto en OpenStreetMap';
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
      const name = tags.find((t) => t['@_k'] === 'name')?.['@_v'];
      if (!name) continue;

      const category = tags
        .map((t) => TAG_TO_CATEGORY[t['@_v'] ?? ''])
        .find((c) => c !== undefined);
      if (!category) continue;

      const osmId = Number(id);
      if (!Number.isFinite(osmId)) continue;

      const r = await pool.query(
        `insert into places
           (area_id, name, category, landmark_description, location, h3_8,
            source, verification_status, tags, osm_type, osm_id)
         select $1, $2, $3, $4,
                ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                h3_lat_lng_to_cell(point($5, $6), 8)::text,
                'osm_candidate', 'candidate', $7, $8, $9
         where ST_Contains(
           (select geom::geometry from areas where id = $1),
           ST_SetSRID(ST_MakePoint($5, $6), 4326)
         ) and ST_Intersects(
           (select geom::geometry from areas where id = $1),
           ST_SetSRID(ST_MakePoint($5, $6), 4326)
         )
         on conflict (osm_type, osm_id) where osm_type is not null do nothing
         returning id`,
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
        ],
      );
      if (r.rows.length > 0) inserted += 1;
    }
  }
  return { inserted };
}
