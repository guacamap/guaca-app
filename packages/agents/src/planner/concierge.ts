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
  /** For mode 'ask': the specific kind of place when the traveller named one ("tattoo studio", "sushi", "pharmacy"); empty when generic. */
  kind: z.string().max(40).optional(),
  /** For mode 'ask': true when they are asking about tomorrow, not today. */
  tomorrow: z.boolean().optional(),
  /** Short notes worth remembering about this traveller from this message ("travelling with partner", "here until Sunday", "dislikes crowds", "already did the fort"). Empty when nothing new. */
  learned: z.array(z.string().max(160)).max(4),
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
  /** The town: its name and what kind of place it is, for flavour, never for citing. */
  about?: string;
  /** What Guaca remembers about this traveller from earlier days, oldest first. */
  remembered?: readonly string[];
  /** The plan Guaca is keeping for them today, one line, when there is one. */
  activePlan?: string;
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
  /** True when the message points at anything specific on the ground, claims something exists, or promises a duration. */
  pointsAtSomething: z.boolean(),
  /** The same message with those parts removed and nothing else changed; empty when nothing honest remains. */
  cleaned: z.string().max(400),
});

const EDITOR_SYSTEM =
  'You are a strict editor for a service that must never suggest places it has not verified. Read the message. Set pointsAtSomething to true if it mentions, describes, hints at, suggests, or claims the existence of ANY place, spot, beach, trail, walk, road, landmark, building, neighbourhood, business, dish, event or route, whether named or not, specific or vague ("a couple of easy walks around", "a trail by the lighthouse", "some spots by the water" all count), or promises a duration (in half an hour, in minutes, tonight). ' +
  'These are fine and must be kept: greetings, weather, sea, sun, feelings, questions to the traveller, repeating the traveller\'s own wish in general words (a quiet beach, somewhere for dinner, live music tonight), saying that nothing is verified yet, and offers to send a local to go and check or to let them know when something is verified. ' +
  'Then write cleaned: the same message in the same language with only the offending parts removed or neutralised, everything else word for word; if nothing honest remains, cleaned is empty. Answer with the JSON only.';

/**
 * The lexical sweep only sees capitalised names. "a trail by the old
 * lighthouse" is an invention too, and so is "in half an hour". A second,
 * cheap call reads the message as a strict editor and hands back a cleaned
 * version; the cleaned version is checked once more, and if it still points
 * at something the message is dropped. Fails closed on any error.
 */
async function withoutPointing(inference: Inference, reply: string, placeNames: readonly string[]): Promise<string> {
  if (reply.length === 0) return reply;
  const edit = async (text: string) =>
    (
      await inference.json<z.infer<typeof PlaceCheckSchema>>({
        schema: PlaceCheckSchema,
        purpose: 'concierge-guard',
        maxOutputTokens: 260,
        system: EDITOR_SYSTEM,
        user: text,
        untrusted: text,
      })
    ).raw;
  try {
    const first = await edit(reply);
    if (!first.pointsAtSomething) return reply;
    const cleaned = withoutNamingSentences(first.cleaned.trim(), placeNames);
    if (cleaned.length === 0) return '';
    const second = await edit(cleaned);
    return second.pointsAtSomething ? '' : cleaned;
  } catch {
    return '';
  }
}

/**
 * The traveller's language from the message itself; the UI setting is only
 * the tie-break. A Spanish message in an English UI gets Spanish back.
 */
export function guessLang(text: string, fallback: 'en' | 'es'): 'en' | 'es' {
  const t = ` ${text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ')} `;
  if (/[¿¡ñ]|[áéíóú]/.test(text)) return 'es';
  const es = (t.match(/ (el|la|los|las|que|para|con|una|uno|hola|quiero|necesito|busco|donde|dónde|algo|cerca|vamos|dale|si|sí|gracias|manda|avísame|avisame) /g) ?? []).length;
  const en = (t.match(/ (the|and|for|with|want|need|looking|where|something|near|nearby|please|thanks|send|yes|yeah|ok|hey|hi|tell|me) /g) ?? []).length;
  if (es === 0 && en === 0) return fallback;
  return es > en ? 'es' : en > es ? 'en' : fallback;
}

