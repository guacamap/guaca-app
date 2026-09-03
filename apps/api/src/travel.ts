import { groundFromVerifiedRows, type PlanArtifact } from '@guaca/agents';
import type { Leg, Router } from './routing.js';

export type LegKey = `${string}>${string}`;

/**
 * The plan with travel between stops taken seriously: each leg is asked
 * of the router, and a stop that would start before the traveller could
 * arrive is pushed later, its successors with it. The guard already proved
 * every id; the re-mint here only carries the new times through the same
 * gate. Legs come back keyed "from>to" for the renderer.
 */
export async function applyTravel(
  artifact: PlanArtifact,
  coords: ReadonlyMap<string, { lat: number; lon: number }>,
  router: Router,
): Promise<{ artifact: PlanArtifact; legs: Map<LegKey, Leg> }> {
  const legs = new Map<LegKey, Leg>();
  const stops = artifact.stops.map((s) => ({ ...s }));
  const days = [...new Set(stops.map((s) => s.dayIndex))];
  for (const day of days) {
    const ordered = stops.filter((s) => s.dayIndex === day).sort((a, b) => a.startMin - b.startMin);
    const pts = ordered.map((s) => coords.get(s.placeId)).filter((p): p is { lat: number; lon: number } => !!p);
    if (pts.length !== ordered.length || ordered.length < 2) continue;
    const dayLegs = await router.legs(pts);
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]!;
      const cur = ordered[i]!;
      const leg = dayLegs[i - 1]!;
      legs.set(`${prev.placeId}>${cur.placeId}`, leg);
      const earliest = prev.startMin + prev.durationMin + leg.minutes + 5;
      if (cur.startMin < earliest) cur.startMin = Math.min(1439 - cur.durationMin, earliest);
    }
  }
  return { artifact: groundFromVerifiedRows(stops, new Set(artifact.placeIds)), legs };
}
