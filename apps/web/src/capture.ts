export interface AccuracyGate {
  ok: boolean;
  reason?: string;
}

/**
 * T7.3 — a photo is only submittable when the device-attested geolocation is
 * accurate enough (VERIFICATION_GEO_TOLERANCE_M). The browser PWA has no
 * EXIF — geolocation is captured alongside the shutter and attested by the
 * client; the server's rungs 3, 5 and 6 are the real defences.
 */
export function canSubmitWithAccuracy(
  accuracyM: number | null,
  toleranceM: number,
): AccuracyGate {
  if (accuracyM === null) {
    return { ok: false, reason: 'geolocation unavailable — move outside or retry' };
  }
  if (accuracyM > toleranceM) {
    return {
      ok: false,
      reason: `GPS accuracy ${Math.round(accuracyM)}m is worse than ${toleranceM}m — move outside and retry`,
    };
  }
  return { ok: true };
}
