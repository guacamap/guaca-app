import { z } from 'zod';
import { PlaceCategory } from '@guaca/shared';

/**
 * The planner's intent — what the guest asked, structurally. Strict: extra
 * keys (like a place name) fail. Unparseable input degrades to a broad
 * category instead of failing the whole request.
 */
export const IntentSchema = z
  .object({
    category: PlaceCategory,
    h3_8: z.string().optional(),
    when: z.enum(['now', 'morning', 'afternoon', 'evening']).optional(),
    partySize: z.number().int().min(1).max(20).optional(),
  })
  .strict();

export type Intent = z.infer<typeof IntentSchema>;

/** Parse an unknown intent; junk → null (caller falls back to broad). */
export function parseIntent(raw: unknown): Intent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const parsed = IntentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const BROAD_DEFAULT: Intent = { category: 'eat_drink', when: 'now' };

/** Deterministic bilingual lexicon — ~80% of questions classified free. */
const LEXICON: Record<string, PlaceCategory> = {
  // eat_drink
  comer: 'eat_drink', beber: 'eat_drink', arepa: 'eat_drink', arepas: 'eat_drink',
  cafe: 'eat_drink', café: 'eat_drink', restaurante: 'eat_drink', restaurant: 'eat_drink',
  comida: 'eat_drink', food: 'eat_drink', eat: 'eat_drink', drink: 'eat_drink',
  desayuno: 'eat_drink', almuerzo: 'eat_drink', cena: 'eat_drink', lunch: 'eat_drink',
  dinner: 'eat_drink', breakfast: 'eat_drink', panaderia: 'eat_drink', bakery: 'eat_drink',
  bar: 'eat_drink', cerveza: 'eat_drink', beer: 'eat_drink',
  // beach_water
  playa: 'beach_water', beach: 'beach_water', snorkel: 'beach_water', bucear: 'beach_water',
  nadar: 'beach_water', swim: 'beach_water', mar: 'beach_water', sea: 'beach_water',
  rio: 'beach_water', river: 'beach_water', cascada: 'beach_water', waterfall: 'beach_water',
  pool: 'beach_water', piscina: 'beach_water', isla: 'beach_water', island: 'beach_water',
  // nature_walk
  caminata: 'nature_walk', hike: 'nature_walk', sendero: 'nature_walk', trail: 'nature_walk',
  montana: 'nature_walk', mountain: 'nature_walk', parque: 'nature_walk', park: 'nature_walk',
  naturaleza: 'nature_walk', nature: 'nature_walk', mirador: 'nature_walk', viewpoint: 'nature_walk',
  // culture_history
  museo: 'culture_history', museum: 'culture_history', iglesia: 'culture_history', church: 'culture_history',
  historia: 'culture_history', history: 'culture_history', fortin: 'culture_history', fort: 'culture_history',
  castillo: 'culture_history', castle: 'culture_history', mural: 'culture_history', cultura: 'culture_history',
  culture: 'culture_history', plaza: 'culture_history',
  // market_shop
  mercado: 'market_shop', market: 'market_shop', tienda: 'market_shop', shop: 'market_shop',
  comprar: 'market_shop', buy: 'market_shop', farmacia: 'market_shop', pharmacy: 'market_shop',
  souvenir: 'market_shop', artisan: 'market_shop', artesania: 'market_shop',
  // services
  cajero: 'services', atm: 'services', clinica: 'services', clinic: 'services',
  hospital: 'services', lavanderia: 'services', laundry: 'services', gasolina: 'services',
  fuel: 'services', gasolinera: 'services', doctor: 'services',
  // nightlife_music
  musica: 'nightlife_music', music: 'nightlife_music', baile: 'nightlife_music', dance: 'nightlife_music',
  discoteca: 'nightlife_music', nightclub: 'nightlife_music', rumba: 'nightlife_music',
  // practical
  bus: 'practical', autobus: 'practical', ferry: 'practical', taxi: 'practical',
  wifi: 'practical', estacion: 'practical', station: 'practical',
};

const WHEN: Record<string, Intent['when']> = {
  ahora: 'now', now: 'now', manana: 'morning', morning: 'morning',
  mediodia: 'afternoon', afternoon: 'afternoon', tarde: 'afternoon',
  noche: 'evening', evening: 'evening',
};

/**
 * Deterministic intent extraction (plan §7.8: lexicon first, ~60% of answers
 * use zero inference). Unparseable input degrades to the broad category.
 */
export function extractIntent(text: string): Intent {
  const words = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  let category: PlaceCategory | undefined;
  for (const w of words) {
    const c = LEXICON[w];
    if (c) {
      category = c;
      break;
    }
  }

  let when: Intent['when'] | undefined;
  for (const w of words) {
    const t = WHEN[w];
    if (t) {
      when = t;
      break;
    }
  }

  const party = text.match(/(\d+)\s*(people|persons|personas|pax|adults|adultos)/i);

  return {
    category: category ?? BROAD_DEFAULT.category,
    when: when ?? BROAD_DEFAULT.when,
    ...(party ? { partySize: Number(party[1]) } : {}),
  };
}
