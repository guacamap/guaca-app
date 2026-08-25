import type { Inference } from '../inference/types.js';
import type { PlaceRowForGuard } from '../guard/assertGrounded.js';
import { runGroundedPlanner } from '../planner/groundedPlanner.js';
import { EVAL_CASES, EVAL_SET, type EvalCase } from './plannerSet.js';

export interface EvalCaseResult {
  id: string;
  expect: EvalCase['expect'];
  outcome: 'plan' | 'refusal' | 'schema_error' | 'error';
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
  return /invalid JSON|schema|Required|invalid_type/i.test(message) ? 'schema_error' : 'error';
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

/**
 * Runs the standing eval set against a set of verified rows and a model.
 * A case passes when the outcome matches its expectation, and for a plan,
 * when every stop sits in an allowed category. Same rows, same prompts,
 * so two runs are comparable; that is the whole point of a benchmark.
 */
export async function runPlannerEval(options: {
  rows: readonly PlaceRowForGuard[];
  inference: Inference;
  model: string;
  cases?: readonly EvalCase[];
  onCase?: (result: EvalCaseResult) => void;
}): Promise<EvalSummary> {
  const cases = options.cases ?? EVAL_CASES;
  const { wrapped, usage } = metered(options.inference);
  const byId = new Map(options.rows.map((r) => [r.id, r]));
  const results: EvalCaseResult[] = [];

  for (const c of cases) {
    const t0 = Date.now();
    let res: EvalCaseResult;
    try {
      const outcome = await runGroundedPlanner({
        text: c.text, language: c.language, days: c.days, rows: options.rows, inference: wrapped, onGap: () => {},
      });
      const ms = Date.now() - t0;
      if (outcome.kind === 'PlanArtifact') {
        const stops = outcome.artifact.stops;
        const ids = [...outcome.placeIds];
        const off = c.categories.length
          ? ids.filter((id) => !c.categories.includes(byId.get(id)?.category ?? '')).length
          : 0;
        res = {
          id: c.id, expect: c.expect, outcome: 'plan', pass: c.expect === 'plan' && off === 0,
          reason: off ? `${off} stop(s) outside ${c.categories.join('/')}` : '',
          ms, stops: stops.length, distinctPlaces: new Set(ids).size,
          days: new Set(stops.map((s) => s.dayIndex ?? 0)).size, offCategory: off,
        };
      } else if (outcome.kind === 'RefusalArtifact') {
        res = { id: c.id, expect: c.expect, outcome: 'refusal', pass: c.expect === 'refuse', reason: outcome.reason, ms, stops: 0, distinctPlaces: 0, days: 0, offCategory: 0 };
      } else {
        const kind = classifyError(outcome.message);
        res = { id: c.id, expect: c.expect, outcome: kind, pass: false, reason: outcome.message.slice(0, 160), ms, stops: 0, distinctPlaces: 0, days: 0, offCategory: 0 };
      }
    } catch (err) {
      const message = String(err);
      res = { id: c.id, expect: c.expect, outcome: classifyError(message), pass: false, reason: message.slice(0, 160), ms: Date.now() - t0, stops: 0, distinctPlaces: 0, days: 0, offCategory: 0 };
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
