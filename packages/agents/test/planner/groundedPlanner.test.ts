import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  runGroundedPlanner,
  type GroundedPlannerOptions,
} from '../../src/planner/groundedPlanner.ts';
import { FakeInference } from '../../src/inference/fake.ts';
import type { Inference, JsonResult, JsonRequest } from '../../src/inference/types.ts';

const P1 = '00000000-0000-4000-8000-000000000001';
const P2 = '00000000-0000-4000-8000-000000000002';

const rows = [
  { id: P1, name: 'Arepera La Guacamaya', category: 'eat_drink', verificationStatus: 'verified', witnessCount: 2 },
  { id: P2, name: 'Café El Puerto', category: 'eat_drink', verificationStatus: 'verified', witnessCount: 2 },
];

/** A hostile provider that emits an out-of-catalog ref. */
class HostileInference implements Inference {
  calls = 0;
  async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
    this.calls++;
    return {
      raw: {
        stops: [{ ref: 999, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' }],
        languageCode: 'en',
      } as T,
      usage: { tokensIn: 10, tokensOut: 10 },
      model: 'hostile',
    };
  }
  async vision<T>(): Promise<JsonResult<T>> {
    throw new Error('not used');
  }
}

function options(overrides: Partial<GroundedPlannerOptions> = {}): GroundedPlannerOptions {
  return {
    text: 'where can I eat arepas now?',
    language: 'en',
    rows,
    inference: new FakeInference({}),
    onGap: async () => undefined,
    ...overrides,
  };
}

describe('T4.5 — guard wired into the planner', () => {
  it('a GuardViolation produces a RefusalArtifact and a gap row, never a degraded answer', async () => {
    const gaps: string[] = [];
    const outcome = await runGroundedPlanner(
      options({
        inference: new HostileInference(),
        onGap: async (reason) => {
          gaps.push(reason);
        },
      }),
    );

    expect(outcome.kind).toBe('RefusalArtifact');
    if (outcome.kind !== 'RefusalArtifact') throw new Error('expected a refusal');
    expect(outcome.reason).toBe('GUARD_VIOLATION:UNKNOWN_REF');
    // The gap was logged — the demand signal is preserved.
    expect(gaps).toContain('UNKNOWN_REF');
  });

  it('the catalog refEnum is passed into the request schema (refs only, never UUIDs)', async () => {
    let seenSchema: unknown;
    const capturing: Inference = {
      async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
        seenSchema = req.schema;
        return {
          raw: {
            stops: [{ ref: 1, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' }],
            languageCode: 'en',
          } as T,
          usage: { tokensIn: 5, tokensOut: 5 },
          model: 'capture',
        };
      },
      async vision<T>(): Promise<JsonResult<T>> {
        throw new Error('not used');
      },
    };
    await runGroundedPlanner(options({ inference: capturing }));

    // The schema passed to the model constrains ref to the catalog's
    // integer enum (1..N) — and never contains a placeId UUID.
    const schemaJson = JSON.stringify(seenSchema);
    expect(schemaJson).toContain('1');
    expect(schemaJson).not.toContain(P1);
    expect(schemaJson).not.toContain(P2);

  });

  it('a clean response becomes a grounded PlanArtifact', async () => {
    const clean: Inference = {
      async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
        return {
          raw: {
            stops: [
              { ref: 1, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' },
              { ref: 2, startMin: 700, durationMin: 60, reasonCode: 'NEAREST' },
            ],
            languageCode: 'en',
          } as T,
          usage: { tokensIn: 5, tokensOut: 5 },
          model: 'clean',
        };
      },
      async vision<T>(): Promise<JsonResult<T>> {
        throw new Error('not used');
      },
    };
    const outcome = await runGroundedPlanner(options({ inference: clean }));
    expect(outcome.kind).toBe('PlanArtifact');
    if (outcome.kind === 'PlanArtifact') {
      expect(outcome.placeIds).toEqual([P1, P2]);
    }
  });
});
