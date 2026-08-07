export interface FreshnessVerdict {
  pass: boolean;
  hard: boolean;
  hoursOutside: number;
}

/**
 * Rung L1 — capture timestamp inside the mission window. Outside by more
 * than 24h → hard fail (~1ms, zero tokens). Exactly at the boundary passes.
 */
export function checkFreshness(
  capturedAt: Date,
  missionStart: Date,
  missionEnd: Date,
): FreshnessVerdict {
  const t = capturedAt.getTime();
  const hoursOutside = Math.max(
    (missionStart.getTime() - t) / 3_600_000,
    (t - missionEnd.getTime()) / 3_600_000,
    0,
  );
  return {
    pass: hoursOutside <= 24,
    hard: hoursOutside > 24,
    hoursOutside,
  };
}

export type GeoVerdict = 'PASS' | 'WEAK' | 'HARD' | 'INCONCLUSIVE';

export interface GeoDistanceResult {
  verdict: GeoVerdict;
  /** 0..1 — the gpsScore used in the trust fusion. */
  score: number;
  distanceM: number | null;
}

const TOLERANCE_M = 75;
const HARD_M = 250;

/** Approximate great-circle distance in metres. */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Rung L2 — photo position vs the pin. Device-attested GPS (the PWA has no
 * EXIF); EXIF would corroborate. ≤75m PASS, 75–250m WEAK (linear 1.0→0.3),
 * >250m hard, absent → INCONCLUSIVE.
 */
export function checkGeoDistance(
  lat: number | null,
  lon: number | null,
  accuracyM: number | null,
  pin: { lat: number; lon: number },
): GeoDistanceResult {
  if (lat === null || lon === null) {
    return { verdict: 'INCONCLUSIVE', score: 0, distanceM: null };
  }
  const d = distanceM(lat, lon, pin.lat, pin.lon);
  if (d <= TOLERANCE_M) return { verdict: 'PASS', score: 1, distanceM: d };
  if (d > HARD_M) return { verdict: 'HARD', score: 0, distanceM: d };
  // 75..250m: linear 1.0 → 0.3.
  const t = (d - TOLERANCE_M) / (HARD_M - TOLERANCE_M);
  const score = 1 - 0.7 * t;
  return { verdict: 'WEAK', score, distanceM: d };
}
