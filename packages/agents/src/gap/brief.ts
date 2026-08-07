const CATEGORY_ES: Record<string, string> = {
  eat_drink: 'Comer y beber',
  beach_water: 'Playas y agua',
  nature_walk: 'Naturaleza y caminatas',
  culture_history: 'Cultura e historia',
  market_shop: 'Mercados y tiendas',
  services: 'Servicios',
  nightlife_music: 'Vida nocturna y música',
  practical: 'Práctico',
};

const CATEGORY_EN: Record<string, string> = {
  eat_drink: 'Eat & drink',
  beach_water: 'Beach & water',
  nature_walk: 'Nature & walks',
  culture_history: 'Culture & history',
  market_shop: 'Markets & shops',
  services: 'Services',
  nightlife_music: 'Nightlife & music',
  practical: 'Practical',
};

export interface BriefInput {
  language: 'es' | 'en';
  category: string;
  zoneName: string;
  spotterName: string;
  landmarkHint?: string;
  photosRequired?: number;
}

/**
 * T5.4 — the mission brief in the Spotter's language: what to find, where,
 * and which photos are needed. Composed deterministically from the gap and
 * the zone — no model involved.
 */
export function composeBrief(input: BriefInput): string {
  const photos = input.photosRequired ?? 3;
  if (input.language === 'es') {
    return [
      `Hola ${input.spotterName},`,
      '',
      `Buscamos lugares de la categoría «${CATEGORY_ES[input.category] ?? input.category}» en ${input.zoneName}.`,
      input.landmarkHint ? `Pista: ${input.landmarkHint}.` : '',
      `Toma ${photos} fotos del lugar, incluyendo el letrero si existe, y describe el punto de referencia para encontrarlo.`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    `Hi ${input.spotterName},`,
    '',
    `We are looking for places in the “${CATEGORY_EN[input.category] ?? input.category}” category in ${input.zoneName}.`,
    input.landmarkHint ? `Hint: ${input.landmarkHint}.` : '',
    `Take ${photos} photos of the place, including the sign if there is one, and describe the landmark so it can be found.`,
  ]
    .filter(Boolean)
    .join('\n');
}
