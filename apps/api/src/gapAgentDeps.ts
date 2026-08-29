import type { Pool } from 'pg';
import {
  clusterUnanswered,
  commissionMission,
  loadGapSignals,
  listSpotterCandidates,
  rankedGaps,
} from '@guaca/db';
import { composeBrief, scoreGap, selectSpotter, type GapAgentOptions, type GapRow } from '@guaca/agents';

/**
 * The gap agent's real dependencies, in one place: the scheduler runs it
 * over every ranked gap on a timer, and a tourist can run it for the one
 * gap their question opened. Both must spend from the same budget, pick
 * spotters the same way and write the same brief, so both build the
 * options here.
 */
export function gapAgentOptions(
  pool: Pool,
  opts: {
    areaId: string;
    dryRun: boolean;
    /** Restrict the run to these gaps (a tourist's request); default: all ranked gaps. */
    listGaps?: (areaId: string) => Promise<GapRow[]>;
    /** Score floor; a tourist asking outright lowers it to zero. */
    minScore?: number;
    /** A traveller's explicit request: demand-volume gates do not apply. */
    explicit?: boolean;
  },
): GapAgentOptions {
  return {
    areaId: opts.areaId,
    dryRun: opts.dryRun,
    minScore: opts.minScore ?? Number(process.env.GAP_AGENT_MIN_SCORE ?? 45),
    maxRewardMinor: Number(process.env.GAP_AGENT_MAX_REWARD_MINOR ?? 500),
    dailyCap: Number(process.env.GAP_AGENT_MAX_MISSIONS_PER_DAY ?? 5),
    ...(opts.explicit ? { explicit: true } : {}),
    listGaps:
      opts.listGaps ??
      (async (areaId) =>
        (await rankedGaps(pool, areaId)).map((g) => ({
          id: g.id,
          category: g.category,
          h3_8: g.h3_8,
          questionCount: g.questionCount,
          distinctSessionCount: g.distinctSessionCount,
        }))),
    countMissionsToday: async () => {
      const r = await pool.query<{ n: number }>(
        `select count(*)::int as n from missions where offered_at >= date_trunc('day', now())`,
      );
      return r.rows[0]?.n ?? 0;
    },
    // Real signals: existing coverage suppresses spending, paying
    // properties weight the score, and the zone name keeps briefs
    // human. Stubs here would make all three inert.
    loadSignals: (gap) =>
      loadGapSignals(pool, {
        id: gap.id,
        category: gap.category,
        h3_8: gap.h3_8,
        areaId: opts.areaId,
      }),
    listSpotters: (zoneId) => listSpotterCandidates(pool, zoneId),
    score: scoreGap,
    selectSpotter: async (candidates, zoneId) => selectSpotter(candidates, zoneId),
    composeBrief,
    persistScore: async (gapId, score) => {
      await pool.query(`update gaps set score = $2, updated_at = now() where id = $1`, [gapId, score]);
    },
    commission: (args) =>
      commissionMission(pool, {
        ...args,
        currency: 'USD',
        expiresInHours: Number(process.env.MISSION_EXPIRY_HOURS ?? 48),
      }),
  };
}

/** Clustering is idempotent; exported so a single-question run can call it first. */
export { clusterUnanswered };
