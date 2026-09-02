import { z } from 'zod';
import { PlaceCategory, TAXONOMY_BY_CATEGORY } from '@guaca/shared';
import { lexicalSweep, normaliseForSweep } from '../guard/lexicalSweep.js';
import { detectInjection } from '../inference/injection.js';
import type { Inference } from '../inference/types.js';
import { classifiesIntent } from './intent.js';

const CATEGORY_VALUES = PlaceCategory.options;

export const ConciergeSchema = z.object({
  mode: z.enum(['chat', 'ask', 'mission', 'notify']),
  /** What Guaca says. Never a place, a business, a price or a claim about the map. */
  reply: z.string().min(1).max(400),
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

/**
 * Keep what can be kept: the sentences that name nothing survive, the ones
 * that do are dropped. Empty when nothing survives, and the caller falls
 * back. "Caribbean Sea" in a sweep hit should not cost the whole message.
 */
function withoutNamingSentences(reply: string, placeNames: readonly string[]): string {
  if (!namesAnything(reply, placeNames)) return reply.trim();
  const kept = (reply.match(/[^.!?]+[.!?]+["»)]?\s*|[^.!?]+$/g) ?? [])
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && !namesAnything(x, placeNames));
  return kept.join(' ').trim();
}

const PlaceCheckSchema = z.object({
  /** True when the message points at anything specific on the ground, or promises a time. */
  pointsAtSomething: z.boolean(),
});

/**
 * The lexical sweep only sees capitalised names. "a trail by the old
 * lighthouse" is an invention too, and so is "in half an hour". A second,
 * cheap call reads the message as a strict editor and answers one question.
 * Fails closed: an error counts as pointing at something.
 */
async function pointsAtSomething(inference: Inference, reply: string): Promise<boolean> {
  try {
    const res = await inference.json<z.infer<typeof PlaceCheckSchema>>({
      schema: PlaceCheckSchema,
      purpose: 'concierge-guard',
      maxOutputTokens: 30,
      system:
        'You are a strict editor for a service that must never suggest places it has not verified. Read the message and answer true if it mentions, describes, hints at, suggests, or claims the existence of ANY place, spot, beach, trail, walk, road, landmark, building, neighbourhood, business, dish, event or route, whether named or not, specific or vague ("a couple of easy walks around", "a trail by the lighthouse", "some spots by the water" all count), or promises a duration (in half an hour, in minutes, tonight). ' +
        'Greetings, weather, sea, sun, feelings, questions about the traveller, saying that nothing is verified yet, and offers to send a local or to let them know when something is verified are fine: answer false for those. Answer with the JSON only.',
      user: reply,
      untrusted: reply,
    });
    return res.raw.pointsAtSomething;
  } catch {
    return true;
  }
}

/** Sentences that point at something are dropped; the clean ones survive. */
async function withoutPointing(inference: Inference, reply: string): Promise<string> {
  if (reply.length === 0) return reply;
  if (!(await pointsAtSomething(inference, reply))) return reply;
  const sentences = (reply.match(/[^.!?]+[.!?]+["»)]?\s*|[^.!?]+$/g) ?? []).map((x) => x.trim()).filter(Boolean);
  if (sentences.length <= 1) return '';
  const verdicts = await Promise.all(sentences.map((x) => pointsAtSomething(inference, x)));
  return sentences.filter((_, i) => !verdicts[i]).join(' ').trim();
}

/** A chat message asks one thing: anything after the first question is cut. */
function oneQuestionOnly(reply: string): string {
  const i = reply.indexOf('?');
  if (i < 0 || reply.indexOf('?', i + 1) < 0) return reply;
  return reply.slice(0, i + 1).trim();
}

/**
 * Who Guaca is, in every call. The rules that keep it honest come after
 * this in each prompt; this is the voice.
 */
function persona(lang: 'en' | 'es'): string {
  return (
    'You are Guaca, a friend who lives in this Caribbean town and knows which locals have actually stood in front of which places. ' +
    'You text like a person, not a service: warm, relaxed, specific, a little playful, never corporate. ' +
    `Answer in the language the traveller writes in (Spanish is the Caribbean kind, tú, never usted); if you cannot tell, use ${lang === 'es' ? 'Spanish' : 'English'}. One to three short sentences, like a message from a friend. No lists, no emoji, no headings, no exclamation marks in a row. ` +
    'Never open with the same words as your previous message. Never say "I can send someone to check or let you know" as a formula; when you offer those, say it the way a friend would, once, in your own words. ' +
    'Hard rules: never name, invent, describe or recommend a specific place, business, beach, restaurant, hotel, event or price; never claim what is open, good, safe or pretty. Only the verified map does that, and you reach for it. '
  );
}

const FALLBACK: Record<'en' | 'es', string> = {
  en: 'Hi! Tell me what you are after: food, a beach, culture, nature or a market, and I will check what locals have verified nearby.',
  es: '¡Hola! Cuéntame qué buscas: comida, playa, cultura, naturaleza o un mercado, y reviso lo que los locales han verificado cerca.',
};
const SWEPT: Record<'en' | 'es', string> = {
  en: 'Let me check what locals have actually verified for that.',
  es: 'Déjame revisar lo que los locales han verificado para eso.',
};
/** When the editor empties a mission or notify reply, the confirmation still has to land. */
const SWEPT_BY_MODE: Record<'mission' | 'notify', Record<'en' | 'es', string>> = {
  mission: { en: 'Done, I am sending a local to check. I will tell you what they find.', es: 'Listo, mando a un vecino a revisar. Te cuento lo que encuentre.' },
  notify: { en: 'Done, I will tell you the moment a local verifies it.', es: 'Listo, te aviso en cuanto un vecino lo verifique.' },
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
      maxOutputTokens: 260,
      system:
        persona(lang) +
        'How a conversation goes: if they greet you, greet them back like you mean it and get curious about their day. If they mention what they are after, react to it as a person would (a private beach, a long lunch, somewhere to dance) and, when it would genuinely change what you look for, ask ONE light question: with whom, when, what mood, walking or driving. Never more than one question per message, and never ask twice in a row; after one clarifying exchange, or when the wish is already clear, go look. ' +
        'Choose mode: "chat" when your message is a greeting, small talk, a reaction, or that one question (a message ending in a question is always "chat"). ' +
        '"ask" when it is time to look: askText is a short plain query in their language that the map can answer ("a quiet beach nearby", "where can I eat nearby", "museums and history nearby"), category is set, and reply is one natural sentence saying you are going to check what locals have verified, in your own words each time. ' +
        (input.hasOpenRefusal
          ? 'The map had nothing for their last wish. If they now agree to have a local sent to check, mode is "mission" and reply confirms it warmly; if they would rather be told when it is verified, mode is "notify". Otherwise keep talking. '
          : '') +
        `Verified coverage nearby (only to set expectations, never to name anything): ${input.coverage.verifiedNearby} places` +
        (coverage ? ` (${coverage})` : '') +
        '. Categories: ' + CATEGORY_VALUES.join(', ') + '.' +
        (input.now ? ` Right now: ${input.now}. Weave these in only when natural, the way a local mentions the sea or the heat.` : ''),
      user: (transcript ? `Conversation so far:\n${transcript}\n\n` : '') + `Traveller now: ${input.text}`,
      untrusted: input.text,
    });
    const turn = res.raw;
    const kept = await withoutPointing(inference, withoutNamingSentences(turn.reply, input.placeNames));
    if (kept.length === 0) {
      // Every sentence named something. The line goes; the intent survives.
      const line = turn.mode === 'mission' || turn.mode === 'notify' ? SWEPT_BY_MODE[turn.mode][lang] : SWEPT[lang];
      return { ...turn, reply: line, via: 'guard' };
    }
    turn.reply = turn.mode === 'chat' ? oneQuestionOnly(kept) : kept;
    if (turn.mode === 'ask' && !turn.askText?.trim()) turn.askText = input.text;
    return { ...turn, via: kept === res.raw.reply.trim() ? 'model' : 'guard' };
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

/** The category in the traveller's words, never the slug the map uses. */
function categoryWords(category: string | null, lang: 'en' | 'es'): string {
  const entry = category ? TAXONOMY_BY_CATEGORY.get(category as PlaceCategory) : undefined;
  if (!entry) return lang === 'es' ? 'algo concreto' : 'something specific';
  return (lang === 'es' ? entry.labelEs : entry.labelEn).toLowerCase();
}

export const RefusalNarrationSchema = z.object({
  /** Two sentences at most. Honest about the gap, warm, no place names. */
  reply: z.string().min(1).max(400),
});

export interface RefusalNarrationInput {
  text: string;
  language: string;
  /** The last few turns, oldest first, so the refusal continues the thread. */
  history?: ReadonlyArray<{ role: 'user' | 'guaca'; text: string }>;
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
      maxOutputTokens: 220,
      system:
        persona(lang) +
        'The verified map has nothing for what they just asked. Tell them straight, as a friend would: nobody has actually stood in front of that yet, so you will not guess. ' +
        'Then, in your own words, offer what you can do: a local can be sent to go and check, or you can tell them the moment it is verified. If it fits, add one light question or one useful fact from right now instead. ' +
        (input.reason === 'UNCLEAR_QUESTION'
          ? 'Actually you did not understand what they want: skip the refusal and ask one short friendly question. '
          : `What they want: ${categoryWords(input.category, lang)}. Verified nearby: ${input.coverage.verifiedNearby} places, ${input.coverage.inCategory} in that category (mention a number only if it helps). `) +
        (input.now ? `Right now: ${input.now}. ` : ''),
      user:
        (input.history?.length
          ? 'Conversation so far:\n' + input.history.slice(-8).map((m) => `${m.role === 'user' ? 'Traveller' : 'Guaca'}: ${m.text.slice(0, 240)}`).join('\n') + '\n\n'
          : '') + `Traveller now: ${input.text}`,
      untrusted: input.text,
    });
    const reply = await withoutPointing(inference, withoutNamingSentences(res.raw.reply, input.placeNames));
    return reply.length > 0 ? reply : null;
  } catch {
    return null;
  }
}
