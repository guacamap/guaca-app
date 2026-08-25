import type { Pool } from 'pg';
import type { Inference, JsonRequest, JsonResult, VisionRequest } from '@guaca/agents';

type ErrorKind = 'schema' | 'timeout' | 'http' | 'budget' | 'other';

function classify(err: unknown): ErrorKind {
  const m = String(err);
  if (/invalid JSON|schema|invalid_type|Required/i.test(m)) return 'schema';
  if (/timeout|timed out|aborted/i.test(m)) return 'timeout';
  if (/budget/i.test(m)) return 'budget';
  if (/HTTP|status \d{3}|fetch failed|ECONN/i.test(m)) return 'http';
  return 'other';
}

/**
 * Sits between the agents and the provider and writes one ai_calls row per
 * call: purpose, model, latency, tokens, and on failure the kind of failure
 * (schema vs timeout vs http) so a regression is visible as a rate, not a
 * hunch. The agents do not know it exists; the request already carries a
 * purpose, and that is the tag. Recording never throws into the caller.
 */
export function recordingInference(pool: Pool, inner: Inference, modelHint: string): Inference {
  const write = async (row: {
    purpose: string; kind: 'json' | 'vision'; model: string; ok: boolean;
    errorKind?: ErrorKind; errorMessage?: string; ms: number; tokensIn: number; tokensOut: number;
  }) => {
    try {
      await pool.query(
        `insert into ai_calls (purpose, kind, model, ok, error_kind, error_message, latency_ms, tokens_in, tokens_out)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [row.purpose, row.kind, row.model, row.ok, row.errorKind ?? null, row.errorMessage?.slice(0, 500) ?? null, row.ms, row.tokensIn, row.tokensOut],
      );
    } catch (err) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'ai_calls.write_failed', detail: { error: String(err) } }));
    }
  };

  const wrap = <T,>(kind: 'json' | 'vision', req: JsonRequest<T> | VisionRequest<T>, run: () => Promise<JsonResult<T>>) => {
    const t0 = Date.now();
    return run().then(
      async (res) => {
        await write({ purpose: req.purpose, kind, model: res.model || modelHint, ok: true, ms: Date.now() - t0, tokensIn: res.usage.tokensIn, tokensOut: res.usage.tokensOut });
        return res;
      },
      async (err) => {
        await write({ purpose: req.purpose, kind, model: modelHint, ok: false, errorKind: classify(err), errorMessage: String(err), ms: Date.now() - t0, tokensIn: 0, tokensOut: 0 });
        throw err;
      },
    );
  };

  return {
    json: (req) => wrap('json', req, () => inner.json(req)),
    vision: (req) => wrap('vision', req, () => inner.vision(req)),
  };
}
