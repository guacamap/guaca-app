import { HARD_GATES, scoreGap, type GapSignals, type ScoredGap } from './scoring.js';
import { selectSpotter, type SpotterCandidate } from './spotterSelection.js';
import { composeBrief } from './brief.js';

export interface GapRow {
  id: string;
  category: string;
  h3_8: string;
  questionCount: number;
  distinctSessionCount: number;
  lastAskedAt?: string | null;
}

export interface GapAgentOptions {
  areaId: string;
  dryRun: boolean;
  minScore: number;
  maxRewardMinor: number;
  dailyCap: number;
  listGaps(areaId: string): Promise<GapRow[]>;
  countMissionsToday(): Promise<number>;
  /**
   * Real scoring inputs for a gap: ask ages, paying properties near the zone,
   * existing verified coverage and its staleness, spotter capacity. REQUIRED
   * in production — without it the scarcity and commercial terms are inert.
   */
  loadSignals?(gap: GapRow): Promise<GapSignals>;
  /** Real spotter candidates for the zone. Required in production. */
  listSpotters?(zoneId: string): Promise<SpotterCandidate[]>;
  score(g: GapSignals): ScoredGap;
  selectSpotter(candidates: SpotterCandidate[], zoneId: string): Promise<SpotterCandidate | null>;
  composeBrief(input: Parameters<typeof composeBrief>[0]): string;
  /** Persist the computed score on the gap row so `guaca gaps` ranks by it. */
  persistScore?(gapId: string, score: number): Promise<void>;
  commission(args: {
    gapId: string;
    spotterId: string;
    brief: string;
    targetCategory: string;
    targetH3: string;
    rewardMinor: number;
    maxRewardMinor: number;
    dailyCap: number;
    missionsToday: number;
  }): Promise<{ status: 'offered' | 'needs_approval' | 'blocked'; missionId?: string }>;
}

export interface GapAgentResult {
  commissioned: Array<{ gapId: string; missionId?: string; score: number }>;
  explained: string[];
}

/**
 * T5.6 — the gap agent run: cluster → score → hard gates → spotter →
 * brief → commission. `dryRun` scores and explains without commissioning.
 * The GAP_AGENT_ENABLED kill switch lives at the scheduler layer.
 */
export async function runGapAgent(
  options: GapAgentOptions,
): Promise<GapAgentResult> {
  const gaps = await options.listGaps(options.areaId);
  // Snapshot + live count: the snapshot bounds the run against today's spend,
  // the local increment bounds commissions WITHIN the run — otherwise one
  // cycle could commission past the daily cap while every call still saw the
  // same stale number.
  let missionsToday = await options.countMissionsToday();
  const commissioned: GapAgentResult['commissioned'] = [];
  const explained: string[] = [];

  for (const gap of gaps) {
    // Real signals when the caller can supply them. The fallback below keeps
    // unit tests hermetic, but note what it costs in production: with
    // verifiedPlaces empty the scarcity term is always 1, so coverage never
    // suppresses spending, and with properties empty the paying-property
    // weighting — the autonomy claim — does not apply at all. Anything wiring
    // this to a real database MUST pass loadSignals.
    const signals: GapSignals = options.loadSignals
      ? await options.loadSignals(gap)
      : {
          questionCount: gap.questionCount,
          distinctSessions: gap.distinctSessionCount,
          askAgeDays: [],
          properties: [],
          verifiedPlaces: [],
          spotterCapacityInZone: 1,
          accessDifficulty: 0,
        };
    const scored = options.score(signals);

    if (options.persistScore) {
      try {
        await options.persistScore(gap.id, scored.score);
      } catch {
        // The score column is operational sugar for `guaca gaps`; a failed
        // write must not stop the agent from acting on the score it holds.
      }
    }

    if (!HARD_GATES(signals)) {
      explained.push(`gap ${gap.id}: gated (q=${gap.questionCount}, s=${gap.distinctSessionCount})`);
      continue;
    }
    if (scored.score < options.minScore) {
      explained.push(`gap ${gap.id}: score ${scored.score} < ${options.minScore}`);
      continue;
    }

    const candidates = options.listSpotters
      ? await options.listSpotters(gap.h3_8)
      : [
          {
            id: 's1',
            name: 'Yorman',
            zoneId: gap.h3_8,
            homeH3: gap.h3_8,
            level: 2,
            openMissions: 0,
          },
        ];
    const spotter = await options.selectSpotter(candidates, gap.h3_8);
    if (!spotter) {
      explained.push(`gap ${gap.id}: no spotter available`);
      continue;
    }

    const brief = options.composeBrief({
      language: 'es',
      category: gap.category,
      // The zone's human name when the signals could resolve it; the raw h3
      // index is what a brief shows when nothing better exists.
      zoneName: signals.zoneName ?? gap.h3_8,
      spotterName: spotter.name,
      photosRequired: 3,
      ...(signals.stalePlaceNames && signals.stalePlaceNames.length > 0
        ? {
            landmarkHint:
              'revisar si siguen igual: ' + signals.stalePlaceNames.join(', '),
          }
        : {}),
    });

    if (options.dryRun) {
      explained.push(
        `gap ${gap.id}: score ${scored.score} (D=${scored.breakdown.D.toFixed(2)}, ` +
          `R=${scored.breakdown.Rmult.toFixed(2)}, C=${scored.breakdown.Cmult.toFixed(2)}, ` +
          `S=${scored.breakdown.S.toFixed(2)}, F=${scored.breakdown.F.toFixed(2)}, ` +
          `T=${scored.breakdown.T.toFixed(2)}) → would ` +
          `commission ${spotter.name}`,
      );
      continue;
    }

    const res = await options.commission({
      gapId: gap.id,
      spotterId: spotter.id,
      brief,
      targetCategory: gap.category,
      targetH3: gap.h3_8,
      rewardMinor: 300,
      maxRewardMinor: options.maxRewardMinor,
      dailyCap: options.dailyCap,
      missionsToday,
    });
    if (res.status === 'offered') {
      missionsToday += 1;
      const entry: { gapId: string; missionId?: string; score: number } = {
        gapId: gap.id,
        score: scored.score,
      };
      if (res.missionId) entry.missionId = res.missionId;
      commissioned.push(entry);
    } else {
      explained.push(`gap ${gap.id}: ${res.status}`);
    }
  }

  return { commissioned, explained };
}
