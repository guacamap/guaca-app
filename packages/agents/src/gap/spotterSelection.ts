export interface SpotterCandidate {
  id: string;
  name: string;
  /** The zone they own (home_h3). */
  zoneId: string;
  homeH3: string;
  level: number;
  openMissions: number;
}

/**
 * T5.3 — spotter selection. Zone owner first; then level; then fewest open
 * missions. Never winner-takes-all — the fairness correction in the
 * commission step keeps income spread across the curated 10–20.
 */
export function selectSpotter(
  candidates: readonly SpotterCandidate[],
  zoneId: string,
): SpotterCandidate | null {
  if (candidates.length === 0) return null;

  const zoneOwner = candidates.find(
    (c) => c.zoneId === zoneId || c.homeH3 === zoneId,
  );
  if (zoneOwner) return zoneOwner;

  const sorted = [...candidates].sort(
    (a, b) => b.level - a.level || a.openMissions - b.openMissions,
  );
  return sorted[0] ?? null;
}
