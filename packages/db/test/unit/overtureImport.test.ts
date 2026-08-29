import { describe, expect, it } from 'vitest';
import { categoryForOverture, nameSimilarity } from '../../src/seed/overtureImport.js';

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
});
