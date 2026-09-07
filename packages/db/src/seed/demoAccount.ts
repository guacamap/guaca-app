import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { groundFromVerifiedRows } from '@guaca/agents';
import { PublicPlaceProfileSchema, TripStopSchema } from '@guaca/shared';
import { PUERTO_CABELLO_PROFILES } from './puertoCabello.js';
import { CARTAGENA_PROFILES } from './cartagena.js';
import { SPOTTERS as PILOT_ROSTER } from './index.js';
import { addPlacePost } from '../posts.js';
import { recordRegistration } from '../registrations.js';
import { upsertOperator } from '../operatorAuth.js';

export const DEMO_TRAVELLER_EMAIL = 'viajero@guaca.live';
export const DEMO_AREA_ID = '00000000-0000-4000-8000-00000000000a';
export const CASA_ROSADA_OPERATOR_EMAIL = 'casarosada@demo.guaca.live';
const TRIP_ID = 'e23cbabb-80a4-4aa8-85bc-f95594f10c70';
const RESEARCHED_AT = '2026-09-06';

/** Seven saved Cartagena places on the presentation account — additive to
 * the Puerto Cabello favorites, never a replacement. OSM ids, so the
 * fixtures survive fresh databases with new place uuids. */
const CARTAGENA_FAVORITE_OSM_IDS = [
  955128419, // Puerta del Reloj
  49551791, // Castillo San Felipe de Barajas
  63525986, // Las Murallas
  5434244523, // Plaza de la Trinidad
  887632863, // Las Bóvedas
  25446658, // Bocagrande
  9159612217, // Celele
];

/** Stable fixture-trip identities: re-running replaces nothing, and an
 * edited trip on the same id is never overwritten. */
const CARTAGENA_TRIPS = [
  {
    id: '3f9c1a52-7b4d-4e8e-9a2f-5c6d80b41a71',
    question: 'Un día por la Cartagena amurallada',
    stops: [
      { osmId: 955128419, dayIndex: 0, startMin: 9 * 60, durationMin: 60 },
      { osmId: 49666923, dayIndex: 0, startMin: 10 * 60, durationMin: 45 },
      { osmId: 7154999586, dayIndex: 0, startMin: 11 * 60, durationMin: 60 },
      { osmId: 9159612217, dayIndex: 0, startMin: 13 * 60, durationMin: 90 },
      { osmId: 63525986, dayIndex: 0, startMin: 15 * 60 + 30, durationMin: 60 },
      { osmId: 887632863, dayIndex: 0, startMin: 17 * 60, durationMin: 45 },
    ],
  },
  {
    id: '8d2e6b93-c45f-4a17-b8d3-6e9f02a57c82',
    question: 'Dos días entre la ciudad amurallada y el mar',
    stops: [
      { osmId: 49551791, dayIndex: 0, startMin: 9 * 60, durationMin: 90 },
      { osmId: 5434244523, dayIndex: 0, startMin: 11 * 60 + 15, durationMin: 60 },
      { osmId: 9159612217, dayIndex: 0, startMin: 13 * 60, durationMin: 90 },
      { osmId: 25446658, dayIndex: 0, startMin: 15 * 60 + 30, durationMin: 120 },
      { osmId: 955128419, dayIndex: 1, startMin: 9 * 60 + 30, durationMin: 45 },
      { osmId: 49666923, dayIndex: 1, startMin: 10 * 60 + 30, durationMin: 45 },
      { osmId: 7154999586, dayIndex: 1, startMin: 11 * 60 + 30, durationMin: 60 },
      { osmId: 10278478997, dayIndex: 1, startMin: 14 * 60, durationMin: 120 },
      { osmId: 95018532, dayIndex: 1, startMin: 17 * 60, durationMin: 45 },
    ],
  },
];

/** First given name as the cast login: 'Yorman Salazar' signs in as
 * yorman@demo.guaca.live, 'María Fernanda' as maria@demo.guaca.live. */
function castEmail(name: string): string {
  const first = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)[0]!
    .toLowerCase();
  return `${first}@demo.guaca.live`;
}

