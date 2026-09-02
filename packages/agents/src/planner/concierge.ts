import { z } from 'zod';
import { PlaceCategory } from '@guaca/shared';
import { lexicalSweep, normaliseForSweep } from '../guard/lexicalSweep.js';
import { detectInjection } from '../inference/injection.js';
import type { Inference } from '../inference/types.js';
import { classifiesIntent } from './intent.js';

const CATEGORY_VALUES = PlaceCategory.options;

export const ConciergeSchema = z.object({
  mode: z.enum(['chat', 'ask', 'mission', 'notify']),
  /** What Guaca says. Never a place, a business, a price or a claim about the map. */
  reply: z.string().min(1).max(320),
  /** For mode 'ask': a short plain query in the traveller's language. */
  askText: z.string().max(140).optional(),
  category: z.enum([...CATEGORY_VALUES, 'unknown']).optional(),
});
export type ConciergeTurn = z.infer<typeof ConciergeSchema> & {
  /** Where the turn came from: the lexicon, the model, a guard, or the fallback. */
  via: 'lexicon' | 'model' | 'guard' | 'fallback';
};

export interface ConciergeInput {
  text: string;
  language: string;
  /** The last few turns, oldest first. */
  history: ReadonlyArray<{ role: 'user' | 'guaca'; text: string }>;
  /** True when the previous Guaca turn was a refusal the traveller can act on. */
  hasOpenRefusal: boolean;
  /** Honest coverage, so the concierge sets expectations without naming anything. */
  coverage: { verifiedNearby: number; byCategory: ReadonlyMap<string, number> };
  /** Every verified place name nearby: the reply must not contain one. */
  placeNames: readonly string[];
  /** One line of facts about right now (time, weather, sea, sunset, holiday, rates, alert). */
  now?: string;
}

/**
 * True when a concierge sentence names anything: a verified place (only the
 * grounded pipeline may cite those) or a proper name the map does not know
 * (an invention). The sweep alone only catches the second.
 */
function namesAnything(reply: string, placeNames: readonly string[]): boolean {
  const norm = normaliseForSweep(reply);
  for (const name of placeNames) {
    const n = normaliseForSweep(name).trim();
    if (n.length > 2 && norm.includes(n)) return true;
  }
  return lexicalSweep(reply, []).length > 0;
}

const FALLBACK: Record<'en' | 'es', string> = {
  en: 'Hi! Tell me what you are after: food, a beach, culture, nature or a market, and I will check what locals have verified nearby.',
  es: '¡Hola! Cuéntame qué buscas: comida, playa, cultura, naturaleza o un mercado, y reviso lo que los locales han verificado cerca.',
};
const SWEPT: Record<'en' | 'es', string> = {
  en: 'Let me check what locals have actually verified for that.',
  es: 'Déjame revisar lo que los locales han verificado para eso.',
};

/**
 * The turn before the pipeline. Every message gets one schema-constrained
 * call that decides the mode and writes at most two warm sentences: a
 * greeting stays a chat, "yes, send someone" becomes a mission, and a
 * concrete wish is handed to the map as a plain query. The lexicon is only
 * the fallback when the provider is down, so the conversation is always
 * Guaca's and the map is what it reaches for. The model is never allowed to
 * name a place: the reply is swept against the verified names nearby and
 * replaced if it contains one, and the grounded pipeline is the only thing
 * that ever cites a place.
 */
