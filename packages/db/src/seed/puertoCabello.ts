import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { PublicPlaceProfileSchema, type PublicPlaceProfile } from '@guaca/shared';
import { seed } from './index.js';
import { importOsmCandidates } from './osmImport.js';

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const RESEARCHED_AT = '2026-09-06';

interface ProfileSeed {
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string;
  summary: PublicPlaceProfile['summary'];
  sources?: PublicPlaceProfile['sources'];
  website?: string;
  phone?: string;
  address?: string;
  image?: PublicPlaceProfile['image'];
}

/** Short original summaries of public listings. No invented hours, ratings,
 * photographs, reviews, local witnesses or partnership claims. Additional
 * web references never increment the independent open-dataset count. */
export const PUERTO_CABELLO_PROFILES: ProfileSeed[] = [
  {
    osmType: 'node', osmId: 13588404601, name: 'Casa Rosada',
    image: { url: '/demo/puerto-cabello/casa-rosada.jpg', credit: 'Ocean Drive Venezuela / Mis Revistas', sourceUrl: 'https://www.misrevistas.com/oceandrive/notas/25001/puerto-cabello', rights: 'unverified-demo-only' },
    summary: {
      en: 'A boutique hotel and restaurant facing the Malecón in Puerto Cabello’s colonial quarter. The restaurant serves seafood, meat and pasta, with views over the bay.',
      es: 'Hotel boutique y restaurante frente al Malecón, en la zona colonial de Puerto Cabello. Su restaurante ofrece pescados y mariscos, carnes y pastas, con vistas a la bahía.',
    },
    website: 'https://casarosadave.com/', address: 'Frente al Malecón, Zona Colonial, Puerto Cabello, Carabobo',
    sources: [{ label: 'Casa Rosada · sitio oficial', url: 'https://casarosadave.com/' }],
  },
  {
    osmType: 'node', osmId: 13588404801, name: 'Da Franco',
    image: { url: '/demo/puerto-cabello/da-franco.webp', credit: 'Raymar Velásquez (@raymarven), via minube', sourceUrl: 'https://www.minube.com/rincon/restaurante-da-franco-a3634150', rights: 'unverified-demo-only' },
    summary: {
      en: 'An Italian restaurant on Paseo El Malecón. Public listings describe a menu of pasta and pizza along the historic waterfront.',
      es: 'Restaurante italiano en el Paseo El Malecón. Sus fichas públicas describen una oferta de pastas y pizzas junto al paseo marítimo del casco histórico.',
    },
    phone: '+58 242-3616161', address: 'Paseo El Malecón, Puerto Cabello, Carabobo',
    sources: [
      { label: 'Waze · ficha del lugar', url: 'https://www.waze.com/live-map/directions/ve/carabobo/puerto-cabello/da-franco-restaurante?to=place.ChIJDfDIxbBTgI4RkzPaXBNfI2E' },
      { label: 'Restaurant Guru · ficha pública', url: 'https://es.restaurantguru.com/Da-Franco-Restaurante-Puerto-Cabello' },
    ],
  },
  {
    osmType: 'node', osmId: 5718270282, name: 'Blue Marine Restaurant',
    image: { url: '/demo/puerto-cabello/blue-marine.jpg', credit: 'El Siglo · Blue Marine', sourceUrl: 'https://elsiglo.com.ve/frescura-del-mar-siente-blue-marine-restaurante-seafood/', rights: 'unverified-demo-only' },
    summary: {
      en: 'A seafood restaurant at Marina Punta Brava, close to the Municipal Theatre. Public information describes outdoor dining beside the marina.',
      es: 'Restaurante de pescados y mariscos en Marina Punta Brava, cerca del Teatro Municipal. La información pública describe espacios al aire libre junto a la marina.',
    },
    address: 'Marina Punta Brava, Puerto Cabello, Carabobo',
    sources: [{ label: 'El Siglo · Blue Marine', url: 'https://elsiglo.com.ve/frescura-del-mar-siente-blue-marine-restaurante-seafood/' }],
  },
  {
    osmType: 'way', osmId: 203615814, name: 'Fortín Solano',
    image: { url: '/demo/puerto-cabello/fortin-solano.jpg', credit: 'Periergeia / Wikimedia Commons · 2007', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fortinpuertocabello.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    summary: {
      en: 'A historic fort on the hills above Puerto Cabello, with views toward the city and harbour. Check access and visiting conditions before setting out.',
      es: 'Fortificación histórica en las alturas de Puerto Cabello, con vistas hacia la ciudad y el puerto. Confirma el acceso y las condiciones de visita antes de salir.',
    },
    sources: [{ label: 'Google Travel · lugares de Puerto Cabello', url: 'https://www.google.com/travel/hotels/entity/CgoIxdfJzJ24ks9pEAE' }, { label: 'Fortín Solano · información histórica', url: 'https://es.wikipedia.org/wiki/Fort%C3%ADn_Solano' }],
  },
  {
    osmType: 'way', osmId: 1482081795, name: 'Teatro Municipal de Puerto Cabello',
    image: { url: '/demo/puerto-cabello/teatro-municipal.jpg', credit: 'Jonathan Suarez / Wikimedia Commons · 2013', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Teatro_Municipal_-_panoramio_(2).jpg', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' },
    summary: {
      en: 'The Municipal Theatre is a cultural landmark near Plaza Bolívar and Marina Punta Brava. Performances and interior access depend on the programme; check before visiting.',
      es: 'El Teatro Municipal es un punto cultural cerca de la Plaza Bolívar y Marina Punta Brava. Las funciones y el acceso al interior dependen de la programación; consulta antes de ir.',
    },
  },
  {
    osmType: 'way', osmId: 1323862255, name: 'Playa Delfín',
    summary: {
      en: 'A beach on the Puerto Cabello coast, listed on public maps. Sea conditions, access and services have not been checked by a Guaca Spotter.',
      es: 'Playa de la costa de Puerto Cabello que aparece en mapas públicos. Un Spotter de Guaca aún no ha comprobado el estado del mar, el acceso ni los servicios.',
    },
    sources: [{ label: 'Google Travel · lugares de Puerto Cabello', url: 'https://www.google.com/travel/hotels/entity/CgoIxdfJzJ24ks9pEAE' }],
  },
  {
    osmType: 'relation', osmId: 12166419, name: 'Castillo San Felipe',
    summary: {
      en: 'A historic coastal fortification by Puerto Cabello’s harbour. Its map listing does not establish public access; confirm entry arrangements before going.',
      es: 'Fortificación histórica junto al puerto de Puerto Cabello. Su presencia en el mapa no garantiza el acceso al público; confirma las condiciones de entrada antes de ir.',
    },
  },
  {
    osmType: 'way', osmId: 157189923, name: 'Plaza Flores',
    summary: {
      en: 'A public square in the historic centre, mapped as a park in OpenStreetMap. A point of reference for exploring the nearby streets on foot.',
      es: 'Plaza del casco histórico, registrada como parque en OpenStreetMap. Un punto de referencia para explorar a pie las calles cercanas.',
    },
  },
];

export async function seedPuertoCabello(pool: Pool) {
  await seed(pool, { demo: false });
  const snapshot = await readFile(new URL('./data/puerto-cabello.osm', import.meta.url), 'utf8');
  const imported = await importOsmCandidates(pool, AREA_ID, {
    fetchImpl: async () => new Response(snapshot, { headers: { 'content-type': 'application/xml' } }),
  });
  let profiles = 0;
  for (const item of PUERTO_CABELLO_PROFILES) {
    const profile = PublicPlaceProfileSchema.parse({
      demo: true, researchedAt: RESEARCHED_AT, summary: item.summary, image: item.image,
      sources: [
        { label: 'OpenStreetMap', url: `https://www.openstreetmap.org/${item.osmType}/${item.osmId}` },
        ...(item.sources ?? []),
      ],
    });
    const updated = await pool.query(
      `update places set public_profile = $3::jsonb,
         description = coalesce(description, $4),
         public_website = coalesce(public_website, $5),
         public_phone = coalesce(public_phone, $6),
         public_address = coalesce(public_address, $7)
       where osm_type = $1 and osm_id = $2 and area_id = $8
         and verification_status = 'candidate'
         and (public_profile is null or public_profile->>'demo' = 'true')`,
      [item.osmType, item.osmId, JSON.stringify(profile), item.summary.es, item.website ?? null, item.phone ?? null, item.address ?? null, AREA_ID],
    );
    profiles += updated.rowCount ?? 0;
  }
  return { ...imported, profiles };
}
