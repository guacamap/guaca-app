import type { Pool } from 'pg';
import { PublicPlaceProfileSchema, type PublicPlaceProfile } from '@guaca/shared';
import { DEMO_TRAVELLER_EMAIL } from './demoAccount.js';

/**
 * Isolated recording fixtures. Additive and idempotent: re-running inserts
 * missing rows only and never updates a place, stay, observation, ledger
 * entry, or catalog row that already exists.
 *
 * ATTRIBUTION (cover images reused from the existing demo photo sets; none
 * of these photos is the fictional stay itself):
 * - /demo/cartagena/plaza-trinidad.jpg Joe Ross / Wikimedia Commons 2016, CC BY-SA 2.0
 * - /demo/cartagena/torre-del-reloj.jpg David Shankbone / Wikimedia Commons 2013, CC BY-SA 3.0
 * - /demo/cartagena/murallas-santo-domingo.jpg Mariordo / Wikimedia Commons 2019, CC BY-SA 4.0
 * - /demo/cartagena/catedral-santa-catalina.jpg Mariordo / Wikimedia Commons 2019, CC BY-SA 4.0
 * - /demo/cartagena/castillo-san-felipe.jpg Bernard Gagnon / Wikimedia Commons 2020, CC BY-SA 4.0
 * - /demo/cartagena/plaza-de-los-coches.jpg Jorge Láscar / Wikimedia Commons 2009, CC BY 2.0
 * - /demo/cartagena/museo-oro-zenu.jpg Xemenendura / Wikimedia Commons 2025, CC BY-SA 4.0
 * - /demo/cartagena/playa-bocagrande.jpg Pedro Szekely / Wikimedia Commons 2010, CC BY 2.0
 * - /demo/puerto-cabello/malecon-atardecer.webp Ana Chreky / Wikimedia Commons 2014, CC BY-SA 3.0
 * - /demo/puerto-cabello/fortin-solano.jpg Periergeia / Wikimedia Commons 2007, CC BY-SA 4.0
 * - /demo/puerto-cabello/playa-quizandal.jpg Juliocesarat / Wikimedia Commons, CC BY-SA 3.0
 */

export const SCENARIO_CLOCK = {
  date: '2026-09-12',
  timezone: 'America/Bogota',
  instant: '2026-09-12T14:00:00-05:00',
} as const;

/** The only reset target. Unknown ids are refused. */
export const SCENARIO_KEY = 'deck-2026-09-12';

export const SCENARIO_IDS = {
  places: {
    casaCoral: '00000000-0000-4000-8000-00000000aa01',
    posadaReloj: '00000000-0000-4000-8000-00000000aa02',
    casaBaluarte: '00000000-0000-4000-8000-00000000aa03',
  },
  stays: {
    casaCoral: '00000000-0000-4000-8000-00000000ab01',
    posadaReloj: '00000000-0000-4000-8000-00000000ab02',
    casaBaluarte: '00000000-0000-4000-8000-00000000ab03',
  },
  spotters: {
    lucia: '00000000-0000-4000-8000-00000000ac01',
    andres: '00000000-0000-4000-8000-00000000ac02',
    alejandro: '00000000-0000-4000-8000-00000000ac10',
    yorman: '00000000-0000-4000-8000-00000000ac11',
    rafael: '00000000-0000-4000-8000-00000000ac12',
  },
  pcMissions: {
    breakfast: '00000000-0000-4000-8000-00000000c101',
    entrance: '00000000-0000-4000-8000-00000000c102',
    beach: '00000000-0000-4000-8000-00000000c103',
    fortin: '00000000-0000-4000-8000-00000000c104',
    accepted: '00000000-0000-4000-8000-00000000c105',
    witnessA: '00000000-0000-4000-8000-00000000c106',
    witnessB: '00000000-0000-4000-8000-00000000c107',
    doneCatedral: '00000000-0000-4000-8000-00000000c108',
    doneTeatro: '00000000-0000-4000-8000-00000000c109',
    doneIglesia: '00000000-0000-4000-8000-00000000c10a',
  },
  pcGaps: {
    breakfast: '00000000-0000-4000-8000-00000000c201',
    entrance: '00000000-0000-4000-8000-00000000c202',
    beach: '00000000-0000-4000-8000-00000000c203',
    fortin: '00000000-0000-4000-8000-00000000c204',
    accepted: '00000000-0000-4000-8000-00000000c205',
    witnessA: '00000000-0000-4000-8000-00000000c206',
    witnessB: '00000000-0000-4000-8000-00000000c207',
    doneCatedral: '00000000-0000-4000-8000-00000000c208',
    doneTeatro: '00000000-0000-4000-8000-00000000c209',
    doneIglesia: '00000000-0000-4000-8000-00000000c20a',
  },
  pcObservations: {
    witnessA: '00000000-0000-4000-8000-00000000c306',
    witnessB: '00000000-0000-4000-8000-00000000c307',
    doneCatedral: '00000000-0000-4000-8000-00000000c308',
    doneTeatro: '00000000-0000-4000-8000-00000000c309',
    doneIglesia: '00000000-0000-4000-8000-00000000c30a',
  },
  pcLedger: {
    done1: '00000000-0000-4000-8000-00000000c401',
    done2: '00000000-0000-4000-8000-00000000c402',
    done3: '00000000-0000-4000-8000-00000000c403',
  },
  merchant: '00000000-0000-4000-8000-00000000ad01',
  membership: '00000000-0000-4000-8000-00000000ad02',
  license: '00000000-0000-4000-8000-00000000ad03',
  observation: '00000000-0000-4000-8000-00000000ae01',
  rewards: {
    cap: '00000000-0000-4000-8000-00000000af01',
    bottle: '00000000-0000-4000-8000-00000000af02',
    voucher: '00000000-0000-4000-8000-00000000af03',
  },
  activities: {
    walledWalk: '00000000-0000-4000-8000-00000000b001',
    getsemani: '00000000-0000-4000-8000-00000000b002',
    sweets: '00000000-0000-4000-8000-00000000b003',
    castillo: '00000000-0000-4000-8000-00000000b004',
    goldMuseum: '00000000-0000-4000-8000-00000000b005',
    bocagrande: '00000000-0000-4000-8000-00000000b006',
    wallSunset: '00000000-0000-4000-8000-00000000b007',
    malecon: '00000000-0000-4000-8000-00000000b008',
    fortin: '00000000-0000-4000-8000-00000000b009',
    quizandal: '00000000-0000-4000-8000-00000000b00a',
  },
  ledger: {
    lucia1: '00000000-0000-4000-8000-00000000b101',
    lucia2: '00000000-0000-4000-8000-00000000b102',
    lucia3: '00000000-0000-4000-8000-00000000b103',
    andres1: '00000000-0000-4000-8000-00000000b104',
  },
} as const;