/** "In half an hour", "en media hora", "in 20 minutes": a promise nobody can keep. The sentence goes. */
const DURATION = /\b(media hora|medias horas|minutos?|horas?|hours?|minutes?|mins?)\b|\ben (un|una|unos|unas|\d+)\b.{0,12}\b(hora|minuto)|\bin (an?|half an|\d+|a few|a couple of)\b.{0,12}\b(hour|minute)/i;
function withoutDurations(reply: string): string {
  if (!DURATION.test(reply)) return reply;
  return (reply.match(/[^.!?]+[.!?]+["»)]?\s*|[^.!?]+$/g) ?? [])
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && !DURATION.test(x))
    .join(' ')
    .trim();
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
    (lang === 'es'
      ? 'The traveller writes in Spanish: answer in Spanish, the Caribbean kind, tú, never usted. '
      : 'The traveller writes in English: answer in English, even if earlier messages or the facts below are in another language. ') +
    'One to three short sentences, like a message from a friend. No lists, no emoji, no headings, no exclamation marks in a row. Never promise how long anything will take. ' +
    'You do not know who the traveller is: never assume their gender, age or relationship, never use pet names or compliments about them (no hermosa, guapo, dear, love). Never open with the same words as your previous message. Never say "I can send someone to check or let you know" as a formula; when you offer those, say it the way a friend would, once, in your own words. ' +
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
  const lang = guessLang(input.text, input.language === 'es' ? 'es' : 'en');
  if (detectInjection(input.text).reasons.length > 0) {
    return { mode: 'chat', reply: FALLBACK[lang], learned: [], via: 'guard' };
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
        'Always fill learned: a list of 0 to 4 short notes worth remembering about this traveller from THIS message (who they are with, how long they stay, what they like or avoid, what they already did), like "travelling with partner", "here until Sunday", "avoids crowds". Empty list when the message teaches nothing new. Never a guess, never something already remembered. ' +
        'Choose mode: "chat" when your message is a greeting, small talk, a reaction, or that one question (a message ending in a question is always "chat"). ' +
        '"ask" when it is time to look: askText is a short plain query in their language that the map can answer ("a quiet beach nearby", "where can I eat nearby", "museums and history nearby"), category is set, and reply is one natural sentence saying you are going to check what locals have verified, in your own words each time. When they want a plan, a whole day or several stops, askText starts with "plan my day" (Spanish: "planifica mi día") and keeps every topic they named, for example "plan my day: history and a beach". Set kind to the specific type of place when they named one (tattoo studio, sushi, pharmacy, cocktail bar, surf school); leave it empty for a generic wish (somewhere to eat, a beach). Set tomorrow to true when the ask is about tomorrow. ' +
        (input.hasOpenRefusal
          ? 'The map had nothing for their last wish. If they now agree to have a local sent to check, mode is "mission" and reply confirms it warmly; if they would rather be told when it is verified, mode is "notify". Otherwise keep talking. '
          : '') +
        `Verified coverage nearby (only to set expectations, never to name anything): ${input.coverage.verifiedNearby} places` +
        (coverage ? ` (${coverage})` : '') +
        '. Categories: ' + CATEGORY_VALUES.join(', ') + '.' +
        (input.now ? ` Right now: ${input.now}. Weave these in only when natural, the way a local mentions the sea or the heat.` : '') +
        (input.about ? ` Where you both are: ${input.about}. Use it to sound like you live here; still never name or recommend a specific place from it.` : '') +
        (input.remembered?.length ? ` What you remember about this traveller from before: ${input.remembered.join('; ')}. Use it the way a friend would (do not ask what you already know; refer back naturally; never recite the list).` : '') +
        (input.activePlan ? ` The plan you are keeping for them today: ${input.activePlan}. If they refer to it, you know it.` : ''),
      user: (transcript ? `Conversation so far:\n${transcript}\n\n` : '') + `Traveller now: ${input.text}`,
      untrusted: input.text,
    });
    const turn = res.raw;
    const kept = await withoutPointing(inference, withoutDurations(withoutNamingSentences(turn.reply, input.placeNames)), input.placeNames);
    if (kept.length === 0) {
      // Every sentence named something. The line goes; the intent survives.
      // A chat that named something has nothing to check; ask instead.
      const line = turn.mode === 'mission' || turn.mode === 'notify' ? SWEPT_BY_MODE[turn.mode][lang] : turn.mode === 'chat' ? FALLBACK[lang] : SWEPT[lang];
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
      return { mode: 'ask', reply: '', askText: input.text, learned: [], via: 'lexicon' };
    }
    return { mode: 'ask', reply: FALLBACK[lang], askText: input.text, learned: [], via: 'fallback' };
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
  about?: string;
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
  const lang = guessLang(input.text, input.language === 'es' ? 'es' : 'en');
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
        (input.now ? `Right now: ${input.now}. ` : '') +
        (input.about ? `Where you both are: ${input.about}. Background only; never name a place from it. ` : ''),
      user:
        (input.history?.length
          ? 'Conversation so far:\n' + input.history.slice(-8).map((m) => `${m.role === 'user' ? 'Traveller' : 'Guaca'}: ${m.text.slice(0, 240)}`).join('\n') + '\n\n'
          : '') + `Traveller now: ${input.text}`,
      untrusted: input.text,
    });
    const reply = await withoutPointing(inference, withoutDurations(withoutNamingSentences(res.raw.reply, input.placeNames)), input.placeNames);
    return reply.length > 0 ? reply : null;
  } catch {
    return null;
  }
}

