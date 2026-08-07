import { describe, expect, it } from 'vitest';
import {
  InterruptSignal,
  Runner,
  type Node,
  type NodeState,
} from '../../src/runtime/runner.ts';

interface VState extends NodeState {
  placeId: string;
  spotterId?: string;
  visionCalls: number;
  secondLocal?: string;
}

function makeNodes(opts: { onVision: () => void }) {
  const visionVerify: Node<VState> = {
    name: 'visionVerify',
    run: async (state) => {
      opts.onVision();
      return { visionCalls: state.visionCalls + 1 };
    },
  };
  const requestSecondLocal: Node<VState> = {
    name: 'requestSecondLocal',
    run: async (state) => {
      // Human-in-the-loop: pause until a different spotter confirms.
      const confirmed = state.resumeValues?.['requestSecondLocal'] as
        | { spotterId: string }
        | undefined;
      if (!confirmed) {
        throw new InterruptSignal('requestSecondLocal', {
          placeId: state.placeId,
        });
      }
      if (confirmed.spotterId === state.spotterId) {
        throw new Error('self-confirmation rejected: different spotter required');
      }
      return { secondLocal: confirmed.spotterId };
    },
  };
  const finalize: Node<VState> = {
    name: 'finalize',
    run: async (state) => state,
  };
  return { visionVerify, requestSecondLocal, finalize };
}

describe('plain-TS runner with interrupts (§7.7)', () => {
  it('resume re-runs ONLY the interrupting node — vision is not re-paid', async () => {
    let visionCalls = 0;
    const { visionVerify, requestSecondLocal, finalize } = makeNodes({
      onVision: () => visionCalls++,
    });

    const runner = new Runner<VState>({
      nodes: [visionVerify, requestSecondLocal, finalize],
    });

    const state: VState = {
      placeId: 'p1',
      visionCalls: 0,
    };

    // First run: vision runs once, then the second-local node interrupts.
    let interrupted: InterruptSignal | null = null;
    try {
      await runner.run(state);
    } catch (e) {
      if (e instanceof InterruptSignal) interrupted = e;
      else throw e;
    }
    expect(interrupted).not.toBeNull();
    expect(interrupted!.node).toBe('requestSecondLocal');
    expect(visionCalls).toBe(1);

    // Resume: the interrupting node re-runs from the top — but visionVerify
    // must NOT re-run. Exactly one vision call across the whole cycle.
    const resumed = await runner.resume(state, {
      requestSecondLocal: { spotterId: 'spotter-2' },
    });
    expect(visionCalls).toBe(1);
    expect(resumed.secondLocal).toBe('spotter-2');
  });

  it('self-confirmation is rejected (different spotter required)', async () => {
    const { visionVerify, requestSecondLocal, finalize } = makeNodes({
      onVision: () => undefined,
    });
    const runner = new Runner<VState>({
      nodes: [visionVerify, requestSecondLocal, finalize],
    });
    const state: VState = { placeId: 'p1', visionCalls: 0, spotterId: 's1' };
    await expect(
      runner.resume(state, { requestSecondLocal: { spotterId: 's1' } }),
    ).rejects.toThrow(/different spotter/i);
  });

  it('every write past an interrupt is idempotency-keyed (one payout row)', async () => {
    const payouts: string[] = [];
    const { visionVerify, requestSecondLocal, finalize } = makeNodes({
      onVision: () => undefined,
    });
    const payNode: Node<VState> = {
      name: 'pay',
      run: async (state) => {
        // Idempotency key = missionId; re-running past the interrupt cannot
        // double-write.
        const key = state.placeId;
        if (!payouts.includes(key)) payouts.push(key);
        return state;
      },
    };
    const runner = new Runner<VState>({
      nodes: [visionVerify, requestSecondLocal, payNode],
    });
    const state: VState = { placeId: 'p1', visionCalls: 0 };

    let interrupted: InterruptSignal | null = null;
    try {
      await runner.run(state);
    } catch (e) {
      if (e instanceof InterruptSignal) interrupted = e;
      else throw e;
    }
    expect(interrupted).not.toBeNull();

    // Two resume attempts (e.g. operator retries) — still exactly one payout.
    await runner.resume(state, { requestSecondLocal: { spotterId: 's2' } });
    await runner.resume(state, { requestSecondLocal: { spotterId: 's2' } });
    expect(payouts).toHaveLength(1);
  });
});