/** The pilot roster (same people, matched by phone) plus the row that used to
 * be 'Carlos Test [DEV]', renamed in place. Names stay clean for the
 * recording; the @demo.guaca.live email is the hidden designation that marks
 * a row as invented, and it is the login each cast member uses locally. */
const DEMO_CAST: { name: string; phone: string; zone: string; email: string }[] = [
  ...PILOT_ROSTER.map((s) => ({ ...s, email: castEmail(s.name) })),
  { name: 'Rafael Rondón', phone: '+58 412 999 0001', zone: 'centro', email: 'rafael@demo.guaca.live' },
];

/** Business-published current information, stored through the real
 * place_posts mechanism. Authored by a per-business demo account, never by a
 * Spotter: a business update must not render with a witness badge, so it
 * ranks as ordinary commentary and the body itself says who is speaking and
 * that no Spotter has checked it. A post has no language field; the body
 * carries Spanish first and English second. */
const DEMO_BUSINESS_POSTS = [
  {
    osmType: 'node', osmId: 13588404601, business: 'Casa Rosada',
    account: CASA_ROSADA_OPERATOR_EMAIL,
    body:
      'Publicado por Casa Rosada (información del negocio): esta semana la cocina atiende de martes a domingo, 12:00 m a 8:00 p.m.; lunes cerrado. ' +
      'Posted by Casa Rosada (business information): this week the kitchen serves Tuesday to Sunday, noon to 8 p.m.; closed Mondays. ' +
      'Aún sin comprobar por un Spotter / Not yet checked by a Spotter.',
  },
  {
    osmType: 'node', osmId: 5718270282, business: 'Blue Marine Restaurant',
    account: 'bluemarine@demo.guaca.live',
    body:
      'Publicado por Blue Marine (información del negocio): esta semana abrimos de miércoles a lunes, 12:30 p.m. a 9:00 p.m.; martes cerrado. ' +
      'Posted by Blue Marine (business information): this week we open Wednesday to Monday, 12:30 p.m. to 9 p.m.; closed Tuesdays. ' +
      'Aún sin comprobar por un Spotter / Not yet checked by a Spotter.',
  },
  {
    osmType: 'node', osmId: 13588404801, business: 'Da Franco',
    account: 'dafranco@demo.guaca.live',
    body:
      'Publicado por Da Franco (información del negocio): esta semana atendemos de martes a sábado, 12:00 m a 9:00 p.m.; domingo hasta 6:00 p.m.; lunes cerrado. ' +
      'Posted by Da Franco (business information): this week we serve Tuesday to Saturday, noon to 9 p.m.; Sunday until 6 p.m.; closed Mondays. ' +
      'Aún sin comprobar por un Spotter / Not yet checked by a Spotter.',
  },
];

if (new Set(DEMO_CAST.map((c) => c.email)).size !== DEMO_CAST.length) {
  throw new Error('Demo cast logins collide; give each cast member a distinct first name.');
}

/** The invented fixture venues get photo-backed demo profiles too, so the map
 * and the discovery list look alive for the recording. These are cast venues,
 * not researched public listings: the sources anchor the culture the venue
 * belongs to, and every photo that does not show the venue itself carries an
 * illustrative/setting caption. Playa Quizandal and its photo are real. */
