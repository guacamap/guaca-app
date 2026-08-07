export interface GapCycleDeps {
  /** Fold newly-refused questions into (area, category, h3) gaps. */
  cluster: () => Promise<{ gapsCreated: number; questionsClustered: number }>;
  /** Score the gaps and commission at most one mission. */
  runAgent: () => Promise<{
    commissioned: Array<{ gapId: string; missionId?: string; score: number }>;
    explained: string[];
  }>;
  /** Ops WebSocket broadcast — best-effort, never load-bearing. */
  broadcast?: (event: object) => void;
}

export interface GapCycleResult {
  gapsCreated: number;
  questionsClustered: number;
  commissioned: Array<{ gapId: string; missionId?: string; score: number }>;
  explained: string[];
}

/**
 * One turn of the autonomy loop: cluster the refusals that have accumulated
 * since the last turn, then let the gap agent score them and commission at
 * most one mission.
 *
 * Clustering MUST precede the agent. A question refused seconds ago is only a
 * demand signal once it has been folded into a gap; running the agent first
 * would make every refusal wait a full interval before it could be acted on,
 * which is exactly the latency a live demo cannot afford.
 */
export async function runGapCycle(deps: GapCycleDeps): Promise<GapCycleResult> {
  const emit = (event: object): void => {
    if (!deps.broadcast) return;
    try {
      deps.broadcast(event);
    } catch {
      // A dead WebSocket client must never abort the loop.
    }
  };

  const clustered = await deps.cluster();
  const agent = await deps.runAgent();

  for (const m of agent.commissioned) {
    emit({
      ts: new Date().toISOString(),
      level: 'info',
      event: 'gap.mission.commissioned',
      agent: 'gap',
      subject: { type: 'mission', id: m.missionId ?? m.gapId },
      detail: { gapId: m.gapId, score: m.score },
    });
  }

  emit({
    ts: new Date().toISOString(),
    level: 'info',
    event: 'gap.cycle.complete',
    agent: 'gap',
    tokens_in: 0,
    tokens_out: 0,
    detail: {
      gapsCreated: clustered.gapsCreated,
      questionsClustered: clustered.questionsClustered,
      commissioned: agent.commissioned.length,
      explained: agent.explained,
    },
  });

  return {
    gapsCreated: clustered.gapsCreated,
    questionsClustered: clustered.questionsClustered,
    commissioned: agent.commissioned,
    explained: agent.explained,
  };
}

export interface SchedulerOptions {
  /** GAP_AGENT_ENABLED — the kill switch. False means never fire. */
  enabled: boolean;
  /** GAP_AGENT_INTERVAL_MS. */
  intervalMs: number;
  cycle: () => Promise<unknown>;
  onError?: (err: unknown) => void;
}

export interface SchedulerHandle {
  stop(): void;
}

/**
 * The scheduler layer that owns the GAP_AGENT_ENABLED kill switch. Without
 * this, `runGapAgent` is a function nobody calls — the agent is only
 * autonomous if something makes it tick.
 *
 * A failing cycle is logged and skipped, never fatal: a transient database
 * outage must not silently end the autonomy claim for the life of the process.
 */
export function startGapScheduler(options: SchedulerOptions): SchedulerHandle {
  if (!options.enabled) {
    return { stop: () => undefined };
  }

  let running = false;
  const timer = setInterval(() => {
    // Skip a tick rather than overlap if the previous cycle is still going.
    if (running) return;
    running = true;
    void options
      .cycle()
      .catch((err) => {
        if (options.onError) options.onError(err);
        else console.error('[gap-scheduler] cycle failed', err);
      })
      .finally(() => {
        running = false;
      });
  }, options.intervalMs);

  // Never hold the process open on the scheduler alone.
  if (typeof timer.unref === 'function') timer.unref();

  return {
    stop: () => clearInterval(timer),
  };
}
