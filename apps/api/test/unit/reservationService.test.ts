import { describe, expect, it } from 'vitest';
import { dateOnly, venueLocalDate } from '../../src/reservationService.ts';

describe('venue-local stay dates', () => {
  it('formats America/Bogota calendar dates from an instant', () => {
    expect(venueLocalDate('America/Bogota', new Date('2026-09-12T14:00:00-05:00'))).toBe(
      '2026-09-12',
    );
    expect(venueLocalDate('America/Bogota', new Date('2026-09-13T04:30:00Z'))).toBe('2026-09-12');
    expect(venueLocalDate('America/Bogota', new Date('2026-09-13T05:00:00Z'))).toBe('2026-09-13');
  });

  it('reads DATE values as UTC calendar days', () => {
    expect(dateOnly(new Date('2026-09-15T00:00:00Z'))).toBe('2026-09-15');
    expect(dateOnly('2026-09-16')).toBe('2026-09-16');
  });
});
