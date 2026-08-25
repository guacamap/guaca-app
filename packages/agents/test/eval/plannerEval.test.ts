import { describe, expect, it } from 'vitest';
import { runPlannerEval } from '../../src/eval/plannerEval.js';
import { EVAL_CASES, FIXTURE_ROWS } from '../../src/eval/plannerSet.js';
import type { Inference, JsonRequest, JsonResult } from '../../src/inference/types.js';

/** Answers every prompt with the first two catalog refs on day 0: a
 *  disciplined but dull model. Enough to exercise scoring end to end. */
class DullInference implements Inference {
  async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
    return {
      raw: { stops: [
        { ref: 1, dayIndex: 0, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' },
        { ref: 2, dayIndex: 0, startMin: 720, durationMin: 60, reasonCode: 'SEQUENCE_FIT' },
      ], languageCode: /es/.test(req.user) ? 'es' : 'en' } as T,
      usage: { tokensIn: 50, tokensOut: 20 }, model: 'dull',
    };
  }
  async vision<T>(): Promise<JsonResult<T>> { throw new Error('unused'); }
}

/** Never returns a stops array: the failure mode two real models showed. */
class SchemalessInference implements Inference {
  async json<T>(): Promise<JsonResult<T>> { throw new Error('inference returned invalid JSON after repair: stops Required'); }
  async vision<T>(): Promise<JsonResult<T>> { throw new Error('unused'); }
}

describe('planner eval set', () => {
  it('has thirty cases, half Spanish, with both expectations represented', () => {
    expect(EVAL_CASES).toHaveLength(30);
    expect(EVAL_CASES.filter((c) => c.language === 'es').length).toBeGreaterThanOrEqual(13);
    expect(EVAL_CASES.filter((c) => c.expect === 'refuse').length).toBeGreaterThanOrEqual(4);
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(30);
  });

  it('scores a disciplined model: plans pass only inside allowed categories', async () => {
    const s = await runPlannerEval({ rows: FIXTURE_ROWS, inference: new DullInference(), model: 'dull' });
    expect(s.prompts).toBe(30);
    expect(s.schemaErrors).toBe(0);
    expect(s.tokensIn).toBe(30 * 50);
    // refs 1 and 2 are eat_drink: eat prompts pass, beach-only prompts fail on category
    const eat = s.results.find((r) => r.id === 'en-eat-now')!;
    const beach = s.results.find((r) => r.id === 'es-playa-tarde')!;
    expect(eat.pass).toBe(true);
    expect(beach.pass).toBe(false);
    expect(beach.offCategory).toBe(2);
    // a 'refuse' case answered with a plan is a failure
    const tokyo = s.results.find((r) => r.id === 'en-sushi-tokyo')!;
    expect(tokyo.outcome === 'plan' ? tokyo.pass : true).toBe(false);
  });

  it('counts a model that ignores the schema as schema errors, never as passes', async () => {
    const s = await runPlannerEval({ rows: FIXTURE_ROWS, inference: new SchemalessInference(), model: 'schemaless' });
    expect(s.schemaErrors).toBe(30);
    expect(s.passes).toBe(0);
    expect(s.plans).toBe(0);
  });
});