export async function converse(inference: Inference, input: ConciergeInput): Promise<ConciergeTurn> {
  const lang: 'en' | 'es' = input.language === 'es' ? 'es' : 'en';
  if (detectInjection(input.text).reasons.length > 0) {
    return { mode: 'chat', reply: FALLBACK[lang], via: 'guard' };
  }

  const coverage = [...input.coverage.byCategory.entries()]
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${c}: ${n}`)
    .join(', ');
  const transcript = input.history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Traveller' : 'Guaca'}: ${m.text.slice(0, 240)}`)
    .join('\n');

  try {
    const res = await inference.json<z.infer<typeof ConciergeSchema>>({
      schema: ConciergeSchema,
      purpose: 'concierge',
      maxOutputTokens: 220,
      system:
        'You are Guaca, a warm local concierge for Caribbean towns. You chat, find out what the traveller wants, and hand off. ' +
        'Hard rules: never name, invent, describe or recommend a specific place, business, beach, restaurant, hotel, event or price; never claim what is open or good. Only the verified map does that, and you hand off to it. ' +
        `Reply in ${lang === 'es' ? 'Spanish' : 'English'}, at most two short sentences, friendly, no lists, no emoji. ` +
        'Choose mode: "chat" for greetings, thanks, small talk, or when one short friendly question would clarify what they want (mood, food or beach or culture or nature or market, party size, when). If your reply is a question, the mode is "chat", never "ask". ' +
        '"ask" when they want something concrete the map can answer, even if it comes wrapped in a greeting: put a short plain query in askText in their language (for example "a beach nearby", "where can I eat nearby", "museums and history nearby") and set category; the reply is then one short sentence saying you are checking. ' +
        (input.hasOpenRefusal
          ? '"mission" only if they agree to have a local sent to check the thing that was not verified; "notify" if they would rather be told when it is verified. '
          : '') +
        `Verified coverage nearby (use only to set expectations, never to name anything): ${input.coverage.verifiedNearby} places` +
        (coverage ? ` (${coverage})` : '') +
        '. Categories: ' + CATEGORY_VALUES.join(', ') + '.' +
        (input.now ? ` Right now: ${input.now}. You may mention these facts (heat, rain, sea, sunset, holiday, exchange rate) when they help; a local would.` : ''),
      user: (transcript ? `Conversation so far:\n${transcript}\n\n` : '') + `Traveller now: ${input.text}`,
      untrusted: input.text,
    });
    const turn = res.raw;
    if (namesAnything(turn.reply, input.placeNames)) {
      // It named a place. The sentence goes; the intent (if any) survives.
      return { ...turn, reply: SWEPT[lang], via: 'guard' };
    }
    if (turn.mode === 'ask' && !turn.askText?.trim()) turn.askText = input.text;
    return { ...turn, via: 'model' };
  } catch {
    // Provider down: the lexicon decides. A concrete ask still reaches the
    // pipeline, which refuses honestly and records the demand; anything else
    // gets the fixed greeting so the traveller is not left hanging.
    if (classifiesIntent(input.text)) {
      return { mode: 'ask', reply: '', askText: input.text, via: 'lexicon' };
    }
    return { mode: 'ask', reply: FALLBACK[lang], askText: input.text, via: 'fallback' };
  }
}

export const RefusalNarrationSchema = z.object({
  /** Two sentences at most. Honest about the gap, warm, no place names. */
  reply: z.string().min(1).max(320),
});

export interface RefusalNarrationInput {
  text: string;
  language: string;
  reason: string;
  category: string | null;
  coverage: { verifiedNearby: number; inCategory: number };
  placeNames: readonly string[];
  now?: string;
}

/**
 * When the map has nothing for a question, Guaca says so in its own words
 * rather than a fixed line: what was understood, that nobody has verified it
 * yet, and that a local can be sent or the traveller told when it lands. The
 * chips under the card stay deterministic; this is only the sentence. Null
 * when the provider is down or the model named a place, and the caller falls
 * back to the fixed line.
 */
export async function narrateRefusal(inference: Inference, input: RefusalNarrationInput): Promise<string | null> {
  const lang: 'en' | 'es' = input.language === 'es' ? 'es' : 'en';
  try {
    const res = await inference.json<z.infer<typeof RefusalNarrationSchema>>({
      schema: RefusalNarrationSchema,
      purpose: 'concierge',
      maxOutputTokens: 160,
      system:
        'You are Guaca, a warm local concierge for Caribbean towns. The verified map has nothing for what the traveller just asked. ' +
        'Write at most two short sentences in ' + (lang === 'es' ? 'Spanish' : 'English') + ': say plainly that no local has verified that yet, and that you can send a local to check or let them know when it is verified. ' +
        'Hard rules: never name, invent, describe or suggest any place, business, beach or event; never guess what exists; never apologise more than once; no lists, no emoji. ' +
        (input.reason === 'UNCLEAR_QUESTION'
          ? 'You did not understand what they want: ask one short friendly question instead of refusing. '
          : `What they want: ${input.category ?? 'unknown'}. Verified nearby: ${input.coverage.verifiedNearby} places, ${input.coverage.inCategory} in that category (mention the number only if it helps set expectations). `) +
        (input.now ? `Right now: ${input.now}. Mention a fact from this only if it is useful to them.` : ''),
      user: `Traveller asked: ${input.text}`,
      untrusted: input.text,
    });
    const reply = res.raw.reply.trim();
    if (!reply || namesAnything(reply, input.placeNames)) return null;
    return reply;
  } catch {
    return null;
  }
}
