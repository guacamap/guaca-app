import { pool, clusterUnanswered, expireMissions, recomputeZoneDemand } from '@guaca/db';
import { runGapAgent } from '@guaca/agents';
import { routerFromEnv } from './routing.js';
import { buildApp } from './app.js';
import { gapAgentOptions } from './gapAgentDeps.js';
import { disabledContextProvider, liveContextProvider } from './context.js';
import { runGapCycle, startGapScheduler } from './scheduler.js';
import { runTravellerTick } from './travellerTick.js';
import { recomputeTrends } from './trendsService.js';
import { disabledWeatherProvider, openMeteoProvider } from './weather.js';

const contextProvider = (process.env.WEATHER_ENABLED ?? 'true') !== 'false' ? liveContextProvider() : disabledContextProvider();
const router = routerFromEnv();
const app = buildApp({ pool, contextProvider, router });
const port = Number(process.env.API_PORT ?? 3001);

const AREA_ID =
  process.env.PILOT_AREA_ID ?? '00000000-0000-4000-8000-00000000000a';

const gapEnabled = (process.env.GAP_AGENT_ENABLED ?? 'true') !== 'false';
const gapIntervalMs = Number(process.env.GAP_AGENT_INTERVAL_MS ?? 300_000);
const gapDryRun = process.env.GAP_AGENT_DRY_RUN === 'true';
const weatherEnabled = (process.env.WEATHER_ENABLED ?? 'true') !== 'false';

const weather = weatherEnabled
  ? openMeteoProvider({
      ...(process.env.WEATHER_BASE_URL
        ? { baseUrl: process.env.WEATHER_BASE_URL }
        : {}),
    })
  : disabledWeatherProvider();

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
      recomputeTrends: () =>
        recomputeTrends(pool, { areaId: AREA_ID, weather }),
      expireMissions: () => expireMissions(pool),
      cluster: () => clusterUnanswered(pool, AREA_ID),
      // People-per-zone snapshot AFTER clustering: this tick's refusals
      // are already in the counts surfaces read.
      recomputeZoneDemand: () => recomputeZoneDemand(pool, AREA_ID),
      runAgent: () => runGapAgent(gapAgentOptions(pool, { areaId: AREA_ID, dryRun: gapDryRun })),
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

/**
 * Guaca speaking first: every TRAVELLER_TICK_MS (15 min) each recent
 * traveller is looked at against the rain, the storms, the morning and the
 * evening. Kill switch TRAVELLER_TICK_ENABLED. Same inference as the routes.
 */
const tickEnabled = (process.env.TRAVELLER_TICK_ENABLED ?? 'true') !== 'false';
const tickMs = Number(process.env.TRAVELLER_TICK_MS ?? 15 * 60_000);
const tick = startGapScheduler({
  enabled: tickEnabled,
  intervalMs: tickMs,
  cycle: async () => {
    const inference = await (app as unknown as { resolveInference: () => Promise<import('@guaca/agents').Inference> }).resolveInference();
    const r = await runTravellerTick({ pool, inference, contextProvider, router, minCandidates: Number(process.env.PLANNER_MIN_CANDIDATES ?? 3) });
    if (r.spoke.length > 0) console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'traveller_tick.spoke', detail: r }));
  },
  onError: (err) => console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'traveller_tick.failed', detail: { error: String(err) } })),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    scheduler.stop();
    tick.stop();
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
        sha: process.env.GIT_SHA ?? null,
        gapAgent: gapEnabled
          ? `every ${gapIntervalMs}ms${gapDryRun ? ' (dry-run)' : ''}`
          : 'disabled',
      },
    }),
  );
});
