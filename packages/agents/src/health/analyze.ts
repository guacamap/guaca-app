import { TAXONOMY } from '@guaca/shared';

/** Structural mirror of @guaca/db's loadMapHealthStats result — agents
 *  never import the db package (adapters/data are injected, house rule). */
export interface MapHealthStats {
  areaId: string;
  categories: Array<{ category: string; verified: number; refusedAsks: number }>;
  stalePlaces: Array<{ id: string; name: string; category: string; verifiedAt: string }>;
  weakLandmarks: Array<{ id: string; name: string; category: string; landmarkDescription: string }>;
  zones: Array<{ zoneId: string; zoneName: string; verified: number }>;
}

export type HealthFindingKind =
  | 'unmet_demand'
  | 'category_deficit'
  | 'stale_places'
  | 'weak_landmarks'
  | 'zone_gap';

export interface HealthFinding {
  kind: HealthFindingKind;
  /** 3 = act now, 2 = plan for it, 1 = worth knowing. */
  severity: 1 | 2 | 3;
  category?: string;
  detail: string;
}

export interface MissionCandidate {
  category: string;
  /** Refused asks behind this candidate — the demand that justifies paying. */
  demandAsks: number;
  deficit: number;
  priority: number;
  reason: string;
}

export interface MapHealthAnalysis {
  findings: HealthFinding[];
  missionCandidates: MissionCandidate[];
  totals: { verified: number; refusedAsks: number };
}

/**
 * Pure, deterministic map-health analysis — SQL aggregates in, findings and
 * demand-driven mission candidates out. Zero inference by design (§7.8):
 * the model narrates this; it never decides it. Candidates only ever come
 * from real refused questions — coverage grows in demand order, never
 * speculatively (product rule).
 */
export function analyzeMapHealth(stats: MapHealthStats): MapHealthAnalysis {
  const findings: HealthFinding[] = [];
  const missionCandidates: MissionCandidate[] = [];

  const byCategory = new Map(stats.categories.map((c) => [c.category, c]));
  let verifiedTotal = 0;
  let refusedTotal = 0;

  for (const entry of TAXONOMY) {
    const row = byCategory.get(entry.category);
    const verified = row?.verified ?? 0;
    const asks = row?.refusedAsks ?? 0;
    verifiedTotal += verified;
    refusedTotal += asks;
    const deficit = Math.max(0, entry.targetDensity - verified);

    if (asks > 0 && deficit > 0) {
      findings.push({
        kind: 'unmet_demand',
        severity: 3,
        category: entry.category,
        detail: `${asks} refused ask(s) for ${entry.labelEn}; ${verified}/${entry.targetDensity} verified`,
      });
      missionCandidates.push({
        category: entry.category,
        demandAsks: asks,
        deficit,
        priority: asks * 2 + deficit,
        reason: `${asks} unanswered question(s), coverage at ${verified}/${entry.targetDensity}`,
      });
    } else if (deficit >= Math.ceil(entry.targetDensity / 2)) {
      findings.push({
        kind: 'category_deficit',
        severity: verified === 0 ? 2 : 1,
        category: entry.category,
        detail: `${verified}/${entry.targetDensity} verified for ${entry.labelEn}; no recorded demand yet`,
      });
    }
  }

  if (stats.stalePlaces.length > 0) {
    const oldest = stats.stalePlaces[0]!;
    findings.push({
      kind: 'stale_places',
      severity: stats.stalePlaces.length >= 10 ? 2 : 1,
      detail: `${stats.stalePlaces.length} place(s) verified long ago; oldest: ${oldest.name} (${oldest.verifiedAt.slice(0, 10)})`,
    });
  }

  if (stats.weakLandmarks.length > 0) {
    const names = stats.weakLandmarks.slice(0, 5).map((w) => w.name).join(', ');
    findings.push({
      kind: 'weak_landmarks',
      severity: 1,
      detail: `${stats.weakLandmarks.length} place(s) with thin landmark descriptions (landmark-first rule): ${names}`,
    });
  }

  const emptyZones = stats.zones.filter((z) => z.verified === 0);
  if (emptyZones.length > 0) {
    findings.push({
      kind: 'zone_gap',
      severity: 1,
      detail: `${emptyZones.length} zone(s) without a single verified place: ${emptyZones
        .slice(0, 5)
        .map((z) => z.zoneName)
        .join(', ')}`,
    });
  }

  findings.sort(
    (a, b) => b.severity - a.severity || (a.category ?? a.kind).localeCompare(b.category ?? b.kind),
  );
  missionCandidates.sort(
    (a, b) => b.priority - a.priority || a.category.localeCompare(b.category),
  );

  return {
    findings,
    missionCandidates: missionCandidates.slice(0, 5),
    totals: { verified: verifiedTotal, refusedAsks: refusedTotal },
  };
}