const DEMO_CAST_PROFILES: {
  name: string;
  summary: { en: string; es: string };
  sources: { label: string; url: string }[];
  image: { url: string; credit: string; sourceUrl: string; license?: string; licenseUrl?: string; rights?: 'unverified-demo-only'; caption?: { en: string; es: string } };
}[] = [
  {
    name: 'Arepera La Guacamaya',
    summary: {
      en: 'A neighbourhood arepa house steps from the malecón, a fixture of Puerto Cabello breakfasts. Filled arepas come off the griddle from early morning.',
      es: 'Arepera de barrio a pasos del malecón, clásica en los desayunos porteños. Arepas rellenas salen de la plancha desde temprano.',
    },
    sources: [{ label: 'Arepa · referencia cultural', url: 'https://es.wikipedia.org/wiki/Arepa' }],
    image: {
      url: '/demo/puerto-cabello/arepa-la-guacamaya.jpg', credit: 'Muago / Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Arepa_frita.jpg',
      license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      caption: { en: 'Arepa frita · illustrative photo', es: 'Arepa frita · imagen ilustrativa' },
    },
  },
  {
    name: 'Arepera El Malecón',
    summary: {
      en: 'An arepa stand on the waterfront promenade, popular with the evening paseo crowd. Cheese, shredded beef and beans are the standing favourites.',
      es: 'Puesto de arepas en el paseo marítimo, popular entre la gente del paseo de la tarde. Queso, carne mechada y caraotas son los favoritos de siempre.',
    },
    sources: [{ label: 'Arepa · referencia cultural', url: 'https://es.wikipedia.org/wiki/Arepa' }],
    image: {
      url: '/demo/puerto-cabello/arepa-el-malecon.jpg', credit: 'Pintoandres90 / Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Arepa_de_trigo.JPG',
      license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      caption: { en: 'Wheat arepas · illustrative photo', es: 'Arepas de trigo · imagen ilustrativa' },
    },
  },
  {
    name: 'Empanadas del Malecón',
    summary: {
      en: 'A street cart of fried Venezuelan empanadas by the waterfront, from cheese and beans to shark and chicken fillings.',
      es: 'Carrito de empanadas fritas venezolanas junto al paseo marítimo, desde queso y caraotas hasta cazón y pollo.',
    },
    sources: [{ label: 'Empanada · referencia cultural', url: 'https://es.wikipedia.org/wiki/Empanada' }],
    image: {
      url: '/demo/puerto-cabello/empanadas-malecon.jpg', credit: 'Wilfredor / Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Empanadas_Venezolanas.jpg',
      license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      caption: { en: 'Venezuelan empanadas · illustrative photo', es: 'Empanadas venezolanas · imagen ilustrativa' },
    },
  },
  {
    name: 'Mercado Artesanal del Malecón',
    summary: {
      en: 'An artisan market of Venezuelan crafts along the malecón: woven bags, hammocks and carvings from the region.',
      es: 'Mercado artesanal de manualidades venezolanas a lo largo del malecón: bolsos tejidos, hamacas y tallas de la región.',
    },
    sources: [{ label: 'Artesanía · referencia cultural', url: 'https://es.wikipedia.org/wiki/Artesan%C3%ADa' }],
    image: {
      url: '/demo/puerto-cabello/mercado-artesanal.jpg', credit: 'JesusLuc11 / Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mercado_Artesanal_M%C3%A9rida.jpg',
      license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      caption: { en: 'Artisan market, Mérida · illustrative photo', es: 'Mercado artesanal, Mérida · imagen ilustrativa' },
    },
  },
  {
    name: 'Playa Quizandal',
    summary: {
      en: 'Quizandal is Puerto Cabello’s local beach just east of the port, with calm water and a line of palapas. Conditions vary; check before swimming.',
      es: 'Quizandal es la playa local de Puerto Cabello, al este del puerto, con aguas tranquilas y una línea de palapas. Las condiciones varían; consulta antes de bañarte.',
    },
    sources: [{ label: 'Puerto Cabello · la ciudad y sus playas', url: 'https://es.wikipedia.org/wiki/Puerto_Cabello' }],
    image: {
      url: '/demo/puerto-cabello/playa-quizandal.jpg', credit: 'Juliocesarat / Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Playa_quizandal_(Pto_Cabello_-_Carabobo).jpg',
      license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    },
  },
  {
    name: 'Playita El Faro',
    summary: {
      en: 'A small cove near the harbour light where locals dip on hot afternoons; more a corner than a maintained beach.',
      es: 'Una calita cerca del faro del puerto donde los locales se refrescan en las tardes calurosas; más un rincón que una playa mantenida.',
    },
    sources: [{ label: 'Puerto Cabello · la ciudad y su malecón', url: 'https://es.wikipedia.org/wiki/Puerto_Cabello' }],
    image: {
      url: '/demo/puerto-cabello/malecon-atardecer.webp', credit: 'Ana Chreky / Wikimedia Commons · 2014', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Atardecer_en_el_malec%C3%B3n_de_Puerto_Cabello.JPG',
      license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      caption: { en: 'The waterfront it sits on, at sunset · setting, not the cove itself', es: 'El paseo donde se encuentra, al atardecer · ambiente, no la cala en sí' },
    },
  },
  {
    name: 'Panadería La Sirena',
    summary: {
      en: 'A neighbourhood bakery turning out pan canilla and sweet breads through the morning, the smell carrying down the street.',
      es: 'Panadería de barrio que saca pan canilla y panes dulces durante la mañana, con el olor que baja por la calle.',
    },
    sources: [{ label: 'Pan · referencia cultural', url: 'https://es.wikipedia.org/wiki/Pan' }],
    image: {
      url: '/demo/puerto-cabello/panaderia-la-sirena.jpg', credit: 'Mordaz / Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Aponwao_panaderia_gran_sabana_venezuela.jpg',
      license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      caption: { en: 'A Venezuelan bakery · illustrative photo', es: 'Una panadería venezolana · imagen ilustrativa' },
    },
  },
  {
    name: 'Mercadito La Sirena',
    summary: {
      en: 'A small family grocer’s stall with fruit, vegetables and daily staples for the surrounding blocks.',
      es: 'Un mercadito familiar con frutas, verduras y lo básico del día para las cuadras vecinas.',
    },
    sources: [{ label: 'Mercado · referencia cultural', url: 'https://es.wikipedia.org/wiki/Mercado' }],
    image: {
      url: '/demo/puerto-cabello/mercadito-frutas.jpg', credit: 'Virginia Ortiz / Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tienda_de_Frutas_M%C3%A9rida.jpg',
      license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      caption: { en: 'Fruit stall, Mérida · illustrative photo', es: 'Puesto de frutas, Mérida · imagen ilustrativa' },
    },
  },
];

