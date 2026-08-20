/**
 * The Caribbean scope, honestly. PRODUCT.md: the region is the product;
 * Puerto Cabello is where coverage BEGINS. A country marker is a claim, so
 * each status is a fact:
 *
 * - live      — a pilot with verified places exists there today
 * - planned   — a named expansion target (PRODUCT.md names Colombia and
 *               Costa Rica); coverage grows where travellers ask
 * - uncovered — no local has verified anything there yet. The map says so
 *               plainly rather than implying coverage
 */
export type CountryCoverageStatus = 'live' | 'planned' | 'uncovered';

export interface CaribbeanCountry {
  code: string;
  name: string;
  nameEs: string;
  capital: string;
  lat: number;
  lon: number;
  status: CountryCoverageStatus;
  /** The honest one-liner for the marker, when status needs specifics. */
  note?: string;
}

export const CARIBBEAN_COUNTRIES: readonly CaribbeanCountry[] = [
  { code: 'VE', name: 'Venezuela', nameEs: 'Venezuela', capital: 'Puerto Cabello', lat: 10.4716, lon: -68.0056, status: 'live', note: 'Pilot live — Puerto Cabello' },
  { code: 'CO', name: 'Colombia', nameEs: 'Colombia', capital: 'Cartagena', lat: 10.391, lon: -75.479, status: 'planned' },
  { code: 'CR', name: 'Costa Rica', nameEs: 'Costa Rica', capital: 'San José', lat: 9.928, lon: -84.091, status: 'planned' },
  { code: 'PA', name: 'Panama', nameEs: 'Panamá', capital: 'Panama City', lat: 8.984, lon: -79.519, status: 'uncovered' },
  { code: 'DO', name: 'Dominican Republic', nameEs: 'República Dominicana', capital: 'Santo Domingo', lat: 18.486, lon: -69.931, status: 'uncovered' },
  { code: 'CU', name: 'Cuba', nameEs: 'Cuba', capital: 'Havana', lat: 23.113, lon: -82.366, status: 'uncovered' },
  { code: 'JM', name: 'Jamaica', nameEs: 'Jamaica', capital: 'Kingston', lat: 17.971, lon: -76.793, status: 'uncovered' },
  { code: 'PR', name: 'Puerto Rico', nameEs: 'Puerto Rico', capital: 'San Juan', lat: 18.466, lon: -66.106, status: 'uncovered' },
  { code: 'HT', name: 'Haiti', nameEs: 'Haití', capital: 'Port-au-Prince', lat: 18.594, lon: -72.307, status: 'uncovered' },
  { code: 'TT', name: 'Trinidad & Tobago', nameEs: 'Trinidad y Tobago', capital: 'Port of Spain', lat: 10.654, lon: -61.502, status: 'uncovered' },
  { code: 'BS', name: 'Bahamas', nameEs: 'Bahamas', capital: 'Nassau', lat: 25.044, lon: -77.355, status: 'uncovered' },
  { code: 'BB', name: 'Barbados', nameEs: 'Barbados', capital: 'Bridgetown', lat: 13.113, lon: -59.599, status: 'uncovered' },
  { code: 'AW', name: 'Aruba', nameEs: 'Aruba', capital: 'Oranjestad', lat: 12.521, lon: -70.027, status: 'uncovered' },
  { code: 'CW', name: 'Curaçao', nameEs: 'Curazao', capital: 'Willemstad', lat: 12.111, lon: -68.935, status: 'uncovered' },
  { code: 'DM', name: 'Dominica', nameEs: 'Dominica', capital: 'Roseau', lat: 15.301, lon: -61.388, status: 'uncovered' },
  { code: 'GD', name: 'Grenada', nameEs: 'Granada', capital: "St George's", lat: 12.056, lon: -61.748, status: 'uncovered' },
  { code: 'LC', name: 'Saint Lucia', nameEs: 'Santa Lucía', capital: 'Castries', lat: 14.010, lon: -60.999, status: 'uncovered' },
  { code: 'VC', name: 'Saint Vincent', nameEs: 'San Vicente', capital: 'Kingstown', lat: 13.158, lon: -61.224, status: 'uncovered' },
  { code: 'AG', name: 'Antigua & Barbuda', nameEs: 'Antigua y Barbuda', capital: "St John's", lat: 17.117, lon: -61.845, status: 'uncovered' },
  { code: 'KN', name: 'Saint Kitts & Nevis', nameEs: 'San Cristóbal y Nieves', capital: 'Basseterre', lat: 17.297, lon: -62.719, status: 'uncovered' },
  { code: 'GP', name: 'Guadeloupe', nameEs: 'Guadalupe', capital: 'Basse-Terre', lat: 16.241, lon: -61.533, status: 'uncovered' },
  { code: 'MQ', name: 'Martinique', nameEs: 'Martinica', capital: 'Fort-de-France', lat: 14.604, lon: -61.068, status: 'uncovered' },
  { code: 'KY', name: 'Cayman Islands', nameEs: 'Islas Caimán', capital: 'George Town', lat: 19.287, lon: -81.367, status: 'uncovered' },
  { code: 'BZ', name: 'Belize', nameEs: 'Belice', capital: 'Belmopan', lat: 17.251, lon: -88.759, status: 'uncovered' },
  { code: 'HN', name: 'Honduras', nameEs: 'Honduras', capital: 'Roatán', lat: 16.325, lon: -86.535, status: 'uncovered' },
  { code: 'MX', name: 'Mexico', nameEs: 'México', capital: 'Cancún', lat: 21.162, lon: -86.851, status: 'uncovered' },
];

/** Exactly one country may claim 'live' — the pilot. Enforced by test. */
export function liveCountries(): CaribbeanCountry[] {
  return CARIBBEAN_COUNTRIES.filter((c) => c.status === 'live');
}

/**
 * Cities seeded as AREAS so the multi-region model is exercised beyond the
 * pilot: OSM candidates can be imported into them on demand, and verified
 * places can exist there the day a local Spotter starts. Area geometry is a
 * modest bbox polygon around the city centre.
 */
export interface CaribbeanCity {
  countryCode: string;
  slug: string;
  name: string;
  lat: number;
  lon: number;
  /** bbox half-size in degrees (~0.05 ≈ 5–6 km). */
  span: number;
}

export const CARIBBEAN_CITIES: readonly CaribbeanCity[] = [
  { countryCode: 'CO', slug: 'cartagena', name: 'Cartagena', lat: 10.391, lon: -75.479, span: 0.05 },
  { countryCode: 'CR', slug: 'san-jose', name: 'San José', lat: 9.928, lon: -84.091, span: 0.05 },
  { countryCode: 'DO', slug: 'santo-domingo', name: 'Santo Domingo', lat: 18.486, lon: -69.931, span: 0.05 },
  { countryCode: 'CU', slug: 'la-habana', name: 'La Habana', lat: 23.113, lon: -82.366, span: 0.05 },
  { countryCode: 'JM', slug: 'kingston', name: 'Kingston', lat: 17.971, lon: -76.793, span: 0.05 },
  { countryCode: 'PR', slug: 'san-juan', name: 'San Juan', lat: 18.466, lon: -66.106, span: 0.05 },
  { countryCode: 'PA', slug: 'panama', name: 'Panamá', lat: 8.984, lon: -79.519, span: 0.05 },
  { countryCode: 'TT', slug: 'port-of-spain', name: 'Port of Spain', lat: 10.654, lon: -61.502, span: 0.04 },
];