const RESEARCHED_AT = '2026-09-06';
export const BEACH_OSM_ID = 10278478997; // Playa de Marbella, a real Cartagena beach listing

export const SCENARIO_OBSERVATION_COPY = {
  statementEn:
    'Whether the concrete stairs down to the sand at Playa de Marbella are open after the latest swell, and whether the water looks unusually cloudy. This is a pending local check, not a safety claim.',
  statementEs:
    'Si las escaleras de concreto hacia la arena en Playa de Marbella están abiertas después del último oleaje, y si el agua se ve inusualmente turbia. Es una comprobación local pendiente, no una afirmación de seguridad.',
  sourceLabel: 'Pending local check',
  validUntil: '2026-09-14T23:59:00-05:00',
} as const;

export const SCENARIO_LEDGER_ROWS = [
  { id: SCENARIO_IDS.ledger.lucia1, spotterId: SCENARIO_IDS.spotters.lucia, delta: 150, reason: 'completed_local_check', at: '2026-08-28T16:00:00-05:00' },
  { id: SCENARIO_IDS.ledger.lucia2, spotterId: SCENARIO_IDS.spotters.lucia, delta: 180, reason: 'completed_photo_mission', at: '2026-09-02T11:30:00-05:00' },
  { id: SCENARIO_IDS.ledger.lucia3, spotterId: SCENARIO_IDS.spotters.lucia, delta: 120, reason: 'completed_local_check', at: '2026-09-08T18:15:00-05:00' },
  { id: SCENARIO_IDS.ledger.andres1, spotterId: SCENARIO_IDS.spotters.andres, delta: 80, reason: 'completed_local_check', at: '2026-09-05T10:00:00-05:00' },
] as const;
const INVENTORY_START = '2026-09-12';
const INVENTORY_END = '2026-09-26'; // exclusive
const FEATURED_CLOSED = new Set(['2026-09-15', '2026-09-16']);