/** The cast's own verified venues: the map needs its verified pins, and a
 * fresh database must reproduce them rather than depend on rows someone
 * inserted by hand years ago. Two cast members stand as the two witnesses,
 * which is what the fixtures in the long-lived dev database always claimed.
 * Insert-if-missing only: an existing row (its witnesses, posts, trends)
 * is never touched. */
const DEMO_CAST_VENUES: {
  id: string; name: string; category: string; landmark: string; lat: number; lon: number; priceBand: number;
}[] = [
  { id: '00000000-0000-4000-8000-00000000f101', name: 'Arepera La Guacamaya', category: 'eat_drink', landmark: 'Casa amarilla al lado del puente, frente al malecón', lat: 10.4716, lon: -68.0088, priceBand: 1 },
  { id: '00000000-0000-4000-8000-00000000f102', name: 'Empanadas del Malecón', category: 'eat_drink', landmark: 'Carrito rojo en la esquina del paseo', lat: 10.4708, lon: -68.0075, priceBand: 1 },
  { id: '00000000-0000-4000-8000-00000000f103', name: 'Playa Quizandal', category: 'beach_water', landmark: 'Al este del puerto, tras la zona naval', lat: 10.4560, lon: -68.0020, priceBand: 1 },
  { id: '00000000-0000-4000-8000-00000000f104', name: 'Mercado Artesanal del Malecón', category: 'market_shop', landmark: 'Bajo los árboles del paseo, junto a la plaza', lat: 10.4698, lon: -68.0068, priceBand: 2 },
  { id: '00000000-0000-4000-8000-00000000f105', name: 'Playita El Faro', category: 'beach_water', landmark: 'Junto al faro, al final del muelle viejo', lat: 10.4702, lon: -68.0055, priceBand: 1 },
  { id: '00000000-0000-4000-8000-00000000f106', name: 'Arepera El Malecón', category: 'eat_drink', landmark: 'Frente a la fuente, media cuadra del paseo', lat: 10.4693, lon: -68.0062, priceBand: 1 },
  { id: '00000000-0000-4000-8000-00000000f107', name: 'Panadería La Sirena', category: 'eat_drink', landmark: 'Esquina de Comercio, azul con toldo blanco', lat: 10.4685, lon: -68.0048, priceBand: 1 },
  { id: '00000000-0000-4000-8000-00000000f108', name: 'Mercadito La Sirena', category: 'market_shop', landmark: 'Puerta al lado de la panadería del mismo nombre', lat: 10.4684, lon: -68.0047, priceBand: 1 },
];

