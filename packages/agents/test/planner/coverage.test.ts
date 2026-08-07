import { describe, expect, it } from 'vitest';
import {
  runPlanner,
  type PlannerInput,
  type PlannerOutcome,
} from '../../src/planner/planner.ts';
import { FakeInference } from '../../src/inference/fake.ts';
import type { Inference } from '../../src/inference/types.ts';

const AREA_ID = '00000000-0000-4000-8000-00000000000a';

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    text: 'where can I eat arepas near the fort?',
    language: 'en',
    areaId: AREA_ID,
    lat: 10.4716,
    lon: -68.0056,
    ...overrides,
  };
}

function fake(records: Record<string, unknown> = {}): Inference {
  return new FakeInference(records);
}

/** A planner wired to a db that returns zero verified places in the area. */
function emptyDb() {
  return {
    findVerifiedNear: async () => [],
  };
}

/** A planner wired to a db with enough verified places. */
function fullDb(n = 4) {
  const places = Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000000${(i + 1).toString().padStart(3, '0')}`,
    name: `Place ${i + 1}`,
    category: 'eat_drink',
    landmarkDescription: 'Casa amarilla',
    lat: 10.4716 + i * 0.0005,
    lon: -68.0056,
  }));
  return {
    findVerifiedNear: async () => places,
  };
}

describe('T4.3 — coverage check runs BEFORE any LLM call', () => {
  it('insufficient candidates → deterministic refusal with ZERO inference calls', async () => {
    const inference = fake();
    const calls = () => (inference as unknown as { calls: unknown[] }).calls;

    const outcome = await runPlanner({
      input: input(),
      db: emptyDb(),
      inference,
      minCandidates: 3,
    });

    expect(outcome.kind).toBe('RefusalArtifact');
    if (outcome.kind !== 'RefusalArtifact') throw new Error('expected a refusal');
    expect(outcome.reason).toBe('INSUFFICIENT_COVERAGE');
    // The compute-efficiency proof: the refusal path never touched the model.
    expect(calls()).toHaveLength(0);
  });

  it('sufficient candidates proceed to the model path', async () => {
    const inference = fake();
    const outcome = await runPlanner({
      input: input(),
      db: fullDb(),
      inference,
      minCandidates: 3,
    });
    // With a fake that has no fixtures, the model path throws Missing fixture —
    // proving it DID attempt the model call (coverage passed).
    expect(outcome.kind).toBe('error');
  });
});
