import { pool } from './pool.js';
import { seed } from './seed/index.js';
import { importOsmCandidates } from './seed/osmImport.js';
import { CARIBBEAN_CITIES } from '@guaca/shared';

/**
 * `node seed-cli.js` seeds reference geography ONLY — safe on production.
 * `--demo` adds the invented spotters and villas used in dev and staging.
 * `--caribbean-poi` imports OSM candidates for the Caribbean expansion
 *   cities (live Overpass queries — opt-in, never run by deploys): the
 *   unverified DOTS that make zooming into another country meaningful.
 */
const demo = process.argv.includes('--demo');
const caribbeanPoi = process.argv.includes('--caribbean-poi');

try {
  await seed(pool, { demo });
  console.log(demo ? 'seed complete (reference + demo data)' : 'seed complete (reference data only)');

  if (caribbeanPoi) {
    let total = 0;
    for (const city of CARIBBEAN_CITIES) {
      const { lat, lon, span } = city;
      // The area row is authoritative (it may predate the id scheme).
      const area = await pool.query<{ id: string }>(
        `select id from areas where slug = $1`,
        [city.slug],
      );
      if (area.rows.length === 0) {
        console.log(`  ${city.name}: SKIPPED (area not seeded)`);
        continue;
      }
      const id = area.rows[0]!.id;
      const bbox = `${(lat - span).toFixed(4)},${(lon - span).toFixed(4)},${(lat + span).toFixed(4)},${(lon + span).toFixed(4)}`;
      try {
        const res = await importOsmCandidates(pool, id, { bbox });
        total += res.inserted;
        console.log(`  ${city.name}: ${res.inserted} candidates`);
      } catch (e) {
        // Overpass rate-limits; one city failing must not kill the rest.
        console.log(`  ${city.name}: SKIPPED (${(e as Error).message})`);
      }
    }
    console.log(`caribbean POI import complete: ${total} candidates (all unverified dots)`);
  }
} finally {
  await pool.end();
}