/** Any visible DEV marker, as a word: ' [DEV]', '[DEV]', a bare 'DEV'. */
const DEV_MARKER_RE = '\\s*\\[?[Dd][Ee][Vv]\\]?\\y';

/**
 * The demo database's people and content, provisioned through the same
 * tables the product uses. Run explicitly after the public place seed.
 * Idempotent: re-running renames, upserts and skips what already exists, and
 * never changes an existing account's login credentials. Invented cast rows
 * are designated only by their @demo.guaca.live email; every name a visitor
 * can see stays clean.
 */
export async function seedDemoAccount(pool: Pool) {
  const client = await pool.connect();
  let open = false; // the catch must not roll back a transaction already committed
  try {
    await client.query('begin');
    open = true;
    const places = await client.query<{ id: string; osm_id: string }>(
      `select id, osm_id from places where area_id = $1 and osm_id = any($2::bigint[])
         and ((verification_status = 'candidate' and corroboration >= 1)
           or (verification_status = 'verified' and witness_count >= 2))`,
      [DEMO_AREA_ID, PUERTO_CABELLO_PROFILES.map((p) => p.osmId)],
    );
    const byOsm = new Map(places.rows.map((p) => [Number(p.osm_id), p.id]));
    if (byOsm.size !== PUERTO_CABELLO_PROFILES.length) {
      throw new Error(`Seed Puerto Cabello first: all ${PUERTO_CABELLO_PROFILES.length} eligible public profiles are required.`);
    }

    // Clean names, hidden designation. Rows are renamed, never deleted.
    await client.query(
      `update places set name = btrim(regexp_replace(name, $2, '', 'g'))
        where area_id = $1 and name ilike '%dev%'`,
      [DEMO_AREA_ID, DEV_MARKER_RE],
    );
    await client.query(
      `update spotters set name = btrim(regexp_replace(name, $2, '', 'g'))
        where area_id = $1 and name ilike '%dev%'`,
      [DEMO_AREA_ID, DEV_MARKER_RE],
    );
    for (const member of DEMO_CAST) {
      await client.query(
        `insert into spotters (name, email, phone, area_id, home_h3, language)
           values ($1, $2, $3, $4, $5, 'es')
         on conflict (phone) do update set
           name = excluded.name,
           email = case
             when spotters.email is null
                  or spotters.email like '%@demo.guaca.live'
                  or spotters.email like '%@spotters.guaca.dev'
               then excluded.email
             else spotters.email end`,
        [member.name, member.email, member.phone, DEMO_AREA_ID, member.zone],
      );
    }
    // The cast's venues, created where missing so a fresh database shows the
    // same verified map. Two cast members are the recorded witnesses.
    const witnesses = await client.query<{ id: string }>(
      `select id from spotters where area_id = $1 and email = any($2) order by email`,
      [DEMO_AREA_ID, ['maria@demo.guaca.live', 'yorman@demo.guaca.live']],
    );
    const [witnessA, witnessB] = witnesses.rows;
    if (!witnessA || !witnessB) throw new Error('Cast witnesses missing; the roster upsert above must run first.');
    for (const venue of DEMO_CAST_VENUES) {
      await client.query(
        `insert into places (id, area_id, name, category, landmark_description, location, h3_8, source,
             verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id, verified_at, price_band)
           select $1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, '8a0000000000000', 'spotter',
             'verified', 2, $8, $9, now(), $10
           where not exists (select 1 from places where area_id = $2 and name = $3)`,
        [venue.id, DEMO_AREA_ID, venue.name, venue.category, venue.landmark, venue.lon, venue.lat, witnessA.id, witnessB.id, venue.priceBand],
      );
    }
    // Photo-backed demo profiles on the cast venues, so the map's verified
    // pins and the discovery rows carry images for the recording. Runs after
    // the venues exist above, so a first-ever run attaches immediately.
    // Replaces only profiles this seeder wrote (demo: true); a genuine local
    // profile always wins.
    let castProfiles = 0;
    for (const venue of DEMO_CAST_PROFILES) {
      const profile = PublicPlaceProfileSchema.parse({
        demo: true, researchedAt: RESEARCHED_AT, summary: venue.summary, image: venue.image,
        sources: venue.sources,
      });
      const updated = await client.query(
        `update places set public_profile = $3::jsonb
           where area_id = $1 and name = $2 and source = 'spotter'
             and (public_profile is null or public_profile->>'demo' = 'true')`,
        [DEMO_AREA_ID, venue.name, JSON.stringify(profile)],
      );
      castProfiles += updated.rowCount ?? 0;
    }
    // Per-business publishing accounts: the tourist door the post composer
    // uses. Anonymous by design, the body carries the business attribution.
    for (const post of DEMO_BUSINESS_POSTS) {
      await client.query(
        `insert into tourists (email, language) values ($1, 'es')
           on conflict (email) do update set email = excluded.email`,
        [post.account],
      );
    }

    const account = await client.query<{ id: string }>(
      `insert into tourists (email, language) values ($1, 'es')
       on conflict (email) do update set email = excluded.email returning id`,
      [DEMO_TRAVELLER_EMAIL],
    );
    const touristId = account.rows[0]!.id;
    await client.query(
      `insert into tourist_favorites (tourist_id, place_id)
       select $1, unnest($2::uuid[]) on conflict do nothing`,
      [touristId, places.rows.map((p) => p.id)],
    );
    // A curated day using actual catalog IDs; suggested times, no opening-hour claims.
    const stops = [
      { osmId: 1482081795, startMin: 9 * 60, durationMin: 60 },
      { osmId: 157189923, startMin: 10 * 60 + 30, durationMin: 45 },
      { osmId: 13588404801, startMin: 12 * 60, durationMin: 90 },
      { osmId: 203615814, startMin: 15 * 60, durationMin: 60 },
    ].map(({ osmId, ...timing }) => TripStopSchema.parse({
      placeId: byOsm.get(osmId), dayIndex: 0, ...timing, reasonCode: 'SEQUENCE_FIT',
    }));
    groundFromVerifiedRows(stops, new Set(places.rows.map((p) => p.id)));
    await client.query(
      `insert into trips (id, tourist_id, question, language, stops, share_slug)
       values ($1, $2, 'Un día entre historia, plazas y sabores de Puerto Cabello', 'es', $3::jsonb, $4)
       on conflict (id) do nothing`,
      [TRIP_ID, touristId, JSON.stringify(stops), randomBytes(8).toString('base64url')],
    );
    const trip = await client.query<{ share_slug: string }>(
      'select share_slug from trips where id = $1 and tourist_id = $2', [TRIP_ID, touristId],
    );
    if (!trip.rows[0]) throw new Error('The starter trip ID belongs to another account; no data was changed.');

    // Cartagena, on the same account — additive only, and only once the
    // Cartagena population has run. Nothing here touches the Puerto Cabello
    // favorites or the starter trip above, and re-runs insert nothing.
    let cartagenaSaved = 0;
    const cartagenaSlugs: string[] = [];
    const cartagenaArea = await client.query<{ id: string }>(
      'select id from areas where slug = $1', ['cartagena'],
    );
    const cartagenaAreaId = cartagenaArea.rows[0]?.id;
    if (cartagenaAreaId) {
      const ctg = await client.query<{ id: string; osm_id: string }>(
        `select id, osm_id from places where area_id = $1 and osm_id = any($2::bigint[])
           and ((verification_status = 'candidate' and corroboration >= 1)
             or (verification_status = 'verified' and witness_count >= 2))`,
        [cartagenaAreaId, CARTAGENA_PROFILES.map((p) => p.osmId)],
      );
      const ctgByOsm = new Map(ctg.rows.map((p) => [Number(p.osm_id), p.id]));
      const favoriteIds = CARTAGENA_FAVORITE_OSM_IDS
        .map((osmId) => ctgByOsm.get(osmId))
        .filter((id): id is string => Boolean(id));
      if (favoriteIds.length > 0) {
        await client.query(
          `insert into tourist_favorites (tourist_id, place_id)
           select $1, unnest($2::uuid[]) on conflict do nothing`,
          [touristId, favoriteIds],
        );
        cartagenaSaved = favoriteIds.length;
      }
      // Two independently identified itineraries: a historic-center day and
      // a two-day city/beach split. Suggested local times, never opening-hour
      // claims; every stop resolves to a real Cartagena record or the trip
      // is skipped whole.
      const stop = (osmId: number, dayIndex: number, startMin: number, durationMin: number) =>
        TripStopSchema.parse({ placeId: ctgByOsm.get(osmId), dayIndex, startMin, durationMin, reasonCode: 'SEQUENCE_FIT' });
      for (const fixture of CARTAGENA_TRIPS) {
        if (!fixture.stops.every((s) => ctgByOsm.has(s.osmId))) continue;
        const stops = fixture.stops.map(({ osmId, ...timing }) => stop(osmId, timing.dayIndex, timing.startMin, timing.durationMin));
        groundFromVerifiedRows(stops, new Set(ctg.rows.map((p) => p.id)));
        await client.query(
          `insert into trips (id, tourist_id, question, language, stops, share_slug)
           values ($1, $2, $3, 'es', $4::jsonb, $5)
           on conflict (id) do nothing`,
          [fixture.id, touristId, fixture.question, JSON.stringify(stops), randomBytes(8).toString('base64url')],
        );
        const saved = await client.query<{ share_slug: string }>(
          'select share_slug from trips where id = $1 and tourist_id = $2', [fixture.id, touristId],
        );
        if (!saved.rows[0]) throw new Error(`The fixture trip ${fixture.id} belongs to another account; no data was changed.`);
        cartagenaSlugs.push(saved.rows[0].share_slug);
      }
    }
    await client.query('commit');
    open = false;

    // Posts and operator access run after commit: place_posts references the
    // publisher accounts, and these helpers each take the pool.
    let businessPosts = 0;
    for (const post of DEMO_BUSINESS_POSTS) {
      const place = await pool.query<{ id: string }>(
        'select id from places where area_id = $1 and osm_type = $2 and osm_id = $3',
        [DEMO_AREA_ID, post.osmType, post.osmId],
      );
      const publisher = await pool.query<{ id: string }>(
        'select id from tourists where email = $1', [post.account],
      );
      const placeId = place.rows[0]?.id;
      const publisherId = publisher.rows[0]?.id;
      if (!placeId || !publisherId) continue; // the place seed has not run for this row
      const exists = await pool.query(
        'select 1 from place_posts where place_id = $1 and tourist_id = $2 and body = $3',
        [placeId, publisherId, post.body],
      );
      if (exists.rowCount === 0) {
        await addPlacePost(pool, {
          placeId, touristId: publisherId, body: post.body,
          mediaUrl: null, visited: false, rating: null,
        });
      }
      businessPosts += 1;
    }

    // The operator the recording logs in as: a real waitlist registration,
    // handled, and a real operators row the email-code door accepts.
    await recordRegistration(pool, {
      role: 'owner',
      name: 'Casa Rosada',
      contact: CASA_ROSADA_OPERATOR_EMAIL,
      language: 'es',
      details: { where: 'Venezuela', countryCode: 'VE', business: 'Casa Rosada' },
    });
    await pool.query(
      `update registrations set
         handled_at = coalesce(handled_at, now()),
         operator_note = coalesce(operator_note, 'Approved during the Puerto Cabello pilot; operator access granted.')
       where role = 'owner' and lower(contact) = $1`,
      [CASA_ROSADA_OPERATOR_EMAIL],
    );
    const operator = await upsertOperator(pool, {
      email: CASA_ROSADA_OPERATOR_EMAIL,
      name: 'Equipo Casa Rosada',
      role: 'operator',
    });

    const cast = await pool.query<{ n: number }>(
      'select count(*)::int as n from spotters where area_id = $1', [DEMO_AREA_ID],
    );
    return {
      email: DEMO_TRAVELLER_EMAIL,
      touristId,
      savedPlaces: places.rows.length,
      shareSlug: trip.rows[0].share_slug,
      cartagenaSavedPlaces: cartagenaSaved,
      cartagenaTrips: cartagenaSlugs.length,
      castSpotters: cast.rows[0]!.n,
      castProfiles,
      businessPosts,
      operatorEmail: operator.email,
    };
  } catch (error) {
    if (open) await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
