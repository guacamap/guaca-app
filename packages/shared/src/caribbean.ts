/**
 * The Caribbean scope, honestly. Country roster follows the UN geoscheme
 * (islands + the basin's mainland states the product operates in);
 * Mexico is deliberately absent — it is not a Caribbean country.
 * Bermuda is grouped with the Caribbean by the UN but sits outside the
 * basin in the North Atlantic, so it is not on this map. PRODUCT.md: the region is the product;
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
  { code: 'AI', name: 'Anguilla', nameEs: 'Anguila', capital: 'The Valley', lat: 18.222, lon: -63.058, status: 'uncovered' },
  { code: 'VG', name: 'British Virgin Islands', nameEs: 'Islas Vírgenes Británicas', capital: 'Road Town', lat: 18.425, lon: -64.62, status: 'uncovered' },
  { code: 'VI', name: 'United States Virgin Islands', nameEs: 'Islas Vírgenes de los EE. UU.', capital: 'Charlotte Amalie', lat: 18.343, lon: -64.931, status: 'uncovered' },
  { code: 'TC', name: 'Turks and Caicos Islands', nameEs: 'Islas Turcas y Caicos', capital: 'Cockburn Town', lat: 21.783, lon: -72.25, status: 'uncovered' },
  { code: 'MS', name: 'Montserrat', nameEs: 'Montserrat', capital: 'Brades', lat: 16.79, lon: -62.212, status: 'uncovered' },
  { code: 'BL', name: 'Saint Barthélemy', nameEs: 'San Bartolomé', capital: 'Gustavia', lat: 17.9, lon: -62.853, status: 'uncovered' },
  { code: 'SX', name: 'Saint Martin / Sint Maarten', nameEs: 'San Martín / Sint Maarten', capital: 'Philipsburg', lat: 18.029, lon: -63.049, status: 'uncovered' },
  { code: 'BQ', name: 'Bonaire', nameEs: 'Bonaire', capital: 'Kralendijk', lat: 12.151, lon: -68.27, status: 'uncovered' },
  { code: 'BZ', name: 'Belize', nameEs: 'Belice', capital: 'Belmopan', lat: 17.251, lon: -88.759, status: 'uncovered' },
  { code: 'HN', name: 'Honduras', nameEs: 'Honduras', capital: 'Roatán', lat: 16.325, lon: -86.535, status: 'uncovered' },
];

/** Exactly one country may claim 'live' — the pilot. Enforced by test. */
export function liveCountries(): CaribbeanCountry[] {
  return CARIBBEAN_COUNTRIES.filter((c) => c.status === 'live');
}

