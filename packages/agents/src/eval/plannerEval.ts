import type { Inference } from '../inference/types.js';
import { answerFromCatalog, type CatalogPlace } from '../planner/pipeline.js';
import { EVAL_CASES, EVAL_SET, FIXTURE_ORIGIN, type EvalCase } from './plannerSet.js';

export interface EvalCaseResult {
  id: string;
  expect: EvalCase['expect'];
  outcome: 'plan' | 'refusal' | 'schema_error' | 'error';
  /** Which stage produced the outcome: the fast path costs no inference. */
  path: 'fast' | 'model' | 'intent' | 'coverage';
  pass: boolean;
  reason: string;
  ms: number;
  stops: number;
  distinctPlaces: number;
  days: number;
  offCategory: number;
}

export interface EvalSummary {
  evalSet: string;
  model: string;
  prompts: number;
  passes: number;
  plans: number;
  /** Plans the deterministic fast path answered without the model. */
  fastPath: number;
  refusals: number;
  schemaErrors: number;
  errors: number;
  avgMs: number;
  p95Ms: number;
  tokensIn: number;
  tokensOut: number;
  results: EvalCaseResult[];
}

function classifyError(message: string): 'schema_error' | 'error' {
  return /invalid JSON|schema|Required|invalid_type|unparseable/i.test(message) ? 'schema_error' : 'error';
}

/** Wraps an Inference so the eval can count tokens per call. */
function metered(inner: Inference) {
  const usage = { tokensIn: 0, tokensOut: 0 };
  const wrapped: Inference = {
    async json(req) { const r = await inner.json(req); usage.tokensIn += r.usage.tokensIn; usage.tokensOut += r.usage.tokensOut; return r; },
    async vision(req) { const r = await inner.vision(req); usage.tokensIn += r.usage.tokensIn; usage.tokensOut += r.usage.tokensOut; return r; },
  };
  return { wrapped, usage };
}

/** Eleven in the morning: the fast path plans from "now", and a benchmark
 *  must not change its answer with the time of day it happens to run. */
const EVAL_NOW_MIN = 11 * 60;

/**
 * Runs the standing eval set through the SAME pipeline the API serves
 * (answerFromCatalog), on a fixed catalog and a fixed clock. A case passes
 * when the outcome matches its expectation and, for a plan, every stop sits
 * in an allowed category. Same rows, same prompts, same code as production:
 * that is what makes two runs comparable, and the score honest.
 */
export async function runPlannerEval(options: {
  places: readonly CatalogPlace[];
  inference: Inference;
  model: string;
  minCandidates?: number;
  /** Where the traveller stands. Defaults to the fixture's Puerto Cabello centre. */
  origin?: { lat: number; lon: number };
  cases?: readonly EvalCase[];
  onCase?: (result: EvalCaseResult) => void;
}): Promise<EvalSummary> {
  const cases = options.cases ?? EVAL_CASES;
  const { wrapped, usage } = metered(options.inference);
  const byId = new Map(options.places.map((r) => [r.id, r]));
  const results: EvalCaseResult[] = [];
  const empty = { stops: 0, distinctPlaces: 0, days: 0, offCategory: 0 };

  for (const c of cases) {
    const t0 = Date.now();
    let res: EvalCaseResult;
    try {
      const outcome = await answerFromCatalog({
        text: c.text, language: c.language, days: c.days,
        lat: (options.origin ?? FIXTURE_ORIGIN).lat, lon: (options.origin ?? FIXTURE_ORIGIN).lon,
        places: options.places, inference: wrapped,
        minCandidates: options.minCandidates ?? 3, nowMin: EVAL_NOW_MIN,
      });
      const ms = Date.now() - t0;
      if (outcome.kind === 'answer') {
        const stops = outcome.artifact.stops;
        const ids = outcome.placeIds;
        const off = c.categories.length
          ? ids.filter((id) => !c.categories.includes(byId.get(id)?.category ?? '')).length
          : 0;
        res = {
          id: c.id, expect: c.expect, outcome: 'plan', path: outcome.path,
          pass: c.expect === 'plan' && off === 0,
          reason: off ? `${off} stop(s) outside ${c.categories.join('/')}` : c.expect === 'refuse' ? 'should have refused' : '',
          ms, stops: stops.length, distinctPlaces: new Set(ids).size,
          days: new Set(stops.map((s) => s.dayIndex ?? 0)).size, offCategory: off,
        };
      } else if (outcome.reason === 'PLANNER_ERROR') {
        const message = outcome.detail ?? outcome.reason;
        res = { id: c.id, expect: c.expect, outcome: classifyError(message), path: outcome.stage, pass: false, reason: message.slice(0, 160), ms, ...empty };
      } else {
        res = { id: c.id, expect: c.expect, outcome: 'refusal', path: outcome.stage, pass: c.expect === 'refuse', reason: outcome.reason, ms, ...empty };
      }
    } catch (err) {
      const message = String(err);
      res = { id: c.id, expect: c.expect, outcome: classifyError(message), path: 'model', pass: false, reason: message.slice(0, 160), ms: Date.now() - t0, ...empty };
    }
    results.push(res);
    options.onCase?.(res);
  }

  const lat = results.map((r) => r.ms).sort((a, b) => a - b);
  const p95 = lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] ?? 0;
  return {
    evalSet: EVAL_SET,
    model: options.model,
    prompts: results.length,
    passes: results.filter((r) => r.pass).length,
    plans: results.filter((r) => r.outcome === 'plan').length,
    fastPath: results.filter((r) => r.outcome === 'plan' && r.path === 'fast').length,
    refusals: results.filter((r) => r.outcome === 'refusal').length,
    schemaErrors: results.filter((r) => r.outcome === 'schema_error').length,
    errors: results.filter((r) => r.outcome === 'error').length,
    avgMs: Math.round(lat.reduce((a, b) => a + b, 0) / Math.max(1, lat.length)),
    p95Ms: p95,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    results,
  };
}
