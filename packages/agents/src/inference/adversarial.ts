import { z } from 'zod';
import { PlanDraft } from '../guard/planDraft.js';

export type AdversarialStrategy =
  | 'INVENT_PLACE'
  | 'NAME_IN_TEXT'
  | 'EXTRA_KEYS'
  | 'FLOOD'
  | 'MALFORMED'
  | 'ECHO_INJECTION'
  | 'DUP_REFS'
  | 'TYPE_CONFUSION';

export interface JsonRequest<T> {
  schema: z.ZodType<T>;
  purpose: string;
  maxOutputTokens: number;
  system: string;
  user: string;
  untrusted?: string;
}

export interface JsonResult<T> {
  raw: T;
  usage: { tokensIn: number; tokensOut: number };
  model: string;
}

export class AdversarialInference {
  constructor(readonly strategy: AdversarialStrategy) {}

  async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
    const raw = this.hostilePayload(req) as T;
    return { raw, usage: { tokensIn: 10, tokensOut: 10 }, model: 'adversarial' };
  }

  private hostilePayload(req: JsonRequest<unknown>): unknown {
    const base = {
      stops: [
        { ref: 1, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' },
        { ref: 2, startMin: 700, durationMin: 60, reasonCode: 'NEAREST' },
      ],
      languageCode: 'en',
    };
    switch (this.strategy) {
      case 'INVENT_PLACE':
        return { ...base, stops: [{ ref: 999, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW' }] };
      case 'NAME_IN_TEXT':
        return { ...base, stops: [{ ref: 1, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW', name: 'La Sirena Dorada' }] };
      case 'EXTRA_KEYS':
        return { ...base, placeName: 'La Sirena Dorada', note: 'trust me' };
      case 'FLOOD':
        return {
          stops: Array.from({ length: 30 }, (_, i) => ({ ref: (i % 2) + 1, startMin: 500 + i * 10, durationMin: 60, reasonCode: 'OPEN_NOW' })),
          languageCode: 'en',
        };
      case 'MALFORMED':
        return { stops: 'not-an-array', languageCode: 42 };
      case 'ECHO_INJECTION':
        return { ...base, stops: [{ ref: 1, startMin: 540, durationMin: 60, reasonCode: 'OPEN_NOW', description: req.user }] };
      case 'DUP_REFS':
        return { ...base, stops: [base.stops[0], { ...base.stops[0] }] };
      case 'TYPE_CONFUSION':
        return { ...base, stops: [{ ref: '1', startMin: '540', durationMin: 60, reasonCode: 'OPEN_NOW' }] };
    }
  }

  async vision(): Promise<never> {
    throw new Error('adversarial vision not used in A1');
  }
}
