import {
  pool,
  clusterUnanswered,
  rankedGaps,
  commissionMission,
  loadGapSignals,
  listSpotterCandidates,
} from '@guaca/db';
import {
  runGapAgent,
  scoreGap,
  selectSpotter,
  composeBrief,
} from '@guaca/agents';
import { buildApp } from './app.js';
import { runGapCycle, startGapScheduler } from './scheduler.js';

const app = buildApp({ pool });
const port = Number(process.env.API_PORT ?? 3001);

const AREA_ID =
  process.env.PILOT_AREA_ID ?? '00000000-0000-4000-8000-00000000000a';

const gapEnabled = (process.env.GAP_AGENT_ENABLED ?? 'true') !== 'false';
const gapIntervalMs = Number(process.env.GAP_AGENT_INTERVAL_MS ?? 300_000);
const gapDryRun = process.env.GAP_AGENT_DRY_RUN === 'true';

/**
 * The autonomy loop. Without this the gap agent is a function nobody calls:
 * a tourist's refusal is recorded, but nothing ever turns it into a mission.
 * The kill switch is GAP_AGENT_ENABLED.
 */
const scheduler = startGapScheduler({
  enabled: gapEnabled,
  intervalMs: gapIntervalMs,
  cycle: () =>
    runGapCycle({
      cluster: () => clusterUnanswered(pool, AREA_ID),
      runAgent: () =>
        runGapAgent({
          areaId: AREA_ID,
          dryRun: gapDryRun,
          minScore: Number(process.env.GAP_AGENT_MIN_SCORE ?? 45),
          maxRewardMinor: Number(process.env.GAP_AGENT_MAX_REWARD_MINOR ?? 500),
          dailyCap: Number(process.env.GAP_AGENT_MAX_MISSIONS_PER_DAY ?? 5),
          listGaps: async (areaId) =>
            (await rankedGaps(pool, areaId)).map((g) => ({
              id: g.id,
              category: g.category,
              h3_8: g.h3_8,
              questionCount: g.questionCount,
              distinctSessionCount: g.distinctSessionCount,
            })),
          countMissionsToday: async () => {
            const r = await pool.query<{ n: number }>(
              `select count(*)::int as n from missions where offered_at >= date_trunc('day', now())`,
            );
            return r.rows[0]?.n ?? 0;
          },
          // Real signals: existing coverage suppresses spending, and paying
          // properties weight the score. Stubs here would make both inert.
          loadSignals: (gap) =>
            loadGapSignals(pool, {
              id: gap.id,
              category: gap.category,
              h3_8: gap.h3_8,
            }),
          listSpotters: (zoneId) => listSpotterCandidates(pool, zoneId),
          score: scoreGap,
          selectSpotter: async (candidates, zoneId) =>
            selectSpotter(candidates, zoneId),
          composeBrief,
          commission: (args) =>
            commissionMission(pool, {
              ...args,
              currency: 'USD',
              expiresInHours: Number(process.env.MISSION_EXPIRY_HOURS ?? 48),
            }),
        }),
      broadcast: (event) => {
        const broadcaster = app as unknown as {
          broadcastAgentEvent?: (e: object) => void;
        };
        broadcaster.broadcastAgentEvent?.(event);
        // Structured log line — this is what `guaca tail` follows.
        console.log(JSON.stringify(event));
      },
    }),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    scheduler.stop();
    void app.close().then(() => process.exit(0));
  });
}

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      event: 'api.started',
      agent: 'system',
      detail: {
        port,
        gapAgent: gapEnabled
          ? `every ${gapIntervalMs}ms${gapDryRun ? ' (dry-run)' : ''}`
          : 'disabled',
      },
    }),
  );
});
