import { describe, expect, it } from 'vitest';
import { runPlannerEval } from '../../src/eval/plannerEval.js';
import { EVAL_CASES, FIXTURE_ROWS } from '../../src/eval/plannerSet.js';
import type { Inference, JsonRequest, JsonResult } from '../../src/inference/types.js';

/** Answers every planning prompt with the first two catalog refs, spaced,
 *  and every classification with "no category": a disciplined but dull
 *  model. Enough to exercise scoring end to end. */
class DullInference implements Inference {
  calls = 0;
  async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
    this.calls++;
    if (req.purpose !== 'plan') {
      return { raw: { category: null } as T, usage: { tokensIn: 20, tokensOut: 5 }, model: 'dull' };
    }
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

  it('runs the production pipeline: "right now" questions never reach the model', async () => {
    const dull = new DullInference();
    const s = await runPlannerEval({ places: FIXTURE_ROWS, inference: dull, model: 'dull' });
    expect(s.prompts).toBe(30);
    expect(s.schemaErrors).toBe(0);
    const arepas = s.results.find((r) => r.id === 'es-arepas')!;
    expect(arepas.outcome).toBe('plan');
    expect(arepas.path).toBe('fast');
    expect(arepas.pass).toBe(true);
    // "today" reads as a day plan, so the same category goes to the model
    const today = s.results.find((r) => r.id === 'en-eat-now')!;
    expect(today.path).toBe('model');
    expect(s.fastPath).toBeGreaterThan(0);
    expect(s.fastPath).toBeLessThan(s.plans);
  });

  it('scores the model path inside the single-topic filter, and refusals by expectation', async () => {
    const s = await runPlannerEval({ places: FIXTURE_ROWS, inference: new DullInference(), model: 'dull' });
    // A single-category day plan is planned over that category only, so
    // refs 1 and 2 are beaches here and the case passes.
    const beach = s.results.find((r) => r.id === 'es-playa-tarde')!;
    expect(beach.path).toBe('model');
    expect(beach.pass).toBe(true);
    expect(beach.offCategory).toBe(0);
    // The lexicon misses "sushi in Tokyo"; the classifier says "no category";
    // the pipeline refuses before any planning call, as the API does.
    const tokyo = s.results.find((r) => r.id === 'en-sushi-tokyo')!;
    expect(tokyo.outcome).toBe('refusal');
    expect(tokyo.path).toBe('intent');
    expect(tokyo.pass).toBe(true);
  });

  it('counts a model that ignores the schema as schema errors, never as passes', async () => {
    const s = await runPlannerEval({ places: FIXTURE_ROWS, inference: new SchemalessInference(), model: 'schemaless' });
    // The fast path and the lexicon are model-independent, so those plans
    // and refusals still land; every model plan is a schema error.
    expect(s.plans).toBe(s.fastPath);
    expect(s.schemaErrors).toBeGreaterThanOrEqual(5);
    expect(s.plans + s.refusals + s.schemaErrors).toBe(30);
  });
});