const SETTING = {
  trinidad: {
    url: '/demo/cartagena/plaza-trinidad.jpg',
    credit: 'Joe Ross from Lansing, Michigan / Wikimedia Commons · 2016',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plaza_Trinidad,_Getsemani_Street_Scene,_Cartagena,_Colombia_(24503272541).jpg',
    license: 'CC BY-SA 2.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  reloj: {
    url: '/demo/cartagena/torre-del-reloj.jpg',
    credit: 'David Shankbone / Wikimedia Commons · 2013',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:024_Torre_del_Reloj_Cartagena_Colombia.JPG',
    license: 'CC BY-SA 3.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  murallas: {
    url: '/demo/cartagena/murallas-santo-domingo.jpg',
    credit: 'Mariordo (Mario Roberto Durán Ortiz) / Wikimedia Commons · 2019',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Panorama_Baluarte_de_Santo_Domingo_CTG_11_2019_2143.jpg',
    license: 'CC BY-SA 4.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  catedral: {
    url: '/demo/cartagena/catedral-santa-catalina.jpg',
    credit: 'Mariordo (Mario Roberto Durán Ortiz) / Wikimedia Commons · 2019',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Catedral_Santa_Catalina_CTG_11_2019_1688.jpg',
    license: 'CC BY-SA 4.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  castillo: {
    url: '/demo/cartagena/castillo-san-felipe.jpg',
    credit: 'Bernard Gagnon / Wikimedia Commons · 2020',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Castillo_San_Felipe_de_Barajas,_Cartagena_14.jpg',
    license: 'CC BY-SA 4.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  coches: {
    url: '/demo/cartagena/plaza-de-los-coches.jpg',
    credit: 'Jorge Láscar from Australia / Wikimedia Commons · 2009',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Puerta_del_Reloj_(Clock_Gate)_and_Plaza_de_los_Coches_(Square_of_the_Carriages)_(4625702763).jpg',
    license: 'CC BY 2.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  },
  museo: {
    url: '/demo/cartagena/museo-oro-zenu.jpg',
    credit: 'Xemenendura / Wikimedia Commons · 2025',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Museo_del_Oro_Zen%C3%BA_i.jpg',
    license: 'CC BY-SA 4.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  bocagrande: {
    url: '/demo/cartagena/playa-bocagrande.jpg',
    credit: 'Pedro Szekely / Wikimedia Commons · 2010',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Playa_de_Bocagrande,_Cartagena,_Colombia.jpg',
    license: 'CC BY 2.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  },
  malecon: {
    url: '/demo/puerto-cabello/malecon-atardecer.webp',
    credit: 'Ana Chreky / Wikimedia Commons · 2014',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Atardecer_en_el_malec%C3%B3n_de_Puerto_Cabello.JPG',
    license: 'CC BY-SA 3.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  fortin: {
    url: '/demo/puerto-cabello/fortin-solano.jpg',
    credit: 'Periergeia / Wikimedia Commons · 2007',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fortinpuertocabello.jpg',
    license: 'CC BY-SA 4.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  quizandal: {
    url: '/demo/puerto-cabello/playa-quizandal.jpg',
    credit: 'Juliocesarat / Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Playa_quizandal_(Pto_Cabello_-_Carabobo).jpg',
    license: 'CC BY-SA 3.0' as const,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
};

interface StaySeed {
  placeId: string;
  stayId: string;
  name: string;
  lat: number;
  lon: number;
  landmark: string;
  priceBand: 1 | 2 | 3;
  nightlyPriceMinor: number;
  guestsMax: number;
  amenities: string[];
  roomTypeEn: string;
  roomTypeEs: string;
  allotment: number;
  merchantOwned: boolean;
  profile: PublicPlaceProfile;
}

const STAYS: StaySeed[] = [
  {
    placeId: SCENARIO_IDS.places.casaCoral,
    stayId: SCENARIO_IDS.stays.casaCoral,
    name: 'Casa Coral Getsemaní',
    lat: 10.4208,
    lon: -75.5462,
    landmark: 'Callejón a una cuadra de la Plaza de la Trinidad',
    priceBand: 1,
    nightlyPriceMinor: 4500,
    guestsMax: 2,
    amenities: ['fan', 'shared_courtyard', 'hammocks', 'wifi'],
    roomTypeEn: 'Courtyard room with fan',
    roomTypeEs: 'Habitación al patio con ventilador',
    allotment: 2,
    merchantOwned: false,
    profile: PublicPlaceProfileSchema.parse({
      demo: true,
      researchedAt: RESEARCHED_AT,
      summary: {
        en: 'A small courtyard house in Getsemaní, a short walk from Plaza de la Trinidad. Rooms are simple, with fans and hammocks on a shared patio.',
        es: 'Una casa de patio en Getsemaní, a pocos pasos de la Plaza de la Trinidad. Habitaciones sencillas, con ventilador y hamacas en un patio compartido.',
      },
      gettingThere: {
        en: 'On foot from Plaza de la Trinidad, one block into the painted streets of Getsemaní.',
        es: 'A pie desde la Plaza de la Trinidad, una cuadra hacia las calles pintadas de Getsemaní.',
      },
      image: {
        ...SETTING.trinidad,
        caption: {
          en: 'Plaza de la Trinidad, the square this house sits near (setting, not the house)',
          es: 'Plaza de la Trinidad, la plaza junto a esta casa (ambiente, no la casa)',
        },
      },
      sources: [
        { label: 'Colombia Travel · Getsemaní', url: 'https://colombia.travel/es/cartagena/recorrido-por-el-centro-historico-de-cartagena' },
        { label: 'OpenStreetMap · Plaza de la Trinidad', url: 'https://www.openstreetmap.org/node/5434244523' },
      ],
    }),
  },
  {
    placeId: SCENARIO_IDS.places.posadaReloj,
    stayId: SCENARIO_IDS.stays.posadaReloj,
    name: 'Posada del Reloj',
    lat: 10.4235,
    lon: -75.5505,
    landmark: 'Dentro de las murallas, a dos cuadras de la Torre del Reloj',
    priceBand: 2,
    nightlyPriceMinor: 9000,
    guestsMax: 3,
    amenities: ['ac', 'breakfast', 'wifi', 'courtyard'],
    roomTypeEn: 'Air-conditioned room with breakfast',
    roomTypeEs: 'Habitación con aire y desayuno',
    allotment: 2,
    merchantOwned: false,
    profile: PublicPlaceProfileSchema.parse({
      demo: true,
      researchedAt: RESEARCHED_AT,
      summary: {
        en: 'A mid-range posada inside the walled city, two blocks from the Torre del Reloj. Rooms have air conditioning and a simple breakfast in the courtyard.',
        es: 'Una posada de rango medio dentro de la ciudad amurallada, a dos cuadras de la Torre del Reloj. Habitaciones con aire y un desayuno sencillo en el patio.',
      },
      gettingThere: {
        en: 'A few minutes on foot from the Torre del Reloj gate, inside Centro Histórico.',
        es: 'A pocos minutos a pie de la Torre del Reloj, dentro del Centro Histórico.',
      },
      image: {
        ...SETTING.reloj,
        caption: {
          en: 'Torre del Reloj, the gate this posada sits near (setting, not the posada)',
          es: 'Torre del Reloj, la puerta junto a esta posada (ambiente, no la posada)',
        },
      },
      sources: [
        { label: 'Colombia Travel · la Torre del Reloj', url: 'https://colombia.travel/es/cartagena/visita-la-puerta-y-la-torre-del-reloj' },
        { label: 'OpenStreetMap · Puerta del Reloj', url: 'https://www.openstreetmap.org/way/955128419' },
      ],
    }),
  },
  {
    placeId: SCENARIO_IDS.places.casaBaluarte,
    stayId: SCENARIO_IDS.stays.casaBaluarte,
    name: 'Casa del Baluarte',
    lat: 10.4278,
    lon: -75.5512,
    landmark: 'Frente al tramo de muralla del Baluarte de Santo Domingo',
    priceBand: 3,
    nightlyPriceMinor: 18000,
    guestsMax: 4,
    amenities: ['ac', 'breakfast', 'pool', 'wifi', 'ocean_view', 'rooftop'],
    roomTypeEn: 'Ocean-wall suite with rooftop and pool',
    roomTypeEs: 'Suite frente a la muralla, con terraza y piscina',
    allotment: 1,
    merchantOwned: true,
    profile: PublicPlaceProfileSchema.parse({
      demo: true,
      researchedAt: RESEARCHED_AT,
      summary: {
        en: 'A house facing the walkable wall at Baluarte de Santo Domingo, with a small pool and a rooftop looking toward the sea.',
        es: 'Una casa frente al tramo caminable del Baluarte de Santo Domingo, con piscina pequeña y terraza hacia el mar.',
      },
      gettingThere: {
        en: 'On the ocean side of Centro Histórico, a few minutes from Plaza Santo Domingo along the walls.',
        es: 'En el lado del mar del Centro Histórico, a pocos minutos de la Plaza Santo Domingo por la muralla.',
      },
      image: {
        ...SETTING.murallas,
        caption: {
          en: 'Baluarte de Santo Domingo, the wall this house faces (setting, not the house)',
          es: 'Baluarte de Santo Domingo, la muralla que enfrenta esta casa (ambiente, no la casa)',
        },
      },
      sources: [
        { label: 'Colombia Travel · las Murallas de Cartagena', url: 'https://colombia.travel/es/cartagena/las-murallas-de-cartagena' },
        { label: 'OpenStreetMap · Las Murallas de Cartagena', url: 'https://www.openstreetmap.org/way/63525986' },
      ],
    }),
  },
];

interface ActivitySeed {
  id: string;
  slug: string;
  areaSlug: 'cartagena' | 'puerto-cabello';
  titleEn: string;
  titleEs: string;
  summaryEn: string;
  summaryEs: string;
  cover: PublicPlaceProfile['image'];
  osmIds: number[];
  category: string;
  estimatedDurationMin: number;
  travelMode: 'walk' | 'taxi' | 'mixed';
  interestTags: string[];
  suggestedWindow: 'morning' | 'afternoon' | 'sunset' | 'evening' | null;
}

const ACTIVITIES: ActivitySeed[] = [
  {
    id: SCENARIO_IDS.activities.walledWalk,
    slug: 'cartagena-walled-morning',
    areaSlug: 'cartagena',
    titleEn: 'Morning in the walled city',
    titleEs: 'Mañana en la ciudad amurallada',
    summaryEn: 'Walk from the Torre del Reloj to the Catedral and up onto a stretch of the walls. Estimated times only; this is not a ticketed tour.',
    summaryEs: 'Caminata desde la Torre del Reloj hasta la Catedral y un tramo de la muralla. Tiempos estimados; no es un tour con boleto.',
    cover: SETTING.reloj,
    osmIds: [955128419, 49666923, 63525986],
    category: 'culture_history',
    estimatedDurationMin: 180,
    travelMode: 'walk',
    interestTags: ['culture'],
    suggestedWindow: 'morning',
  },
  {
    id: SCENARIO_IDS.activities.getsemani,
    slug: 'cartagena-getsemani-streets',
    areaSlug: 'cartagena',
    titleEn: 'Getsemaní painted streets',
    titleEs: 'Calles pintadas de Getsemaní',
    summaryEn: 'A walk around Plaza de la Trinidad and through Parque Centenario, where the neighbourhood murals begin.',
    summaryEs: 'Un recorrido por la Plaza de la Trinidad y el Parque Centenario, donde empiezan los murales del barrio.',
    cover: SETTING.trinidad,
    osmIds: [5434244523, 25841728],
    category: 'culture_history',
    estimatedDurationMin: 90,
    travelMode: 'walk',
    interestTags: ['culture', 'relax'],
    suggestedWindow: 'afternoon',
  },
  {
    id: SCENARIO_IDS.activities.sweets,
    slug: 'cartagena-portal-dulces',
    areaSlug: 'cartagena',
    titleEn: 'Sweets at Portal de los Dulces',
    titleEs: 'Dulces en el Portal de los Dulces',
    summaryEn: 'A short stop at Plaza de los Coches, whose arcaded side groups stalls of coconut and fruit sweets.',
    summaryEs: 'Una parada breve en la Plaza de los Coches, cuyo lado porticado reúne puestos de dulces de coco y frutas.',
    cover: SETTING.coches,
    osmIds: [4932625023, 955128419],
    category: 'eat_drink',
    estimatedDurationMin: 45,
    travelMode: 'walk',
    interestTags: ['food'],
    suggestedWindow: 'afternoon',
  },
  {
    id: SCENARIO_IDS.activities.castillo,
    slug: 'cartagena-castillo-san-felipe',
    areaSlug: 'cartagena',
    titleEn: 'Castillo San Felipe ramparts',
    titleEs: 'Murallas del Castillo San Felipe',
    summaryEn: 'The hill fortress east of Getsemaní. Official pages list paid daytime entry; tunnels and ramparts are walked, not driven.',
    summaryEs: 'La fortaleza sobre el cerro al este de Getsemaní. Las páginas oficiales publican entrada diurna de pago; túneles y murallas se recorren a pie.',
    cover: SETTING.castillo,
    osmIds: [49551791],
    category: 'culture_history',
    estimatedDurationMin: 120,
    travelMode: 'mixed',
    interestTags: ['culture', 'adventure'],
    suggestedWindow: 'morning',
  },
  {
    id: SCENARIO_IDS.activities.goldMuseum,
    slug: 'cartagena-museo-oro-zenu',
    areaSlug: 'cartagena',
    titleEn: 'Museo del Oro Zenú',
    titleEs: 'Museo del Oro Zenú',
    summaryEn: 'The Banco de la República gold museum on Parque de Bolívar. Admission is listed as free; it closes on Mondays.',
    summaryEs: 'El museo del oro del Banco de la República en el Parque de Bolívar. La entrada se publica como gratuita; cierra los lunes.',
    cover: SETTING.museo,
    osmIds: [7154999586, 49666923],
    category: 'culture_history',
    estimatedDurationMin: 60,
    travelMode: 'walk',
    interestTags: ['culture'],
    suggestedWindow: 'morning',
  },
  {
    id: SCENARIO_IDS.activities.bocagrande,
    slug: 'cartagena-bocagrande-beach',
    areaSlug: 'cartagena',
    titleEn: 'Bocagrande beach afternoon',
    titleEs: 'Tarde en la playa de Bocagrande',
    summaryEn: 'The high-rise beach strip. Sea conditions vary; swim where locals swim. Not a claim that the water is currently calm.',
    summaryEs: 'La franja de playa de las torres. Las condiciones del mar varían; báñate donde se bañan los locales. No afirma que el agua esté en calma hoy.',
    cover: SETTING.bocagrande,
    osmIds: [25446658],
    category: 'beach_water',
    estimatedDurationMin: 150,
    travelMode: 'taxi',
    interestTags: ['relax'],
    suggestedWindow: 'afternoon',
  },
  {
    id: SCENARIO_IDS.activities.wallSunset,
    slug: 'cartagena-wall-sunset',
    areaSlug: 'cartagena',
    titleEn: 'Sunset on the walls',
    titleEs: 'Atardecer en la muralla',
    summaryEn: 'The ocean-side stretch at Baluarte de Santo Domingo is a classic sunset walk. Times are estimates.',
    summaryEs: 'El tramo junto al mar en el Baluarte de Santo Domingo es un clásico del atardecer. Los horarios son estimados.',
    cover: SETTING.murallas,
    osmIds: [63525986],
    category: 'culture_history',
    estimatedDurationMin: 60,
    travelMode: 'walk',
    interestTags: ['relax', 'culture'],
    suggestedWindow: 'sunset',
  },
  {
    id: SCENARIO_IDS.activities.malecon,
    slug: 'puerto-cabello-malecon-sunset',
    areaSlug: 'puerto-cabello',
    titleEn: 'Malecón sunset walk',
    titleEs: 'Paseo al atardecer en el Malecón',
    summaryEn: 'An evening walk along Puerto Cabello’s waterfront, past Plaza Flores and the cathedral stone.',
    summaryEs: 'Un paseo de atardecer por el malecón de Puerto Cabello, pasando Plaza Flores y la piedra de la catedral.',
    cover: SETTING.malecon,
    osmIds: [157189923, 161501174, 1734748797],
    category: 'culture_history',
    estimatedDurationMin: 90,
    travelMode: 'walk',
    interestTags: ['relax', 'culture'],
    suggestedWindow: 'sunset',
  },
  {
    id: SCENARIO_IDS.activities.fortin,
    slug: 'puerto-cabello-fortin-solano',
    areaSlug: 'puerto-cabello',
    titleEn: 'Fortín Solano viewpoint',
    titleEs: 'Mirador del Fortín Solano',
    summaryEn: 'The hill fort above the harbour. Check access before setting out; this is not a scheduled excursion.',
    summaryEs: 'El fuerte sobre el puerto. Confirma el acceso antes de salir; no es una excursión con horario.',
    cover: SETTING.fortin,
    osmIds: [203615814],
    category: 'culture_history',
    estimatedDurationMin: 120,
    travelMode: 'taxi',
    interestTags: ['culture', 'adventure'],
    suggestedWindow: 'morning',
  },
  {
    id: SCENARIO_IDS.activities.quizandal,
    slug: 'puerto-cabello-playa-delfin',
    areaSlug: 'puerto-cabello',
    titleEn: 'Playa Delfín',
    titleEs: 'Playa Delfín',
    summaryEn: 'A mapped beach on the Puerto Cabello coast. Sea conditions, access and services have not been checked by a Guaca Spotter.',
    summaryEs: 'Una playa cartografiada en la costa de Puerto Cabello. Un Spotter de Guaca aún no ha comprobado el estado del mar, el acceso ni los servicios.',
    cover: {
      ...SETTING.quizandal,
      caption: {
        en: 'Playa Quizandal, a nearby Puerto Cabello beach · illustrative of the coast',
        es: 'Playa Quizandal, una playa cercana de Puerto Cabello · ilustrativa de la costa',
      },
    },
    osmIds: [1323862255],
    category: 'beach_water',
    estimatedDurationMin: 150,
    travelMode: 'taxi',
    interestTags: ['relax'],
    suggestedWindow: 'afternoon',
  },
];

function datesExclusive(start: string, endExclusive: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const end = new Date(`${endExclusive}T00:00:00Z`);
  while (cursor < end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export interface ScenarioSeedResult {
  stays: number;
  activities: number;
  observations: number;
  spotters: number;
  ledgerEntries: number;
  catalogItems: number;
  entitlements: number;
  licenses: number;
  pcMissions: number;
}

export async function seedScenario(pool: Pool): Promise<ScenarioSeedResult> {
  const cartagena = await pool.query<{ id: string }>(
    `select id from areas where slug = 'cartagena'`,
  );
  const puerto = await pool.query<{ id: string }>(
    `select id from areas where slug = 'puerto-cabello'`,
  );
  const cartagenaId = cartagena.rows[0]?.id;
  const puertoId = puerto.rows[0]?.id;
  if (!cartagenaId || !puertoId) {
    throw new Error('Seed Cartagena and Puerto Cabello first. Scenario fixtures need both area catalogs.');
  }

  const areaIds: Record<'cartagena' | 'puerto-cabello', string> = {
    cartagena: cartagenaId,
    'puerto-cabello': puertoId,
  };

  await pool.query(
    `insert into merchant_accounts (id, email, name, language)
     values ($1, $2, $3, 'es')
     on conflict (id) do nothing`,
    [SCENARIO_IDS.merchant, 'elena@scenario.guaca.live', 'Elena Vargas'],
  );

  let stays = 0;
  for (const stay of STAYS) {
    const inserted = await pool.query<{ id: string }>(
      `insert into places (
         id, area_id, name, category, description, landmark_description, location, h3_8,
         price_band, tags, source, verification_status, public_profile
       )
       select $1, $2, $3, 'lodging', $4,
              $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
              h3_lat_lng_to_cell(point($6, $7), 8)::text,
              $8, $9, 'business', 'candidate', $10::jsonb
       where ST_Covers((select geom from areas where id = $2), ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)
       on conflict (id) do nothing
       returning id`,
      [
        stay.placeId,
        cartagenaId,
        stay.name,
        stay.profile.summary.es,
        stay.landmark,
        stay.lon,
        stay.lat,
        stay.priceBand,
        stay.amenities,
        JSON.stringify(stay.profile),
      ],
    );
    const landed = await pool.query<{ id: string }>(
      `select id from places where id = $1`,
      [stay.placeId],
    );
    if (!landed.rows[0]) {
      throw new Error(`Stay ${stay.name} did not land inside the Cartagena area frame.`);
    }
    if (inserted.rows[0]) stays += 1;

    await pool.query(
      `insert into stays (
         id, place_id, merchant_id, room_type_en, room_type_es, amenities,
         currency, nightly_price_minor, guests_max, timezone
       ) values ($1, $2, $3, $4, $5, $6, 'USD', $7, $8, $9)
       on conflict (id) do nothing`,
      [
        stay.stayId,
        stay.placeId,
        stay.merchantOwned ? SCENARIO_IDS.merchant : null,
        stay.roomTypeEn,
        stay.roomTypeEs,
        stay.amenities,
        stay.nightlyPriceMinor,
        stay.guestsMax,
        SCENARIO_CLOCK.timezone,
      ],
    );

    for (const night of datesExclusive(INVENTORY_START, INVENTORY_END)) {
      const closed = stay.merchantOwned && FEATURED_CLOSED.has(night);
      await pool.query(
        `insert into stay_inventory (stay_id, night_date, allotment, reserved_count)
         values ($1, $2::date, $3, 0)
         on conflict (stay_id, night_date) do nothing`,
        [stay.stayId, night, closed ? 0 : stay.allotment],
      );
    }
  }

  await pool.query(
    `insert into merchant_memberships (id, merchant_id, stay_id, place_id, role)
     values ($1, $2, $3, $4, 'owner')
     on conflict (id) do nothing`,
    [
      SCENARIO_IDS.membership,
      SCENARIO_IDS.merchant,
      SCENARIO_IDS.stays.casaBaluarte,
      SCENARIO_IDS.places.casaBaluarte,
    ],
  );

  const licenses = await pool.query(
    `insert into merchant_zone_licenses (
       id, merchant_id, stay_id, area_id, status, visibility,
       label_en, label_es, starts_at, ends_at
     ) values ($1, $2, $3, $4, 'active', 'standard', $5, $6, $7::timestamptz, $8::timestamptz)
     on conflict (id) do nothing`,
    [
      SCENARIO_IDS.license,
      SCENARIO_IDS.merchant,
      SCENARIO_IDS.stays.casaBaluarte,
      cartagenaId,
      'Cartagena Centro Histórico zone license (fixture, not a paid placement)',
      'Licencia de zona del Centro Histórico de Cartagena (fixture, no es una colocación pagada)',
      SCENARIO_CLOCK.instant,
      '2026-12-12T00:00:00-05:00',
    ],
  );

  const spotterRows = [
    {
      id: SCENARIO_IDS.spotters.lucia,
      name: 'Lucía Castañeda',
      email: 'lucia@scenario.guaca.live',
      phone: '+57 300 555 0101',
      lat: 10.4206,
      lon: -75.5454,
    },
    {
      id: SCENARIO_IDS.spotters.andres,
      name: 'Andrés Pardo',
      email: 'andres@scenario.guaca.live',
      phone: '+57 300 555 0102',
      lat: 10.4230,
      lon: -75.5510,
    },
  ];
  let spotters = 0;
  for (const s of spotterRows) {
    const r = await pool.query(
      `insert into spotters (id, name, email, phone, area_id, home_h3, language, photo_url)
       values ($1, $2, $3, $4, $5, h3_lat_lng_to_cell(point($6, $7), 8)::text, 'es', null)
       on conflict (id) do nothing`,
      [s.id, s.name, s.email, s.phone, cartagenaId, s.lon, s.lat],
    );
    spotters += r.rowCount ?? 0;
  }

  const catalog = [
    {
      id: SCENARIO_IDS.rewards.cap,
      slug: 'guaca-cap',
      titleEn: 'Guaca cap',
      titleEs: 'Gorra Guaca',
      descriptionEn: 'A sandbox cap. Redeeming it writes a receipt; nothing is shipped.',
      descriptionEs: 'Una gorra de prueba. Canjearla escribe un recibo; no se envía nada.',
      cost: 200,
      kind: 'cap',
    },
    {
      id: SCENARIO_IDS.rewards.bottle,
      slug: 'guaca-bottle',
      titleEn: 'Guaca bottle',
      titleEs: 'Botella Guaca',
      descriptionEn: 'A sandbox bottle. Points only; no merchant fulfilment.',
      descriptionEs: 'Una botella de prueba. Solo puntos; sin envío de un comercio.',
      cost: 350,
      kind: 'bottle',
    },
    {
      id: SCENARIO_IDS.rewards.voucher,
      slug: 'local-experience-voucher',
      titleEn: 'Local experience voucher',
      titleEs: 'Vale de experiencia local',
      descriptionEn: 'A sandbox voucher toward a local experience. No real booking is created.',
      descriptionEs: 'Un vale de prueba para una experiencia local. No crea una reserva real.',
      cost: 800,
      kind: 'voucher',
    },
  ];
  let catalogItems = 0;
  for (const item of catalog) {
    const r = await pool.query(
      `insert into reward_catalog (
         id, slug, title_en, title_es, description_en, description_es, point_cost, kind
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do nothing`,
      [item.id, item.slug, item.titleEn, item.titleEs, item.descriptionEn, item.descriptionEs, item.cost, item.kind],
    );
    catalogItems += r.rowCount ?? 0;
  }

  let ledgerEntries = 0;
  for (const row of SCENARIO_LEDGER_ROWS) {
    const r = await pool.query(
      `insert into reward_ledger (id, spotter_id, delta, reason, mission_id, created_at)
       values ($1, $2, $3, $4, null, $5::timestamptz)
       on conflict (id) do nothing`,
      [row.id, row.spotterId, row.delta, row.reason, row.at],
    );
    ledgerEntries += r.rowCount ?? 0;
  }

  const beach = await pool.query<{ id: string }>(
    `select id from places where area_id = $1 and osm_id = $2`,
    [cartagenaId, BEACH_OSM_ID],
  );
  if (!beach.rows[0]) {
    throw new Error('Playa de Marbella is missing. Seed Cartagena before the scenario.');
  }
  const observations = await pool.query(
    `insert into place_observations (
       id, place_id, kind, statement_en, statement_es, source_kind, source_label,
       observed_at, valid_until, status, evidence_photo_url, created_by
     ) values (
       $1, $2, 'access',
       $5, $6,
       'pending_local_check', $7,
       $3::timestamptz, $4::timestamptz, 'active', null, null
     )
     on conflict (id) do nothing`,
    [
      SCENARIO_IDS.observation,
      beach.rows[0].id,
      SCENARIO_CLOCK.instant,
      SCENARIO_OBSERVATION_COPY.validUntil,
      SCENARIO_OBSERVATION_COPY.statementEn,
      SCENARIO_OBSERVATION_COPY.statementEs,
      SCENARIO_OBSERVATION_COPY.sourceLabel,
    ],
  );

  let activities = 0;
  for (const act of ACTIVITIES) {
    const areaId = areaIds[act.areaSlug];
    const places = await pool.query<{ id: string; osm_id: string }>(
      `select id, osm_id from places where area_id = $1 and osm_id = any($2::bigint[])`,
      [areaId, act.osmIds],
    );
    const byOsm = new Map(places.rows.map((p) => [Number(p.osm_id), p.id]));
    const placeIds = act.osmIds.map((osmId) => byOsm.get(osmId));
    if (placeIds.some((id) => !id)) {
      throw new Error(`Activity ${act.slug} is missing source-backed places in ${act.areaSlug}.`);
    }
    const r = await pool.query(
      `insert into activities (
         id, area_id, slug, title_en, title_es, summary_en, summary_es, cover_image,
         place_ids, category, estimated_duration_min, travel_mode, interest_tags, suggested_window
       ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14)
       on conflict (id) do nothing`,
      [
        act.id,
        areaId,
        act.slug,
        act.titleEn,
        act.titleEs,
        act.summaryEn,
        act.summaryEs,
        JSON.stringify(act.cover),
        placeIds,
        act.category,
        act.estimatedDurationMin,
        act.travelMode,
        act.interestTags,
        act.suggestedWindow,
      ],
    );
    activities += r.rowCount ?? 0;
  }

  await pool.query(
    `insert into tourists (email, language) values ($1, 'es')
     on conflict (email) do nothing`,
    [DEMO_TRAVELLER_EMAIL],
  );
  const tourist = await pool.query<{ id: string }>(
    `select id from tourists where email = $1`,
    [DEMO_TRAVELLER_EMAIL],
  );
  const entitlements = await pool.query(
    `insert into tourist_entitlements (tourist_id, plan_code, status, starts_at, ends_at, source)
     values ($1, 'explorer', 'active', $2::timestamptz, $3::timestamptz, 'scenario_fixture')
     on conflict (tourist_id) do nothing`,
    [tourist.rows[0]!.id, SCENARIO_CLOCK.instant, '2026-12-12T00:00:00-05:00'],
  );

  const { seedPuertoCabelloMissions } = await import('./puertoCabelloMissions.js');
  const pcMissions = await seedPuertoCabelloMissions(pool);

  return {
    stays,
    activities,
    observations: observations.rowCount ?? 0,
    spotters,
    ledgerEntries,
    catalogItems,
    entitlements: entitlements.rowCount ?? 0,
    licenses: licenses.rowCount ?? 0,
    pcMissions,
  };
}