export const SpeakFirstSchema = z.object({ text: z.string().min(1).max(400) });

export interface SpeakFirstInput {
  language: string;
  /** Why Guaca is speaking, in plain facts: the tick decided, the model only words it. */
  reason: string;
  /** What Guaca may refer to by name: the stops of the traveller's own plan. */
  allowedNames: readonly string[];
  remembered?: readonly string[];
  now?: string;
  about?: string;
}

/**
 * Guaca speaks first. The trigger and the facts come from the tick; this
 * turns them into one or two sentences in Guaca's voice. The plan's own
 * stops may be named (the traveller already has them); anything else goes
 * through the same editor as every other sentence. Null when nothing
 * honest survives, and then the tick sends its plain fallback line.
 */
export async function speakFirst(inference: Inference, input: SpeakFirstInput): Promise<string | null> {
  const lang: 'en' | 'es' = input.language === 'es' ? 'es' : 'en';
  try {
    const res = await inference.json<z.infer<typeof SpeakFirstSchema>>({
      schema: SpeakFirstSchema,
      purpose: 'concierge',
      maxOutputTokens: 220,
      system:
        persona(lang) +
        'You are messaging the traveller first, unprompted, because of one concrete reason. Say the reason plainly in the first sentence, then what you propose or ask, in at most two sentences. No greeting ritual, no apology for writing. ' +
        `You may name these places because they are already in the traveller's own plan: ${input.allowedNames.join('; ') || 'none'}. Name nothing else. ` +
        (input.remembered?.length ? `What you remember about them: ${input.remembered.join('; ')}. ` : '') +
        (input.now ? `Right now: ${input.now}. ` : '') +
        (input.about ? `Where they are: ${input.about}. ` : ''),
      user: `Reason: ${input.reason}`,
      untrusted: input.reason,
    });
    // The plan's names are allowed; everything else is swept as usual.
    const raw = res.raw.text.trim();
    const shielded = input.allowedNames.reduce((t, n, i) => t.split(n).join(`__P${i}__`), raw);
    const kept = withoutDurations(withoutNamingSentences(shielded, []));
    const edited = await withoutPointing(inference, kept, []);
    const restored = input.allowedNames.reduce((t, n, i) => t.split(`__P${i}__`).join(n), edited);
    return restored.length > 0 ? restored : null;
  } catch {
    return null;
  }
}
