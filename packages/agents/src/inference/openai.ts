import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Inference, JsonRequest, JsonResult, VisionRequest } from './types.js';

export interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Test seam: force the capability probe result. */
  probeResult?: 'json_schema' | 'json_object';
  /** Test seam: skip the probe and use strict mode directly. */
  useStrictMode?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * OpenAI-compatible provider behind INFERENCE_BASE_URL (§7.9). Reads only
 * INFERENCE_* env; agents never learn which provider is behind it. Capability
 * probe → json_schema; on 4xx → json_object with the schema in the system
 * prompt; one Zod-error repair round-trip; then throw. Constrained decoding
 * is an optimisation, not the guarantee — §7.3 is the guarantee.
 */
export class OpenAICompatibleProvider implements Inference {
  private readonly fetchImpl: typeof fetch;
  private readonly probeResult: 'json_schema' | 'json_object';

  constructor(private readonly options: OpenAICompatibleOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.probeResult = options.probeResult ?? 'json_schema';
  }

  private async chat(
    body: Record<string, unknown>,
  ): Promise<{ content: string; usage: { tokensIn: number; tokensOut: number } }> {
    const timeoutMs = this.options.timeoutMs ?? 30_000;
    const maxRetries = this.options.maxRetries ?? 2;
    let res: Response | undefined;
    let lastError: unknown;
    // Retry only transient failures (network/timeout/5xx); 4xx is a caller bug.
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        res = await this.fetchImpl(`${this.options.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.options.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        lastError = err;
        continue;
      }
      if (res.status < 500) break;
      lastError = new Error(`inference request failed: ${res.status} ${res.statusText}`);
      res = undefined;
    }
    if (!res) {
      throw lastError instanceof Error
        ? lastError
        : new Error(`inference request failed: ${String(lastError)}`);
    }
    if (!res.ok) {
      throw new Error(`inference request failed: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    let data: {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    } = {};
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      // Non-JSON bodies flow into the repair round-trip, not a crash.
    }
    const content = data.choices?.[0]?.message?.content ?? text;
    return {
      content,
      usage: {
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  private async repair<T>(
    schema: z.ZodType<T>,
    body: Record<string, unknown>,
    maxOutputTokens: number,
    depth: number,
  ): Promise<JsonResult<T>> {
    const attempt = await this.chat(body);
    let parsed: z.SafeParseReturnType<unknown, T>;
    try {
      parsed = schema.safeParse(JSON.parse(attempt.content));
    } catch {
      parsed = { success: false } as z.SafeParseReturnType<unknown, T>;
    }
    if (parsed.success) {
      return {
        raw: parsed.data,
        usage: attempt.usage,
        model: (body.model as string) ?? this.options.model,
      };
    }
    if (depth >= 1) {
      const detail = 'error' in parsed ? parsed.error.message : 'unparseable JSON';
      throw new Error(`inference returned invalid JSON after repair: ${detail}`);
    }
    // One repair round-trip: tell the model the JSON failed to validate.
    const detail = 'error' in parsed ? parsed.error.message : 'unparseable JSON';
    const repairBody = {
      ...body,
      messages: [
        ...(body.messages as Array<Record<string, unknown>>),
        {
          role: 'user',
          content: `Your previous response was not valid JSON matching the schema. Fix it: ${detail.slice(0, 300)}`,
        },
      ],
      max_tokens: maxOutputTokens,
    };
    return this.repair(schema, repairBody, maxOutputTokens, depth + 1);
  }

  async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
    if (!Number.isInteger(req.maxOutputTokens) || req.maxOutputTokens <= 0) {
      throw new Error(`maxOutputTokens must be a positive integer`);
    }

    // Real JSON Schema — serialising zod's _def drops every field name.
    const schemaJson = JSON.stringify(zodToJsonSchema(req.schema as z.ZodType<T>));
    const system = req.untrusted
      ? `${req.system}\n\n<untrusted>\n${req.untrusted}\n</untrusted>\nAnswer only from the catalog.`
      : req.system;

    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: req.user },
      ] as Array<{ role: string; content: string }>,
      max_tokens: req.maxOutputTokens,
    };

    if (this.probeResult === 'json_schema') {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: `response_${req.purpose}`,
          schema: JSON.parse(schemaJson),
        },
      };
    } else {
      // json_object fallback: schema serialised into the system prompt.
      body.response_format = { type: 'json_object' };
      const messages = body.messages as Array<{ role: string; content: string }>;
      messages[0]!.content =
        `${system}\n\nRespond ONLY with a JSON object matching this schema:\n${schemaJson}`;
    }

    return this.repair(req.schema, body, req.maxOutputTokens, 0);
  }

  async vision<T>(req: VisionRequest<T>): Promise<JsonResult<T>> {
    const schemaJson = JSON.stringify(zodToJsonSchema(req.schema as z.ZodType<T>));
    // The schema goes in the prompt AND, where the provider supports it, into
    // constrained decoding. Not every VL deployment honours json_schema, so a
    // 4xx falls back to json_object rather than failing the verification.
    // Constrained decoding is an optimisation; §7.3 remains the guarantee.
    const fenced = req.untrusted
      ? `${req.system}\n\n<untrusted>\n${req.untrusted}\n</untrusted>\nAnswer only from the images.`
      : req.system;
    const system = `${fenced}\n\nRespond ONLY with a JSON object matching this JSON Schema:\n${schemaJson}`;
    const body: Record<string, unknown> = {
      model: this.options.visionModel ?? this.options.model,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: req.user },
            ...req.images.map((img) => ({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType};base64,${img.dataBase64}` },
            })),
          ],
        },
      ],
      max_tokens: req.maxOutputTokens,
      response_format: {
        type: 'json_schema',
        json_schema: { name: `vision_${req.purpose}`, schema: JSON.parse(schemaJson) },
      },
    };
    try {
      return await this.repair(req.schema, body, req.maxOutputTokens, 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Only a provider rejection of the constraint is worth retrying; a
      // schema mismatch after repair is a real failure and must surface.
      if (!/inference request failed: 4\d\d/.test(message)) throw err;
      return this.repair(
        req.schema,
        { ...body, response_format: { type: 'json_object' } },
        req.maxOutputTokens,
        0,
      );
    }
  }
}

export interface ProviderEnv {
  INFERENCE_BASE_URL: string;
  INFERENCE_API_KEY: string;
  INFERENCE_MODEL: string;
  INFERENCE_VISION_MODEL?: string;
  INFERENCE_TIMEOUT_MS?: string;
  INFERENCE_MAX_RETRIES?: string;
}

/** Provider selection by env — the fallback provider is a one-env-var swap. */
export function createProvider(env: ProviderEnv): Inference {
  const options: OpenAICompatibleOptions = {
    baseUrl: env.INFERENCE_BASE_URL,
    apiKey: env.INFERENCE_API_KEY,
    model: env.INFERENCE_MODEL,
    timeoutMs: Number(env.INFERENCE_TIMEOUT_MS ?? 30000),
    maxRetries: Number(env.INFERENCE_MAX_RETRIES ?? 2),
  };
  if (env.INFERENCE_VISION_MODEL) {
    options.visionModel = env.INFERENCE_VISION_MODEL;
  }
  return new OpenAICompatibleProvider(options);
}
