export type Lang = 'en' | 'es';

/**
 * The Caribbean, at country level. Every name is real geography and every
 * status is literally true today: nothing anywhere is documented. `started`
 * marks the one country with an area in the database; `next` marks the three
 * markets PRODUCT.md already records as named expansion targets. No status
 * here claims coverage, a date, or a commitment the product has not made.
 */
export type TerritoryStatus = 'started' | 'next' | 'none';

export interface Territory {
  en: string;
  es: string;
  status: TerritoryStatus;
}

export const TERRITORIES: readonly Territory[] = [
  { en: 'Venezuela', es: 'Venezuela', status: 'started' },
  { en: 'Colombia', es: 'Colombia', status: 'next' },
  { en: 'Costa Rica', es: 'Costa Rica', status: 'next' },
  { en: 'Jamaica', es: 'Jamaica', status: 'next' },
  { en: 'Cuba', es: 'Cuba', status: 'none' },
  { en: 'Dominican Republic', es: 'República Dominicana', status: 'none' },
  { en: 'Haiti', es: 'Haití', status: 'none' },
  { en: 'Puerto Rico', es: 'Puerto Rico', status: 'none' },
  { en: 'Trinidad and Tobago', es: 'Trinidad y Tobago', status: 'none' },
  { en: 'Panama', es: 'Panamá', status: 'none' },
  { en: 'Belize', es: 'Belice', status: 'none' },
  { en: 'Honduras', es: 'Honduras', status: 'none' },
  { en: 'Nicaragua', es: 'Nicaragua', status: 'none' },
  { en: 'Guatemala', es: 'Guatemala', status: 'none' },
  { en: 'Mexico — Quintana Roo', es: 'México — Quintana Roo', status: 'none' },
  { en: 'The Bahamas', es: 'Bahamas', status: 'none' },
  { en: 'Barbados', es: 'Barbados', status: 'none' },
  { en: 'Guadeloupe', es: 'Guadalupe', status: 'none' },
  { en: 'Martinique', es: 'Martinica', status: 'none' },
  { en: 'Saint Lucia', es: 'Santa Lucía', status: 'none' },
  { en: 'Grenada', es: 'Granada', status: 'none' },
  { en: 'Dominica', es: 'Dominica', status: 'none' },
  { en: 'Antigua and Barbuda', es: 'Antigua y Barbuda', status: 'none' },
  { en: 'Curaçao', es: 'Curazao', status: 'none' },
  { en: 'Aruba', es: 'Aruba', status: 'none' },
  { en: 'Bonaire', es: 'Bonaire', status: 'none' },
  { en: 'Guyana', es: 'Guyana', status: 'none' },
  { en: 'Suriname', es: 'Surinam', status: 'none' },
] as const;

/** The ten walkable zones of the Puerto Cabello pilot. Real geography. */
export const ZONES = [
  'Malecón',
  'Casco Histórico',
  'Playa Quizandal',
  'Borburata',
  'Patanemo',
  'Isla Larga',
  'Centro',
  'El Trompillo',
  'San Esteban',
  'La Guaricha',
] as const;

interface Copy {
  htmlLang: string;
  nav: { map: string; register: string; spotters: string; skip: string };
  hero: {
    monument: string;
    qualifier: string;
    lead: string;
    caption: string;
    credit: string;
  };
  ask: {
    label: string;
    placeholder: string;
    submit: string;
    working: string;
    hint: string;
  };
  answer: {
    documented: string;
    notDocumented: string;
    commissioned: string;
    commissionBody: string;
    offline: string;
    replayNote: string;
    again: string;
  };
  loop: { one: string; two: string; three: string; close: string };
  register: {
    statement: string;
    documented: string;
    awaiting: string;
    status: string;
    note: string;
    /** Country-level statuses for the region index. */
    started: string;
    next: string;
    /** Puerto Cabello's line under Venezuela, e.g. "0 of 10 zones". */
    zonesOf: (done: number, total: number) => string;
    expand: string;
    collapse: string;
  };
  spotters: { statement: string; status: string; note: string };
  close: {
    monument: string;
    body: string;
    cta: string;
    owners: string;
    ownersLink: string;
  };
  footer: { rights: string; photo: string; lang: string };
}

