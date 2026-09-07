import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { PublicPlaceProfileSchema, type PublicPlaceProfile } from '@guaca/shared';
import { seed } from './index.js';
import { importOsmCandidates } from './osmImport.js';
import { recordSource } from './placeSources.js';

const RESEARCHED_AT = '2026-09-06';

/** The researched area frame (see CARIBBEAN_CITIES): Centro Histórico,
 *  Getsemaní, the Castillo and Bocagrande, with Marbella inside. */
const AREA_BBOX = '10.3915,-75.5770,10.4515,-75.5170';

interface ProfileSeed {
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string;
  summary: PublicPlaceProfile['summary'];
  gettingThere?: PublicPlaceProfile['gettingThere'];
  sources?: PublicPlaceProfile['sources'];
  website?: string;
  phone?: string;
  address?: string;
  image?: PublicPlaceProfile['image'];
}

/** Cartagena sights whose OSM tags (tourism=attraction, historic=citywalls,
 *  shop=gift) the generic importer cannot map onto the taxonomy. They are
 *  still open-data records: inserted as candidates with an explicit,
 *  researched category so the curated set is whole. Insert-if-missing only,
 *  keyed on the OSM identity: never a name-based update. */
const CURATED_RECORDS: {
  osmType: 'node' | 'way';
  osmId: number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  landmark: string;
}[] = [
  { osmType: 'way', osmId: 955128419, name: 'Puerta del Reloj', category: 'culture_history', lat: 10.4230397, lon: -75.5492190, landmark: 'La torre del reloj, entrada monumental del centro histórico' },
  { osmType: 'way', osmId: 63525986, name: 'Las Murallas de Cartagena', category: 'culture_history', lat: 10.4272918, lon: -75.5494101, landmark: 'Recorrido amurallado por el norte del centro histórico' },
  { osmType: 'node', osmId: 5434244523, name: 'Plaza de La Trinidad', category: 'culture_history', lat: 10.4206140, lon: -75.5453984, landmark: 'La plaza de Getsemaní, junto a su iglesia' },
  { osmType: 'node', osmId: 887632863, name: 'Las Bovedas', category: 'market_shop', lat: 10.4300158, lon: -75.5465376, landmark: 'Los arcos del norte de la muralla, hoy artesanías' },
  { osmType: 'node', osmId: 4932625023, name: 'Plaza de los coches', category: 'market_shop', lat: 10.4231040, lon: -75.5493530, landmark: 'Junto a la Torre del Reloj; Portal de los Dulces en su lado porticado' },
];

/** Short original summaries of public listings. No invented hours, ratings,
 *  photographs, reviews, local witnesses or partnership claims. Facts that
 *  name times or entry conditions come from the cited official page; the
 *  absence of a fact never becomes a claim. Additional web references never
 *  increment the independent open-dataset count. */
