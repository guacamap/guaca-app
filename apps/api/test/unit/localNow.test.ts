import { describe, expect, it } from 'vitest';
import { localNowMin } from '../../src/plannerService.js';

describe('the town clock', () => {
  it('reads Caracas time, not the server clock', () => {
    // 22:15 UTC is 18:15 in Caracas (UTC-4).
    expect(localNowMin('America/Caracas', new Date('2026-09-02T22:15:00Z'))).toBe(18 * 60 + 15);
    expect(localNowMin('America/Jamaica', new Date('2026-09-02T22:15:00Z'))).toBe(17 * 60 + 15);
  });
  it('falls back to UTC when the zone is missing', () => {
    expect(localNowMin(undefined, new Date('2026-09-02T22:15:00Z'))).toBe(22 * 60 + 15);
  });
});
