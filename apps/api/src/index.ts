import { pool, clusterUnanswered, expireMissions, recomputeZoneDemand } from '@guaca/db';
import { runGapAgent } from '@guaca/agents';
import { buildApp } from './app.js';
import { gapAgentOptions } from './gapAgentDeps.js';
import { runGapCycle, startGapScheduler } from './scheduler.js';
import { recomputeTrends } from './trendsService.js';
import { disabledWeatherProvider, openMeteoProvider } from './weather.js';

const app = buildApp({ pool });
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
        sha: process.env.GIT_SHA ?? null,
        gapAgent: gapEnabled
          ? `every ${gapIntervalMs}ms${gapDryRun ? ' (dry-run)' : ''}`
          : 'disabled',
      },
    }),
  );
});