/**
 * Tourist zones seeded as AREAS — the result of the destination research
 * (arrivals and search-volume rankings, 2025-26): within each country the
 * zones are ordered MOST-SEARCHED FIRST, and the OSM POI import follows
 * this order, so the most-searched zones get their interest points first.
 * The pilot stays first in Venezuela. Geometry is a modest bbox polygon.
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
  // Venezuela — the pilot first, then the country's most-searched zones.
  { countryCode: 'VE', slug: 'puerto-cabello', name: 'Puerto Cabello', lat: 10.4716, lon: -68.0056, span: 0.05 },
  { countryCode: 'VE', slug: 'margarita', name: 'Isla de Margarita', lat: 11.0, lon: -63.9, span: 0.12 },
  { countryCode: 'VE', slug: 'morrocoy-tucacas', name: 'Morrocoy (Tucacas)', lat: 10.85, lon: -68.32, span: 0.06 },
  { countryCode: 'VE', slug: 'los-roques', name: 'Los Roques', lat: 11.85, lon: -66.75, span: 0.08 },
  { countryCode: 'VE', slug: 'la-guaira', name: 'La Guaira', lat: 10.6, lon: -66.93, span: 0.05 },
  { countryCode: 'VE', slug: 'mochima', name: 'Mochima', lat: 10.3, lon: -64.4, span: 0.1 },
  { countryCode: 'VE', slug: 'choroni', name: 'Choroní', lat: 10.49, lon: -67.74, span: 0.04 },
  // Dominican Republic — the region's most-visited country; Punta Cana is
  // the single most-searched Caribbean destination.
  { countryCode: 'DO', slug: 'punta-cana', name: 'Punta Cana', lat: 18.58, lon: -68.37, span: 0.06 },
  { countryCode: 'DO', slug: 'puerto-plata', name: 'Puerto Plata', lat: 19.79, lon: -70.69, span: 0.06 },
  { countryCode: 'DO', slug: 'samana', name: 'Samaná (Las Terrenas)', lat: 19.39, lon: -69.53, span: 0.08 },
  { countryCode: 'DO', slug: 'la-romana', name: 'La Romana (Bayahíbe)', lat: 18.38, lon: -68.9, span: 0.06 },
  { countryCode: 'DO', slug: 'santo-domingo', name: 'Santo Domingo', lat: 18.486, lon: -69.931, span: 0.05 },
  // Mexico — the Caribbean coast; Cancún tops US traveller searches.
  // Jamaica — record arrivals; Montego Bay the hub.
  { countryCode: 'JM', slug: 'montego-bay', name: 'Montego Bay', lat: 18.47, lon: -77.92, span: 0.06 },
  { countryCode: 'JM', slug: 'negril', name: 'Negril', lat: 18.27, lon: -78.35, span: 0.05 },
  { countryCode: 'JM', slug: 'ocho-rios', name: 'Ocho Ríos', lat: 18.41, lon: -77.1, span: 0.05 },
  { countryCode: 'JM', slug: 'kingston', name: 'Kingston', lat: 17.971, lon: -76.793, span: 0.05 },
  // Bahamas
  { countryCode: 'BS', slug: 'nassau', name: 'Nassau', lat: 25.08, lon: -77.35, span: 0.06 },
  { countryCode: 'BS', slug: 'exuma', name: 'Exuma', lat: 23.58, lon: -75.78, span: 0.08 },
  { countryCode: 'BS', slug: 'freeport', name: 'Freeport', lat: 26.53, lon: -78.69, span: 0.06 },
  // Puerto Rico
  { countryCode: 'PR', slug: 'san-juan', name: 'San Juan', lat: 18.466, lon: -66.106, span: 0.05 },
  { countryCode: 'PR', slug: 'rincon', name: 'Rincón', lat: 18.34, lon: -67.24, span: 0.04 },
  // Cuba
  { countryCode: 'CU', slug: 'la-habana', name: 'La Habana', lat: 23.113, lon: -82.366, span: 0.05 },
  { countryCode: 'CU', slug: 'varadero', name: 'Varadero', lat: 23.2, lon: -81.3, span: 0.05 },
  { countryCode: 'CU', slug: 'trinidad-cuba', name: 'Trinidad', lat: 21.8, lon: -79.98, span: 0.04 },
  // Colombia
  { countryCode: 'CO', slug: 'cartagena', name: 'Cartagena', lat: 10.391, lon: -75.479, span: 0.05 },
  { countryCode: 'CO', slug: 'santa-marta', name: 'Santa Marta', lat: 11.24, lon: -74.21, span: 0.05 },
  { countryCode: 'CO', slug: 'san-andres', name: 'San Andrés', lat: 12.58, lon: -81.7, span: 0.05 },
  // Costa Rica — the Caribbean side only.
  { countryCode: 'CR', slug: 'puerto-viejo', name: 'Puerto Viejo', lat: 9.65, lon: -82.75, span: 0.05 },
  { countryCode: 'CR', slug: 'san-jose', name: 'San José', lat: 9.928, lon: -84.091, span: 0.05 },
  // Panama
  { countryCode: 'PA', slug: 'bocas-del-toro', name: 'Bocas del Toro', lat: 9.34, lon: -82.22, span: 0.06 },
  { countryCode: 'PA', slug: 'panama', name: 'Panamá', lat: 8.984, lon: -79.519, span: 0.05 },
  // Trinidad & Tobago
  { countryCode: 'TT', slug: 'tobago', name: 'Tobago', lat: 11.18, lon: -60.74, span: 0.09 },
  { countryCode: 'TT', slug: 'port-of-spain', name: 'Port of Spain', lat: 10.654, lon: -61.502, span: 0.04 },
  // The Lesser Antilles — one zone each, their touristic centre.
  { countryCode: 'AW', slug: 'oranjestad', name: 'Oranjestad', lat: 12.521, lon: -70.027, span: 0.04 },
  { countryCode: 'CW', slug: 'willemstad', name: 'Willemstad', lat: 12.111, lon: -68.935, span: 0.04 },
  { countryCode: 'BB', slug: 'bridgetown', name: 'Bridgetown', lat: 13.113, lon: -59.599, span: 0.04 },
  { countryCode: 'HT', slug: 'cap-haitien', name: 'Cap-Haïtien', lat: 19.76, lon: -72.2, span: 0.05 },
  { countryCode: 'HT', slug: 'port-au-prince', name: 'Port-au-Prince', lat: 18.594, lon: -72.307, span: 0.05 },
  { countryCode: 'GP', slug: 'pointe-a-pitre', name: 'Pointe-à-Pitre', lat: 16.24, lon: -61.53, span: 0.04 },
  { countryCode: 'GP', slug: 'basse-terre', name: 'Basse-Terre', lat: 16.241, lon: -61.533, span: 0.04 },
  { countryCode: 'MQ', slug: 'fort-de-france', name: 'Fort-de-France', lat: 14.604, lon: -61.068, span: 0.04 },
  { countryCode: 'DM', slug: 'roseau', name: 'Roseau', lat: 15.301, lon: -61.388, span: 0.04 },
  { countryCode: 'GD', slug: 'st-georges', name: "St George's", lat: 12.056, lon: -61.748, span: 0.04 },
  { countryCode: 'LC', slug: 'castries', name: 'Castries', lat: 14.01, lon: -60.999, span: 0.04 },
  { countryCode: 'VC', slug: 'kingstown', name: 'Kingstown', lat: 13.158, lon: -61.224, span: 0.04 },
  { countryCode: 'AG', slug: 'st-johns', name: "St John's", lat: 17.117, lon: -61.845, span: 0.04 },
  { countryCode: 'KN', slug: 'basseterre', name: 'Basseterre', lat: 17.297, lon: -62.719, span: 0.04 },
  { countryCode: 'KY', slug: 'george-town', name: 'George Town', lat: 19.3, lon: -81.38, span: 0.05 },
  { countryCode: 'BZ', slug: 'san-pedro', name: 'San Pedro (Ambergris)', lat: 17.92, lon: -87.97, span: 0.05 },
  { countryCode: 'BZ', slug: 'belmopan', name: 'Belmopan', lat: 17.251, lon: -88.759, span: 0.05 },
  { countryCode: 'HN', slug: 'roatán', name: 'Roatán', lat: 16.325, lon: -86.535, span: 0.06 },
  // The Lesser-Antillean islands added from the UN geoscheme roster.
  { countryCode: 'AI', slug: 'anguilla', name: 'Anguilla (Shoal Bay)', lat: 18.19, lon: -63.01, span: 0.04 },
  { countryCode: 'VG', slug: 'tortola', name: 'Tortola (Road Town)', lat: 18.425, lon: -64.62, span: 0.05 },
  { countryCode: 'VI', slug: 'st-thomas', name: 'St Thomas', lat: 18.343, lon: -64.931, span: 0.05 },
  { countryCode: 'TC', slug: 'provodenciales', name: 'Providenciales (Grace Bay)', lat: 21.783, lon: -72.25, span: 0.06 },
  { countryCode: 'MS', slug: 'montserrat', name: 'Montserrat (Little Bay)', lat: 16.78, lon: -62.2, span: 0.04 },
  { countryCode: 'BL', slug: 'gustavia', name: 'Gustavia', lat: 17.9, lon: -62.853, span: 0.03 },
  { countryCode: 'SX', slug: 'philipsburg', name: 'Philipsburg', lat: 18.029, lon: -63.049, span: 0.04 },
  { countryCode: 'BQ', slug: 'kralendijk', name: 'Kralendijk', lat: 12.151, lon: -68.27, span: 0.04 },
];