export const CARTAGENA_PROFILES: ProfileSeed[] = [
  {
    osmType: 'way', osmId: 955128419, name: 'Puerta del Reloj',
    image: { url: '/demo/cartagena/torre-del-reloj.jpg', credit: 'David Shankbone / Wikimedia Commons · 2013', sourceUrl: 'https://commons.wikimedia.org/wiki/File:024_Torre_del_Reloj_Cartagena_Colombia.JPG', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' },
    summary: {
      en: 'The clock tower gate, the Torre del Reloj, is the monumental entrance to the walled city, opening onto Plaza de los Coches. It is Cartagena’s most photographed landmark.',
      es: 'La Puerta y Torre del Reloj es la entrada monumental de la ciudad amurallada, que desemboca en la Plaza de los Coches. Es el monumento más fotografiado de Cartagena.',
    },
    gettingThere: {
      en: 'A short walk from anywhere in Centro Histórico or across the bridge from Getsemaní; most city buses and taxis drop off nearby.',
      es: 'A pie desde cualquier punto del Centro Histórico o cruzando el puente desde Getsemaní; la mayoría de buses y taxis dejan cerca.',
    },
    sources: [{ label: 'Colombia Travel · la Torre del Reloj', url: 'https://colombia.travel/es/cartagena/visita-la-puerta-y-la-torre-del-reloj' }],
  },
  {
    osmType: 'way', osmId: 49551791, name: 'Castillo San Felipe de Barajas',
    image: { url: '/demo/cartagena/castillo-san-felipe.jpg', credit: 'Bernard Gagnon / Wikimedia Commons · 2020', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Castillo_San_Felipe_de_Barajas,_Cartagena_14.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    summary: {
      en: 'The great colonial fortress on the hill of San Lázaro, guarding the city’s eastern approach. The official fortifications site publishes a daily 7 a.m.–6 p.m. opening with paid entry; tunnels and ramparts can be explored on foot.',
      es: 'La gran fortaleza colonial sobre el cerro de San Lázaro, custodiando el acceso oriental de la ciudad. El sitio oficial de fortificaciones publica horario diario de 7 a.m. a 6 p.m. con entrada pagada; túneles y murallas se recorren a pie.',
    },
    gettingThere: {
      en: 'A 15-minute walk uphill from Getsemaní along the Av. de los Ejércitos Leales, or a short taxi ride; the entrance is on the eastern side.',
      es: 'A 15 minutos a pie cuesta arriba desde Getsemaní por la Av. de los Ejércitos Leales, o un trayecto corto en taxi; la entrada está al lado oriental.',
    },
    sources: [{ label: 'Fortificaciones de Cartagena · planee su visita', url: 'https://fortificacionescartagena.com.co/es/planee-su-visita/castillo-de-san-felipe-de-barajas/' }, { label: 'Colombia Travel · Cartagena colonial', url: 'https://colombia.travel/es/cartagena/cartagena-colonial' }],
  },
  {
    osmType: 'way', osmId: 63525986, name: 'Las Murallas de Cartagena',
    image: { url: '/demo/cartagena/murallas-santo-domingo.jpg', credit: 'Mariordo (Mario Roberto Durán Ortiz) / Wikimedia Commons · 2019', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Panorama_Baluarte_de_Santo_Domingo_CTG_11_2019_2143.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    summary: {
      en: 'The city walls, raised over two centuries against sea and raiders. Several stretches are walkable on top; the Baluarte de Santo Domingo section by the ocean is a classic sunset spot.',
      es: 'Las murallas de la ciudad, levantadas durante dos siglos contra el mar y los corsarios. Varios tramos se caminan por encima; la sección del Baluarte de Santo Domingo junto al mar es un clásico del atardecer.',
    },
    gettingThere: {
      en: 'Stair access points sit along the walls themselves; the Santo Domingo stretch is beside the ocean on the centro side, a few minutes from Plaza Santo Domingo.',
      es: 'Los accesos con escaleras están sobre la propia muralla; el tramo de Santo Domingo queda junto al mar del lado del centro, a minutos de la Plaza Santo Domingo.',
    },
    sources: [{ label: 'Colombia Travel · las Murallas de Cartagena', url: 'https://colombia.travel/es/cartagena/las-murallas-de-cartagena' }],
  },
  {
    osmType: 'node', osmId: 838199148, name: 'Iglesia de Santo Domingo',
    image: { url: '/demo/cartagena/iglesia-santo-domingo.jpg', credit: 'Kamilokardona / Wikimedia Commons · 2011', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Iglesia_y_plaza_de_Santo_Domingo._Cartagena._Colombia.JPG', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' },
    summary: {
      en: 'The ochre church presiding over Plaza Santo Domingo, the walled city’s liveliest colonial square, where the reclining Botero bronze sits in the open.',
      es: 'La iglesia ocre que preside la Plaza Santo Domingo, la plaza colonial más viva de la ciudad amurallada, donde descansa la escultura reclinada de Botero.',
    },
    gettingThere: {
      en: 'In the heart of Centro Histórico, five minutes on foot from the Catedral; the plaza is ringed by cafés and restaurant terraces.',
      es: 'En pleno Centro Histórico, a cinco minutos a pie de la Catedral; la plaza está rodeada de cafés y terrazas.',
    },
    sources: [{ label: 'Colombia Travel · la Plaza de Santo Domingo', url: 'https://colombia.travel/es/cartagena/la-plaza-de-santo-domingo' }],
  },
  {
    osmType: 'way', osmId: 95018532, name: 'Teatro Adolfo Mejía',
    image: { url: '/demo/cartagena/teatro-adolfo-mejia.jpg', credit: 'Bernard Gagnon / Wikimedia Commons · 2020', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Teatro_Adolfo_Mej%C3%ADa,_Cartagena_02.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    summary: {
      en: 'The 19th-century theatre on Plaza de la Merced, also known as Teatro Heredia. It works as a performance venue rather than a walk-in attraction: interior visits depend on the programme.',
      es: 'El teatro del siglo XIX en la Plaza de la Merced, también conocido como Teatro Heredia. Funciona como escenario de espectáculos más que como atracción de visita libre: el acceso al interior depende de la programación.',
    },
    gettingThere: {
      en: 'Behind the Catedral on Plaza de la Merced, an easy stop on any walk through Centro Histórico.',
      es: 'Detrás de la Catedral, sobre la Plaza de la Merced; una parada fácil en cualquier recorrido por el Centro Histórico.',
    },
    sources: [{ label: 'Colombia Travel · Teatro Adolfo Mejía', url: 'https://colombia.travel/es/cartagena/teatro-adolfo-mejia' }, { label: 'IPCC · Teatro Adolfo Mejía', url: 'https://ipcc.gov.co/escenarios-culturales-vivos/teatro-adolfo-mejia/' }],
  },
  {
    osmType: 'way', osmId: 49666923, name: 'Catedral de Santa Catalina de Alejandría',
    image: { url: '/demo/cartagena/catedral-santa-catalina.jpg', credit: 'Mariordo (Mario Roberto Durán Ortiz) / Wikimedia Commons · 2019', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Catedral_Santa_Catalina_CTG_11_2019_1688.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    summary: {
      en: 'Cartagena’s main cathedral, begun in the 16th century, with its massive Coralline-stone tower facing Parque de Bolívar in the middle of the walled city.',
      es: 'La catedral principal de Cartagena, iniciada en el siglo XVI, con su maciza torre de piedra coralina frente al Parque de Bolívar, en medio de la ciudad amurallada.',
    },
    gettingThere: {
      en: 'On Parque de Bolívar in Centro Histórico, two blocks from the Museo del Oro Zenú.',
      es: 'Sobre el Parque de Bolívar en el Centro Histórico, a dos cuadras del Museo del Oro Zenú.',
    },
    sources: [{ label: 'Colombia Travel · recorrido por el centro histórico', url: 'https://colombia.travel/es/cartagena/recorrido-por-el-centro-historico-de-cartagena' }],
  },
  {
    osmType: 'node', osmId: 7154999586, name: 'Museo del Oro Zenú',
    image: { url: '/demo/cartagena/museo-oro-zenu.jpg', credit: 'Xemenendura / Wikimedia Commons · 2025', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Museo_del_Oro_Zen%C3%BA_i.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    summary: {
      en: 'The Banco de la República’s gold museum on Parque de Bolívar: pre-Hispanic Zenú goldwork and ceramics in a restored colonial house. Admission is free; it closes on Mondays.',
      es: 'El museo del oro del Banco de la República sobre el Parque de Bolívar: orfebrería y cerámica zenú prehispánica en una casa colonial restaurada. La entrada es gratuita; cierra los lunes.',
    },
    gettingThere: {
      en: 'Facing Parque de Bolívar in Centro Histórico; the Catedral is on the same square.',
      es: 'Frente al Parque de Bolívar en el Centro Histórico; la Catedral está en la misma plaza.',
    },
    sources: [{ label: 'Banco de la República · programe su visita', url: 'https://www.banrepcultural.org/cartagena/museo-del-oro-zenu/programe-su-visita' }],
  },
  {
    osmType: 'node', osmId: 5434244523, name: 'Plaza de La Trinidad',
    image: { url: '/demo/cartagena/plaza-trinidad.jpg', credit: 'Joe Ross from Lansing, Michigan / Wikimedia Commons · 2016', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plaza_Trinidad,_Getsemani_Street_Scene,_Cartagena,_Colombia_(24503272541).jpg', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/' },
    summary: {
      en: 'Getsemaní’s beating heart: the square in front of the Iglesia de la Trinidad, where locals play dominoes, street food carts set up at dusk and the neighbourhood’s painted alleys begin.',
      es: 'El corazón de Getsemaní: la plaza frente a la Iglesia de la Trinidad, donde los locales juegan dominó, los carritos salen al atardecer y empiezan los callejones pintados del barrio.',
    },
    gettingThere: {
      en: 'At the centre of Getsemaní, across the bridge from the Torre del Reloj and a ten-minute walk from the walled city.',
      es: 'En el centro de Getsemaní, cruzando el puente desde la Torre del Reloj y a diez minutos a pie de la ciudad amurallada.',
    },
    sources: [{ label: 'Cartagena · visitor map 2026', url: 'https://atuladocartagena.com/wp-content/uploads/2026/01/ES_CityMapCTG.pdf' }],
  },
  {
    osmType: 'way', osmId: 25841728, name: 'Parque Centenario',
    image: { url: '/demo/cartagena/parque-centenario.jpg', credit: 'Miguel Santos / Wikimedia Commons · 2017', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Parque_centenario_-_Cartagena.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', caption: { en: 'One of the park’s iguanas', es: 'Una de las iguanas del parque' } },
    summary: {
      en: 'The leafy park between Getsemaní and the centro, with old trees, iguanas and monuments to the city’s independence century. A calm cut-through between the two neighbourhoods.',
      es: 'El parque frondoso entre Getsemaní y el centro, con árboles viejos, iguanas y monumentos del centenario de la independencia. Un cruce tranquilo entre los dos barrios.',
    },
    gettingThere: {
      en: 'Between Getsemaní and Centro Histórico, a few minutes on foot from Plaza de la Trinidad.',
      es: 'Entre Getsemaní y el Centro Histórico, a pocos minutos a pie de la Plaza de la Trinidad.',
    },
    sources: [{ label: 'Cartagena · visitor map 2026', url: 'https://atuladocartagena.com/wp-content/uploads/2026/01/ES_CityMapCTG.pdf' }],
  },
  {
    osmType: 'node', osmId: 887632863, name: 'Las Bovedas',
    image: { url: '/demo/cartagena/las-bovedas.jpg', credit: 'Joe Ross from Lansing, Michigan / Wikimedia Commons · 2016', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Galeria_de_las_Bovedas,_Cartagena,_Colombia_(24051810139).jpg', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/' },
    summary: {
      en: 'The 23 vaulted storerooms built into the northern wall, today a row of craft and souvenir arcades: mochilas, hats and jewellery between the Santa Clara and Santa Catalina bastions.',
      es: 'Los 23 almacenes abovedados del muro norte, hoy una galería de artesanías y recuerdos: mochilas, sombreros y joyería entre los baluartes de Santa Clara y Santa Catalina.',
    },
    gettingThere: {
      en: 'At the northern tip of the walled city; most wall-top walks end here.',
      es: 'En el extremo norte de la ciudad amurallada; buena parte de los recorridos por la muralla terminan aquí.',
    },
    sources: [{ label: 'Colombia Travel · conoce Las Bóvedas', url: 'https://colombia.travel/es/cartagena/conoce-las-bovedas' }],
  },
  {
    osmType: 'node', osmId: 4932625023, name: 'Plaza de los coches',
    image: { url: '/demo/cartagena/plaza-de-los-coches.jpg', credit: 'Jorge Láscar from Australia / Wikimedia Commons · 2009', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Puerta_del_Reloj_(Clock_Gate)_and_Plaza_de_los_Coches_(Square_of_the_Carriages)_(4625702763).jpg', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
    summary: {
      en: 'The first square inside the clock tower, whose arcaded side, the Portal de los Dulces, groups stalls of traditional coconut- and fruit-based sweets.',
      es: 'La primera plaza dentro de la Torre del Reloj, cuyo lado porticado, el Portal de los Dulces, reúne puestos de dulces tradicionales de coco y frutas.',
    },
    gettingThere: {
      en: 'Directly across from the Torre del Reloj entrance; every walk into the walled city starts here.',
      es: 'Frente a la entrada de la Torre del Reloj; todo recorrido a pie por la ciudad amurallada empieza aquí.',
    },
    sources: [
      { label: 'Colombia Travel · arquitectura colonial', url: 'https://colombia.travel/en/cartagena/colonial-architecture-cartagena' },
      { label: 'Colombia Travel · recorrido por el centro histórico', url: 'https://colombia.travel/es/cartagena/recorrido-por-el-centro-historico-de-cartagena' },
    ],
  },
  {
    osmType: 'way', osmId: 25446658, name: 'Bocagrande',
    image: { url: '/demo/cartagena/playa-bocagrande.jpg', credit: 'Pedro Szekely / Wikimedia Commons · 2010', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Playa_de_Bocagrande,_Cartagena,_Colombia.jpg', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
    summary: {
      en: 'Cartagena’s high-rise beach strip: palapas and beach vendors along the sand of the Bocagrande peninsula. Sea conditions vary; swim where locals swim.',
      es: 'La franja de playa de las torres de Cartagena: palapas y vendedores a lo largo de la arena de la península de Bocagrande. Las condiciones del mar varían; báñate donde se bañan los locales.',
    },
    gettingThere: {
      en: 'Ten to fifteen minutes by taxi from the walled city, or a walkable 2 km along the waterfront; city buses run the peninsula avenue.',
      es: 'Diez a quince minutos en taxi desde la ciudad amurallada, o 2 km caminables por el malecón; los buses urbanos recorren la avenida de la península.',
    },
    sources: [{ label: 'Colombia Travel · playas de Cartagena', url: 'https://colombia.travel/es/cartagena/playas-de-marbella-y-la-boquilla' }],
  },
  {
    osmType: 'node', osmId: 10278478997, name: 'Playa de Marbella',
    image: { url: '/demo/cartagena/playa-marbella.jpg', credit: 'Nickeyra / Wikimedia Commons · 2008', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Playas_marbella,_Cartagena_de_indias_Colombia-2008_14.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    summary: {
      en: 'The open-ocean beach just north of the old city, popular with locals and facing the Caribbean rather than the bay. Waves and currents are stronger than inside the bay.',
      es: 'La playa de mar abierto al norte del casco antiguo, popular entre locales y de cara al Caribe y no a la bahía. El oleaje y las corrientes son más fuertes que dentro de la bahía.',
    },
    gettingThere: {
      en: 'A 10-minute walk from the centro through Marbella; taxis drop at the seaside avenue.',
      es: 'A diez minutos a pie del centro por el barrio Marbella; los taxis dejan en la avenida del mar.',
    },
    sources: [{ label: 'Colombia Travel · playas de Marbella y La Boquilla', url: 'https://colombia.travel/es/cartagena/playas-de-marbella-y-la-boquilla' }],
  },
  {
    osmType: 'node', osmId: 9159612217, name: 'Celele',
    summary: {
      en: 'A contemporary Colombian-Caribbean restaurant in a blue colonial house in Getsemaní, drawing on the culinary research of the Proyecto Caribe Lab. Ranked on the World’s 50 Best lists in 2025.',
      es: 'Restaurante de cocina caribeña contemporánea en una casa colonial azul de Getsemaní, a partir de la investigación gastronómica del Proyecto Caribe Lab. Rankeado en las listas de los 50 Best en 2025.',
    },
    gettingThere: {
      en: 'On the Calle del Espíritu Santo in Getsemaní, steps from Plaza de la Trinidad; book ahead online.',
      es: 'Sobre la Calle del Espíritu Santo en Getsemaní, a pasos de la Plaza de la Trinidad; reserva en línea con anticipación.',
    },
    website: 'https://celelerestaurante.com/', phone: '+57 301 742 0389', address: 'Cra. 10C # 29-200, Getsemaní, Cartagena',
    sources: [{ label: 'Celele · sitio oficial', url: 'https://celelerestaurante.com/' }],
  },
  {
    osmType: 'node', osmId: 10786565305, name: 'San Alberto',
    summary: {
      en: 'A specialty coffee house from Quindío inside the walled city, serving single-origin Colombian coffees prepared cup by cup. Its Cartagena branches include Plaza Santo Domingo and Calle Santos de Piedras.',
      es: 'Casa de café especial de Quindío dentro de la ciudad amurallada, con cafés de origen colombiano preparados taza a taza. Sus sedes cartageneras incluyen la Plaza Santo Domingo y la Calle Santos de Piedras.',
    },
    gettingThere: {
      en: 'Inside Centro Histórico, a few steps from Plaza Santo Domingo.',
      es: 'Dentro del Centro Histórico, a pocos pasos de la Plaza Santo Domingo.',
    },
    website: 'https://cafesanalberto.com.co/',
    sources: [{ label: 'Café San Alberto · sedes', url: 'https://cafesanalberto.com.co/templos-de-cafe/' }],
  },
  {
    osmType: 'node', osmId: 4763171022, name: 'Bazurto Social Club',
    summary: {
      en: 'A market-themed restaurant-bar in Getsemaní known for live champeta and Caribbean music on late-night weekends, mainly Thursday to Saturday.',
      es: 'Bar-restaurante de ambiente de mercado en Getsemaní, conocido por su champeta y música caribeña en vivo las noches de fin de semana, principalmente de jueves a sábado.',
    },
    gettingThere: {
      en: 'On the Av. del Centenario edge of Getsemaní, a short walk from Plaza de la Trinidad; it comes alive late.',
      es: 'Sobre la Av. del Centenario en el borde de Getsemaní, a un corto paso de la Plaza de la Trinidad; se llena de noche.',
    },
    sources: [{ label: 'Instagram · @bazurtosocialclub', url: 'https://www.instagram.com/bazurtosocialclub/' }, { label: 'Frommer’s · Bazurto Social Club', url: 'https://www.frommers.com/destinations/cartagena/nightlife/bazurto-social-club/' }],
  },
];

/** Stable id for the Cartagena area row (slug-derived, like every expansion
 *  city); resolved from the database at runtime, never assumed. */
function areaIdFor(slug: string): string {
  return `00000000-0000-4000-8000-${createHash('sha1').update(`area:${slug}`).digest('hex').slice(0, 12)}`;
}

/**
 * Populate Cartagena as a second destination: the researched area frame, the
 * OSM candidate backdrop from the checked-in snapshot, and sourced public
 * profiles on the curated set. Everything lands as an UNVERIFIED candidate:
 * no spotters, no witnesses, no verifications are created, and public
 * listings alone never make Colombia coverage "live".
 */
export async function seedCartagena(pool: Pool) {
  // Reference geography first: the pilot area, the expansion cities, and the
  // researched Cartagena frame (timezone America/Bogota included).
  await seed(pool, { demo: false });
  const area = await pool.query<{ id: string }>(
    'select id from areas where slug = $1', ['cartagena'],
  );
  const areaId = area.rows[0]?.id ?? areaIdFor('cartagena');

  const snapshot = await readFile(new URL('./data/cartagena.osm', import.meta.url), 'utf8');
  const imported = await importOsmCandidates(pool, areaId, {
    fetchImpl: async () => new Response(snapshot, { headers: { 'content-type': 'application/xml' } }),
    bbox: AREA_BBOX,
  });

  // The curated records whose tags the generic importer cannot categorize.
  // Same shape as an imported candidate; one place_sources row each, so the
  // open-dataset count stays honest (corroboration 1, never more).
  let curated = 0;
  for (const rec of CURATED_RECORDS) {
    const r = await pool.query<{ id: string; inserted: boolean }>(
      `insert into places
         (area_id, name, category, landmark_description, location, h3_8,
          source, verification_status, tags, osm_type, osm_id, public_source)
       select $1, $2, $3, $4,
              ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
              h3_lat_lng_to_cell(point($5, $6), 8)::text,
              'osm_candidate', 'candidate', $7, $8, $9, 'osm'
       where not exists (select 1 from places where osm_type = $8 and osm_id = $9)
       on conflict (osm_type, osm_id) where osm_type is not null do nothing
       returning id, true as inserted`,
      [areaId, rec.name, rec.category, rec.landmark, rec.lon, rec.lat, rec.name.split(' '), rec.osmType, rec.osmId],
    );
    if (r.rows[0]?.id) {
      await recordSource(pool, {
        placeId: r.rows[0].id, source: 'osm', sourceId: `${rec.osmType}/${rec.osmId}`,
        name: rec.name, category: rec.category, lat: rec.lat, lon: rec.lon,
      });
      curated += 1;
    }
  }

  let profiles = 0;
  for (const item of CARTAGENA_PROFILES) {
    const profile = PublicPlaceProfileSchema.parse({
      demo: true, researchedAt: RESEARCHED_AT, summary: item.summary,
      ...(item.gettingThere ? { gettingThere: item.gettingThere } : {}),
      image: item.image,
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
      [item.osmType, item.osmId, JSON.stringify(profile), item.summary.es, item.website ?? null, item.phone ?? null, item.address ?? null, areaId],
    );
    profiles += updated.rowCount ?? 0;
  }
  return { ...imported, curated, profiles };
}
