import { z } from 'zod';

/**
 * The inference client is schema-only by construction (§7.9). There is
 * deliberately NO free-text method — adding one reopens the channel §7.3
 * closes. Every request carries a mandatory maxOutputTokens, a purpose for
 * budgeting/logging, and keeps `untrusted` user text in its own fenced field.
 */
export interface JsonRequest<T> {
  schema: z.ZodType<T>;
  purpose: string;
  maxOutputTokens: number;
  system: string;
  user: string;
  /** Untrusted user text — fenced, never blind-concatenated into the prompt. */
  untrusted?: string;
}

export interface VisionRequest<T> {
  schema: z.ZodType<T>;
  purpose: string;
  maxOutputTokens: number;
  system: string;
  /** All photos in a single request — 1 call instead of N (§7.8). */
  images: Array<{ mimeType: string; dataBase64: string }>;
  user: string;
  untrusted?: string;
}

export interface JsonResult<T> {
  raw: T;
  usage: { tokensIn: number; tokensOut: number };
  model: string;
}

export interface Inference {
  json<T>(req: JsonRequest<T>): Promise<JsonResult<T>>;
  vision<T>(req: VisionRequest<T>): Promise<JsonResult<T>>;
}
