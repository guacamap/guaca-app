import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Inference, JsonRequest, JsonResult, VisionRequest } from './types.js';

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 24);
}

/**
 * Deterministic, fixture-keyed inference for tests (plan §4 and §7.9).
 * A missing fixture throws with the key printed so you can paste it in.
 * No randomness, no clock, no network — the only inference every test uses.
 */
export class FakeInference implements Inference {
  readonly calls: Array<{ method: 'json' | 'vision'; purpose: string }> = [];

  constructor(
    private readonly fixtures: Record<string, unknown> = {},
    private readonly model = 'fake',
  ) {}

  keyFor(req: JsonRequest<unknown> | VisionRequest<unknown>): string {
    const shape = (req.schema as z.ZodObject<Record<string, z.ZodType>>).shape;
    const schemaName =
      typeof shape === 'object' && shape !== null
        ? Object.keys(shape).join(',')
        : 'unknown';
    return hash(
      JSON.stringify([
        req.purpose,
        schemaName,
        req.system,
        req.user,
        'untrusted' in req ? req.untrusted ?? '' : '',
        'images' in req ? req.images.length : 0,
      ]),
    );
  }

  private async respond<T>(method: 'json' | 'vision', req: JsonRequest<T> | VisionRequest<T>): Promise<JsonResult<T>> {
    this.calls.push({ method, purpose: req.purpose });
    const key = this.keyFor(req);
    if (!(key in this.fixtures)) {
      throw new Error(
        `Missing fixture ${key} for ${method}(${req.purpose}). ` +
          `Seed FakeInference with this key and the expected payload.`,
      );
    }
    const parsed = (req.schema as z.ZodType<T>).safeParse(this.fixtures[key]);
    if (!parsed.success) {
      throw new Error(`fixture for ${key} does not match schema: ${parsed.error.message}`);
    }
    return {
      raw: parsed.data,
      usage: { tokensIn: 10, tokensOut: 10 },
      model: this.model,
    };
  }

  json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
    return this.respond('json', req);
  }

  vision<T>(req: VisionRequest<T>): Promise<JsonResult<T>> {
    return this.respond('vision', req);
  }
}
