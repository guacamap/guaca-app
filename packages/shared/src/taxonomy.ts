import { PlaceCategory } from './schemas.js';

export interface TaxonomyEntry {
  category: PlaceCategory;
  labelEs: string;
  labelEn: string;
  /** Target verified places per category for the gap agent. */
  targetDensity: number;
  /** One glyph, used everywhere a place's category needs a mark: pins,
   *  candidate dots, category chips. Kept here so the map, the tourist
   *  app and the spotter app draw from one definition instead of three. */
  emoji: string;
  /** The same category's colour on a pin, a chip and a map dot. */
  color: string;
}

/**
 * Fixed taxonomy of place categories with bilingual labels and the gap-agent
 * target density. Exact categories from plan §8.
 */
export const TAXONOMY: readonly TaxonomyEntry[] = [
  {
    category: 'eat_drink',
    labelEs: 'Comer y beber',
    labelEn: 'Eat & drink',
    targetDensity: 12,
    emoji: '🍽️',
    color: '#E8735A',
  },
  {
    category: 'beach_water',
    labelEs: 'Playas y agua',
    labelEn: 'Beach & water',
    targetDensity: 8,
    emoji: '🏖️',
    color: '#0D8B8B',
  },
  {
    category: 'nature_walk',
    labelEs: 'Naturaleza y caminatas',
    labelEn: 'Nature & walks',
    targetDensity: 6,
    emoji: '🥾',
    color: '#2D8B4E',
  },
  {
    category: 'culture_history',
    labelEs: 'Cultura e historia',
    labelEn: 'Culture & history',
    targetDensity: 8,
    emoji: '🏛️',
    color: '#0C4A5C',
  },
  {
    category: 'market_shop',
    labelEs: 'Mercados y tiendas',
    labelEn: 'Markets & shops',
    targetDensity: 8,
    emoji: '🛍️',
    color: '#D4A853',
  },
  {
    category: 'services',
    labelEs: 'Servicios',
    labelEn: 'Services',
    targetDensity: 6,
    emoji: '🔧',
    color: '#2D4A50',
  },
  {
    category: 'nightlife_music',
    labelEs: 'Vida nocturna y música',
    labelEn: 'Nightlife & music',
    targetDensity: 4,
    emoji: '🎶',
    color: '#9B4F96',
  },
  {
    category: 'practical',
    labelEs: 'Práctico',
    labelEn: 'Practical',
    targetDensity: 4,
    emoji: '🚌',
    color: '#5B7C99',
  },
];

export function targetDensityFor(category: PlaceCategory): number {
  const entry = TAXONOMY.find((e) => e.category === category);
  if (!entry) throw new Error(`unknown category: ${category}`);
  return entry.targetDensity;
}

/** Every category with its bilingual labels, keyed for fast lookup. */
export const TAXONOMY_BY_CATEGORY: ReadonlyMap<
  PlaceCategory,
  TaxonomyEntry
> = new Map(TAXONOMY.map((e) => [e.category, e]));