const en: Copy = {
  htmlLang: 'en',
  nav: {
    map: 'The map',
    register: 'The register',
    spotters: 'The spotters',
    skip: 'Skip to content',
  },
  hero: {
    monument: 'WITNESSED',
    qualifier: 'not inferred.',
    lead: 'Every place on this map was stood in, photographed and confirmed by someone who lives here. When nobody has been, it says so — and pays a local to go.',
    caption: 'Caribbean coast, Estado Carabobo',
    credit: 'Coast photograph, Katherine Zambrano Realza / Pexels',
  },
  ask: {
    label: 'Ask about the Caribbean coast',
    placeholder: 'Where can I swim near the fort?',
    submit: 'Ask',
    working: 'Asking',
    hint: 'Ask anything. The honest answer is part of the demonstration.',
  },
  answer: {
    documented: 'Documented',
    notDocumented: 'Not documented',
    commissioned: 'Logged as a gap',
    commissionBody:
      'That question is now a recorded coverage gap. Gaps become paid missions for the local who covers that zone — they go, they photograph it, a second local confirms it, and the answer joins the map free and permanently.',
    offline: 'Not documented',
    replayNote: 'Shown from a recorded response — the live service is unreachable from here.',
    again: 'Ask another',
  },
  loop: {
    one: 'Someone asks.',
    two: 'Nobody has been.',
    three: 'So we pay a local to go.',
    close: 'The answer stays on the map, free, for everyone who asks after.',
  },
  register: {
    statement: 'The Caribbean, and how much of it we have actually stood in.',
    documented: 'town started',
    awaiting: 'countries not documented',
    status: 'Not documented',
    started: 'Coverage started',
    next: 'Next',
    zonesOf: (done, total) => `${done} of ${total} zones documented`,
    expand: 'Show zones',
    collapse: 'Hide zones',
    note: 'This page will not show you a place until a spotter has filed one. That is the entire point.',
  },
  spotters: {
    statement: 'One local per zone. Named on every place they file. Paid for each verification.',
    status: 'Post open',
    note: 'Spotters are invited and hand-picked, never recruited by form.',
  },
  close: {
    monument: 'ONE COAST AT A TIME',
    body: 'Puerto Cabello first, then the rest of the Caribbean — one zone at a time, each one paid for once and free after that.',
    cta: 'Open the map',
    owners: 'Run a posada or a villa?',
    ownersLink: 'See the guest view (demonstration)',
  },
  footer: {
    rights: 'The Caribbean — covering from Puerto Cabello, Venezuela',
    photo: 'Coast photograph by Katherine Zambrano Realza, Pexels',
    lang: 'Español',
  },
};

const es: Copy = {
  htmlLang: 'es',
  nav: {
    map: 'El mapa',
    register: 'El registro',
    spotters: 'Los spotters',
    skip: 'Ir al contenido',
  },
  hero: {
    monument: 'ATESTIGUADO',
    qualifier: 'no inferido.',
    lead: 'Cada lugar de este mapa fue pisado, fotografiado y confirmado por alguien que vive aquí. Cuando nadie ha ido, lo dice — y le paga a un local para que vaya.',
    caption: 'Costa caribeña, Estado Carabobo',
    credit: 'Fotografía de la costa, Katherine Zambrano Realza / Pexels',
  },
  ask: {
    label: 'Pregunta sobre la costa caribeña',
    placeholder: '¿Dónde puedo bañarme cerca del castillo?',
    submit: 'Preguntar',
    working: 'Preguntando',
    hint: 'Pregunta lo que sea. La respuesta honesta es parte de la demostración.',
  },
  answer: {
    documented: 'Documentado',
    notDocumented: 'No documentado',
    commissioned: 'Registrado como vacío',
    commissionBody:
      'Esa pregunta queda registrada como un vacío de cobertura. Los vacíos se convierten en misiones pagadas para el local que cubre esa zona — va, lo fotografía, otro local lo confirma, y la respuesta se suma al mapa gratis y para siempre.',
    offline: 'No documentado',
    replayNote: 'Respuesta grabada — el servicio en vivo no responde desde aquí.',
    again: 'Preguntar otra',
  },
  loop: {
    one: 'Alguien pregunta.',
    two: 'Nadie ha ido.',
    three: 'Entonces le pagamos a un local para que vaya.',
    close: 'La respuesta queda en el mapa, gratis, para todos los que pregunten después.',
  },
  register: {
    statement: 'El Caribe, y cuánto de él hemos pisado de verdad.',
    documented: 'pueblo empezado',
    awaiting: 'países sin documentar',
    status: 'No documentado',
    started: 'Cobertura empezada',
    next: 'Siguiente',
    zonesOf: (done, total) => `${done} de ${total} zonas documentadas`,
    expand: 'Ver zonas',
    collapse: 'Ocultar zonas',
    note: 'Esta página no te mostrará un lugar hasta que un spotter lo haya registrado. Ese es justamente el punto.',
  },
  spotters: {
    statement: 'Un local por zona. Con su nombre en cada lugar que registra. Pagado por cada verificación.',
    status: 'Puesto abierto',
    note: 'A los spotters se les invita y se les elige a mano, nunca por formulario.',
  },
  close: {
    monument: 'UNA COSTA A LA VEZ',
    body: 'Puerto Cabello primero, después el resto del Caribe — una zona a la vez, cada una pagada una sola vez y gratis desde entonces.',
    cta: 'Abrir el mapa',
    owners: '¿Tienes una posada o una villa?',
    ownersLink: 'Mira la vista del huésped (demostración)',
  },
  footer: {
    rights: 'El Caribe — cubriendo desde Puerto Cabello, Venezuela',
    photo: 'Fotografía de la costa por Katherine Zambrano Realza, Pexels',
    lang: 'English',
  },
};

export const COPY: Record<Lang, Copy> = { en, es };

/**
 * The recorded response. Shown only when the live service cannot be reached,
 * so the page still demonstrates the loop instead of showing an error.
 */
export const REPLAY: Record<Lang, { text: string; zone: string }> = {
  en: {
    text: 'No one has documented that yet. I will not describe a place nobody has been to, so I am not going to answer this one.',
    zone: 'Patanemo',
  },
  es: {
    text: 'Nadie ha documentado eso todavía. No voy a describir un lugar al que nadie ha ido, así que no voy a responder esta.',
    zone: 'Patanemo',
  },
};
