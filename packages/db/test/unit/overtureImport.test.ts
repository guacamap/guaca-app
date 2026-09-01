import { describe, expect, it } from 'vitest';
import { categoryForOverture, humanizeCategory, nameSimilarity, subcategoryFor } from '../../src/seed/overtureImport.js';

describe('overture import helpers', () => {
  it('maps Overture categories onto the taxonomy, alternates included', () => {
    expect(categoryForOverture('restaurant', ['mexican_restaurant'])).toBe('eat_drink');
    expect(categoryForOverture('beach')).toBe('beach_water');
    expect(categoryForOverture('hotel')).toBe('practical');
    expect(categoryForOverture('landmark_and_historical_building')).toBe('culture_history');
    expect(categoryForOverture('auto_parts_and_supply_store')).toBe('market_shop');
    expect(categoryForOverture(null)).toBeNull();
  });

  it('treats accents, case and containment as the same name', () => {
    expect(nameSimilarity('Café Colonial', 'cafe colonial')).toBe(1);
    expect(nameSimilarity('Arepera El Malecón', 'El Malecon')).toBe(1);
    expect(nameSimilarity('Posada La Fortaleza', 'Farmacia La Salud')).toBeLessThan(0.6);
  });

  it('humanizes a snake_case category into a readable label', () => {
    expect(humanizeCategory('mexican_restaurant')).toBe('Mexican restaurant');
    expect(humanizeCategory('church_cathedral')).toBe('Church cathedral');
    expect(humanizeCategory('atm')).toBe('Atm');
  });

  it('picks the most specific descriptor: alternate over primary, brand over both', () => {
    expect(subcategoryFor({ categories: { primary: 'restaurant', alternate: ['mexican_restaurant', 'spanish_restaurant'] } })).toBe('Mexican restaurant');
    expect(subcategoryFor({ categories: { primary: 'diagnostic_services' } })).toBe('Diagnostic services');
    expect(subcategoryFor({ categories: { primary: 'restaurant' }, brand: { names: { primary: 'Arturos' } } })).toBe('Arturos · Restaurant');
    expect(subcategoryFor({ categories: null })).toBeNull();
  });
});
