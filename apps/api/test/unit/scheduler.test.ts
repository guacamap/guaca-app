import { describe, expect, it, vi } from 'vitest';
import { runGapCycle, startGapScheduler } from '../../src/scheduler.ts';

function deps(overrides: Partial<Parameters<typeof runGapCycle>[0]> = {}) {
  return {
    cluster: async () => ({ gapsCreated: 1, questionsClustered: 3 }),
    runAgent: async () => ({
      commissioned: [{ gapId: 'g1', missionId: 'm1', score: 288 }],
      explained: ['gap g1: commissioned'],
    }),
    ...overrides,
  };
}

describe('runGapCycle — cluster then commission', () => {
  it('clusters unanswered questions before running the agent', async () => {
    const order: string[] = [];
    const result = await runGapCycle(
      deps({
        cluster: async () => {
          order.push('cluster');
          return { gapsCreated: 1, questionsClustered: 3 };
        },
        runAgent: async () => {
          order.push('agent');
          return { commissioned: [], explained: [] };
        },
      }),
    );
    // Order matters: a question refused thirty seconds ago must be clustered
    // into a gap before the agent looks for gaps, or the loop lags a full cycle.
    expect(order).toEqual(['cluster', 'agent']);
    expect(result.questionsClustered).toBe(3);
  });

  it('broadcasts an event per commissioned mission for the ops stream', async () => {
    const events: object[] = [];
    await runGapCycle(deps({ broadcast: (e) => events.push(e) }));
    const kinds = events.map((e) => (e as { event: string }).event);
    expect(kinds).toContain('gap.cycle.complete');
    expect(kinds).toContain('gap.mission.commissioned');
  });

  it('a broadcast failure never breaks the cycle', async () => {
    const result = await runGapCycle(
      deps({
        broadcast: () => {
          throw new Error('ws client vanished');
        },
      }),
    );
    expect(result.commissioned).toHaveLength(1);
  });

  it('surfaces the agent explanation so `guaca tail` can show the reasoning', async () => {
    const result = await runGapCycle(deps());
    expect(result.explained).toContain('gap g1: commissioned');
  });
});

describe('startGapScheduler — the kill switch and the timer', () => {
  it('does not run at all when GAP_AGENT_ENABLED is false', async () => {
    vi.useFakeTimers();
    let runs = 0;
    const handle = startGapScheduler({
      enabled: false,
      intervalMs: 1000,
      cycle: async () => {
        runs++;
      },
    });
    await vi.advanceTimersByTimeAsync(5000);
    handle.stop();
    vi.useRealTimers();
    expect(runs).toBe(0);
  });

  it('runs on the interval while enabled, and stops cleanly', async () => {
    vi.useFakeTimers();
    let runs = 0;
    const handle = startGapScheduler({
      enabled: true,
      intervalMs: 1000,
      cycle: async () => {
        runs++;
      },
    });
    await vi.advanceTimersByTimeAsync(3500);
    expect(runs).toBe(3);

    handle.stop();
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();
    // No dangling timer after stop().
    expect(runs).toBe(3);
  });

  it('a throwing cycle does not kill the scheduler', async () => {
    vi.useFakeTimers();
    let runs = 0;
    const errors: unknown[] = [];
    const handle = startGapScheduler({
      enabled: true,
      intervalMs: 1000,
      cycle: async () => {
        runs++;
        throw new Error('db down');
      },
      onError: (err) => {
        errors.push(err);
      },
    });
    await vi.advanceTimersByTimeAsync(3500);
    handle.stop();
    vi.useRealTimers();
    // Still ticking despite every run failing — a transient DB outage must not
    // silently stop the autonomy claim for the rest of the process's life.
    expect(runs).toBe(3);
    expect(errors).toHaveLength(3);
  });
});
