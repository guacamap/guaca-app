import type { Pool } from 'pg';
import { tierOf } from '@guaca/shared';
import { estimatingRouter, type Router } from './routing.js';
import { applyTravel } from './travel.js';
import {
  answerFromCatalog,
  converse,
  narrateRefusal,
  guessLang,
  classifiesIntent,
  classifyWithModel,
  extractIntent,
  groundFromVerifiedRows,
  renderItinerary,
  runGroundedPlanner,
  type Inference,
} from '@guaca/agents';
import {
  q,
  recordQuestion,
  trendsForPlaces,
  createTrip,
  type PlaceRow,
} from '@guaca/db';
import {
  PACE_STOPS_PER_DAY,
  TripReasonCode,
  type Trip,
  type TripPace,
  type TripStop,
} from '@guaca/shared';
import { suggestionsNear } from './suggestionsService.js';
import { contextLine, rainWindows, rainWindowsLine, type AreaContext, type ContextProvider } from './context.js';

export interface AreaRow { id: string; slug: string; name: string; country: string; timezone: string; lat: number; lon: number; about_en?: string | null; about_es?: string | null }

/** The area a point falls in, with its centroid; null outside every area. */
export async function areaAt(pool: Pool, lat: number, lon: number): Promise<AreaRow | null> {
  const r = await pool.query<AreaRow>(
    `select id, slug, name, country, timezone, about_en, about_es,
            ST_Y(ST_Centroid(geom::geometry)) as lat, ST_X(ST_Centroid(geom::geometry)) as lon
       from areas where ST_Covers(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) limit 1`,
    [lat, lon],
  );
  return r.rows[0] ?? null;
}

/**
 * A plan that leaned on an open-data stop is demand for a local to stand
 * there. Each such stop becomes an unanswered question at its own point,
 * in its own category, so the gap agent clusters it and can commission the
 * check. Never blocks the answer; the traveller has their plan already.
 */
async function recordUnverifiedStops(
  pool: Pool,
  input: { language: string; sessionId?: string | null; propertyId?: string | null },
  stops: ReadonlyArray<{ id: string; name: string; category: string; lat: number; lon: number; corroboration?: number }>,
): Promise<void> {
  for (const s of stops.slice(0, 4)) {
    try {
      await recordQuestion(pool, {
        rawText: `${input.language === 'es' ? 'Confirmar' : 'Confirm'}: ${s.name} (${s.corroboration ?? 1} ${input.language === 'es' ? 'mapas abiertos' : 'open maps'})`,
        language: input.language,
        category: s.category as ReturnType<typeof extractIntent>['category'],
        lat: s.lat,
        lon: s.lon,
        answered: false,
        answerPlaceIds: [],
        refusalReason: 'UNVERIFIED_STOP_USED',
        sessionId: input.sessionId ?? null,
        propertyId: input.propertyId ?? null,
      });
    } catch {
      // Bookkeeping only.
    }
  }
}

/** Minutes past midnight in the town's own timezone; the server clock is UTC and means nothing to a traveller. */
export function localNowMin(timezone: string | undefined, at: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone ?? 'UTC', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(at);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return h * 60 + m;
  } catch {
    return at.getUTCHours() * 60 + at.getUTCMinutes();
  }
}

/** The town in one line for the concierge: its name and, when fetched, what kind of place it is. */
export function aboutLine(area: AreaRow, lang: string): string {
  const about = (lang === 'es' ? area.about_es : area.about_en) ?? area.about_en ?? area.about_es;
  return about ? `${area.name}: ${about}` : area.name;
}

/** Context for an area (or, outside every area, for the point itself). Never throws. */
export async function contextFor(provider: ContextProvider | undefined, area: AreaRow | null, lat: number, lon: number): Promise<AreaContext | null> {
  if (!provider) return null;
  try {
    return await provider.forArea(area
      ? { lat: area.lat, lon: area.lon, country: area.country, timezone: area.timezone }
      : { lat, lon, country: 'VE', timezone: 'America/Caracas' });
  } catch {
    return null;
  }
}

const STORM_TEXT: Record<'en' | 'es', (a: NonNullable<AreaContext['alert']>) => string> = {
  en: (a) => `There is an active ${a.kind.replace('_', ' ')} alert (${a.name}, ${a.level}) about ${Math.round(a.distanceKm)} km from here. I am not recommending places right now. Please follow local authorities and the official forecast (${a.source === 'NHC' ? 'nhc.noaa.gov' : 'gdacs.org'}), and ask me again once it has passed.`,
  es: (a) => `Hay una alerta activa de ${a.kind === 'tropical_cyclone' ? 'ciclón tropical' : a.kind === 'flood' ? 'inundación' : a.kind === 'earthquake' ? 'sismo' : a.kind === 'tsunami' ? 'tsunami' : 'volcán'} (${a.name}, ${a.level}) a unos ${Math.round(a.distanceKm)} km. Ahora mismo no recomiendo lugares. Sigue a las autoridades locales y el pronóstico oficial (${a.source === 'NHC' ? 'nhc.noaa.gov' : 'gdacs.org'}), y pregúntame de nuevo cuando pase.`,
};

/** Deterministic planner notes from the context: what was left out and why. */
function contextNotes(ctx: AreaContext | null, lang: 'en' | 'es'): { skipBeaches: boolean; notes: string[] } {
  if (!ctx) return { skipBeaches: false, notes: [] };
  const notes: string[] = [];
  let skipBeaches = false;
  if (ctx.sea && ctx.sea.state === 'rough') {
    skipBeaches = true;
    notes.push(lang === 'es' ? `Mar picado hoy (olas de ${ctx.sea.waveM.toFixed(1)} m): dejé las playas fuera.` : `Rough sea today (${ctx.sea.waveM.toFixed(1)} m waves): beaches left out.`);
  }
  if (ctx.weather && ctx.weather.rainPct >= 60) {
    notes.push(lang === 'es' ? `Lluvia probable hoy (${ctx.weather.rainPct}%): lleva algo para cubrirte.` : `Rain likely today (${ctx.weather.rainPct}%): bring cover.`);
  }
  if (ctx.weather && ctx.weather.uv >= 10) {
    notes.push(lang === 'es' ? `UV ${Math.round(ctx.weather.uv)} al mediodía: mejor lo de afuera temprano o después de las 4.` : `UV ${Math.round(ctx.weather.uv)} at midday: do the outdoor stops early or after 4 pm.`);
  }
  if (ctx.holiday) {
    notes.push(lang === 'es' ? `Hoy es feriado (${ctx.holiday.localName}): algunos negocios cierran temprano.` : `Today is a public holiday (${ctx.holiday.localName}): some businesses close early.`);
  }
  return { skipBeaches, notes };
}

/** A follow-up the client renders as a chip. Never model text: an `ask`
 *  re-enters the same grounded path with a canonical query. */
export type RefusalOption =
  | { kind: 'ask' | 'refine'; label: string; text: string; category?: string }
  | { kind: 'notify' }
  | { kind: 'mission' };

export interface RefusalContext {
  reason: string;
  /** The category the question was understood as, if any. */
  category: string | null;
  coverage: { verifiedNearby: number; inCategory: number };
  /** Ordered; the mission is always last. */
  options: RefusalOption[];
  /** True when `text` is Guaca's own sentence, so the client shows it as a message, not a notice. */
  spoken?: boolean;
}

export interface AskResult {
  /** 'chat', 'mission' and 'notify' are conversation turns: no place is cited. */
  kind: 'answer' | 'refusal' | 'chat' | 'mission' | 'notify';
  text: string;
  placeIds: string[];
  /** A friendly sentence from the concierge that precedes a grounded answer or refusal. */
  lead?: string;
  /** On kind 'mission': what happened when the traveller asked for a local. */
  mission?: { status: string; spotterName?: string; expiresAt?: string; questionId: string };
  /** On a refusal: what we understood, what exists nearby, and what to do next. */
  refusal?: RefusalContext;
  /** Deterministic notes from the day's context (sea, rain, UV, holiday). */
  notes?: string[];
  /** The context this turn was answered with, for the client's header line. */
  context?: AreaContext;
  /** The persisted question — the demand signal the gap agent later reads. */
  questionId?: string;
  /** Grounded follow-ups near the ask — deterministic trend picks, never model output. */
  suggestions?: Array<{ placeId: string; name: string; why: 'trending' | 'asked_about' | 'fresh' }>;
}

/** Canonical queries the lexicon recognises as exactly one category, so a
 *  chip re-asks through the fast path with nothing invented. */
const CANONICAL: Record<string, Record<'en' | 'es', string>> = {
  eat_drink: { en: 'where can I eat nearby', es: 'dónde comer cerca' },
  beach_water: { en: 'a beach nearby', es: 'una playa cerca' },
  nature_walk: { en: 'a nature walk nearby', es: 'una caminata en la naturaleza cerca' },
  culture_history: { en: 'museums and history nearby', es: 'museos e historia cerca' },
  market_shop: { en: 'a market nearby', es: 'mercado cerca' },
  services: { en: 'a pharmacy nearby', es: 'una farmacia cerca' },
  nightlife_music: { en: 'live music nearby', es: 'musica en vivo cerca' },
};
const CATEGORY_LABEL: Record<string, Record<'en' | 'es', string>> = {
  eat_drink: { en: 'places to eat', es: 'lugares para comer' },
  beach_water: { en: 'beaches', es: 'playas' },
  nature_walk: { en: 'nature walks', es: 'caminatas' },
  culture_history: { en: 'culture spots', es: 'sitios de cultura' },
  market_shop: { en: 'markets', es: 'mercados' },
  services: { en: 'services', es: 'servicios' },
  nightlife_music: { en: 'music spots', es: 'sitios con música' },
};

/**
 * What a refused traveller can do next, in order. Chips are deterministic:
 * a re-ask goes back through the grounded pipeline; the model never writes
 * a chip. The mission is last, the honest end of the road.
 */
export function refusalOptions(input: {
  language: string;
  reason: string;
  category: string | null;
  verifiedNearby: number;
  inCategory: number;
  byCategory: ReadonlyMap<string, number>;
}): RefusalOption[] {
  const lang: 'en' | 'es' = input.language === 'es' ? 'es' : 'en';
  const out: RefusalOption[] = [];
  const unclear = input.reason === 'UNCLEAR_QUESTION';
  if (!unclear && input.category && input.inCategory > 0 && CANONICAL[input.category]) {
    const label = CATEGORY_LABEL[input.category]?.[lang] ?? input.category;
    out.push({
      kind: 'ask',
      category: input.category,
      label: lang === 'es' ? `Ver ${input.inCategory} ${label} verificados` : `Show the ${input.inCategory} verified ${label}`,
      text: CANONICAL[input.category]![lang],
    });
  }
  if (unclear || input.inCategory === 0) {
    // What is actually verified nearby, as chips, most covered first.
    const covered = [...input.byCategory.entries()]
      .filter(([c, n]) => n > 0 && CANONICAL[c] && c !== input.category)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    for (const [c, n] of covered) {
      out.push({ kind: 'refine', category: c, label: `${CATEGORY_LABEL[c]?.[lang] ?? c} (${n})`, text: CANONICAL[c]![lang] });
    }
  }
  if (input.verifiedNearby >= 3) {
    out.push({
      kind: 'ask',
      label: lang === 'es' ? 'Planea mi día con lo verificado' : 'Plan my day with what is verified',
      text: lang === 'es' ? 'planea mi día: comida, playa y cultura' : 'plan my day: food, beach and culture',
    });
  }
  out.push({ kind: 'notify' });
  out.push({ kind: 'mission' });
  return out;
}

// The headline states only what is true at this moment. Whether a local is
// sent is the traveller's call now (the last option under the refusal), so
// the old "we have commissioned a local" promise is gone.
const REFUSAL_TEXT: Record<string, string> = {
  es: 'Nadie ha estado frente a algo así por aquí todavía, así que no voy a adivinar. Puedo mandar a un vecino a revisar, o avisarte cuando esté verificado.',
  en: 'Nobody has stood in front of anything like that here yet, so I will not guess. I can send a local to check, or tell you when it is verified.',
};

/**
 * The tourist-facing ask path: retrieval → coverage (before any LLM) → fast
 * path (zero inference) → guarded model path → multilingual render.
 *
 * EVERY exit records the question. A refusal that isn't written down is not a
 * demand signal — `clusterUnanswered` reads `questions where answered = false`,
 * so an unrecorded refusal means the gap agent never sees it and no mission is
 * ever commissioned. This function is where the core loop is closed.
 *
 * Intent extraction is the deterministic lexicon, so recording costs zero
 * inference and the refusal path still touches no model.
 */
export async function ask(
  pool: Pool,
  input: {
    text: string;
    language: string;
    lat: number;
    lon: number;
    sessionId?: string | null;
    propertyId?: string | null;
    /** The thread so far, oldest first; empty for a one-shot ask. */
    history?: ReadonlyArray<{ role: 'user' | 'guaca'; text: string }>;
    /** The latest refused question in the thread, if the traveller may act on it. */
    lastQuestionId?: string | null;
    /** Needed for the mission and notify turns. */
    touristId?: string;
  },
  opts: { minCandidates: number; inference: import('@guaca/agents').Inference; contextProvider?: ContextProvider; router?: Router },
): Promise<AskResult> {
  const lang: 'en' | 'es' = input.language === 'es' ? 'es' : 'en';
  const record = async (
    answered: boolean,
    category: string,
    placeIds: string[],
    refusalReason: string | null,
  ): Promise<string | undefined> => {
    try {
      const rec = await recordQuestion(pool, {
        rawText: input.text,
        language: input.language,
        category: category as ReturnType<typeof extractIntent>['category'],
        lat: input.lat,
        lon: input.lon,
        answered,
        answerPlaceIds: placeIds,
        refusalReason,
        sessionId: input.sessionId ?? null,
        propertyId: input.propertyId ?? null,
      });
      return rec.questionId;
    } catch {
      // Never fail a guest's request because bookkeeping failed. The demand
      // signal is valuable, the answer is what they came for.
      return undefined;
    }
  };

  /** Grounded follow-ups near the ask, excluding what the answer just cited. */
  const followUps = async (
    answered: readonly string[],
  ): Promise<NonNullable<AskResult['suggestions']> | undefined> => {
    try {
      const s = await suggestionsNear(pool, {
        lat: input.lat,
        lon: input.lon,
        exclude: answered,
      });
      return s.length > 0 ? s : undefined;
    } catch {
      // Suggestions are garnish; the answer is the meal.
      return undefined;
    }
  };

  const area = await areaAt(pool, input.lat, input.lon);
  const ctx = await contextFor(opts.contextProvider, area, input.lat, input.lon);
  const withCtx = ctx ? { context: ctx } : {};

  // Storm mode: an active alert nearby outranks the map. No recommendations,
  // the alert, where the official word is. The one case a feed wins.
  if (ctx?.alert) {
    return { kind: 'chat', text: STORM_TEXT[lang](ctx.alert), placeIds: [], ...withCtx };
  }

  // Tiered honesty: verified first, then what open maps agree on. Every
  // row carries its tier so the planner prefers, and the renderer says, it.
  const allRows = await q.places.findPlannableNear(pool, input.lat, input.lon, 5000, undefined);
  const { skipBeaches, notes } = contextNotes(ctx, lang);
  const rows = skipBeaches ? allRows.filter((r) => r.category !== 'beach_water') : allRows;
  const withNotes = notes.length ? { notes } : {};
  const tierFor = (r: (typeof rows)[number]) => tierOf(r.verification_status, r.witness_count, r.corroboration ?? 0);
  const places = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        landmarkDescription: r.landmark_description,
        category: r.category,
        tier: tierFor(r),
        corroboration: r.corroboration ?? 0,
        verifiedAt: r.verified_at ?? null,
        spotterName: r.spotter_name ?? null,
        // A phone is spoken only once a local confirmed it; a public listing
        // is shown on the sheet as public, never read out as fact.
        ...(r.contact_confirmed_at && r.public_phone ? { phone: r.public_phone } : {}),
      },
    ]),
  );
  const verifiedRows = rows.filter((r) => tierFor(r) === 'verified');

  // The conversation turn: a concrete ask the lexicon knows goes straight
  // through; anything else gets one concierge call that chats, clarifies,
  // or hands a plain query to the pipeline. It can never cite a place.
  const byCategoryAll = new Map<string, number>();
  for (const r of rows) byCategoryAll.set(r.category, (byCategoryAll.get(r.category) ?? 0) + 1);
  const turn = await converse(opts.inference, {
    text: input.text,
    language: input.language,
    history: input.history ?? [],
    hasOpenRefusal: !!input.lastQuestionId,
    coverage: { verifiedNearby: verifiedRows.length, byCategory: byCategoryAll },
    placeNames: rows.map((r) => r.name),
    ...(ctx ? { now: contextLine(ctx) } : {}),
    ...(area ? { about: aboutLine(area, lang) } : {}),
  });
  if (turn.mode === 'chat') {
    return { kind: 'chat', text: turn.reply, placeIds: [], ...withCtx };
  }
  if (turn.mode === 'mission' || turn.mode === 'notify') {
    if (!input.lastQuestionId || !input.touristId) {
      return { kind: 'chat', text: turn.reply, placeIds: [] };
    }
    if (turn.mode === 'notify') {
      await pool.query(
        `insert into question_notifications (question_id, tourist_id) values ($1, $2) on conflict do nothing`,
        [input.lastQuestionId, input.touristId],
      );
      return { kind: 'notify', text: turn.reply, placeIds: [] };
    }
    const { requestMission } = await import('./missionRequest.js');
    const m = await requestMission(pool, input.lastQuestionId, input.touristId);
    return {
      kind: 'mission', text: turn.reply, placeIds: [],
      mission: {
        status: m.status, questionId: input.lastQuestionId,
        ...('spotterName' in m ? { spotterName: m.spotterName, expiresAt: m.expiresAt } : {}),
      },
    };
  }
  const askText = turn.askText?.trim() || input.text;
  const nowMin = localNowMin(area?.timezone);
  const planForTomorrow = nowMin >= 17 * 60 && /plan|day|día|dia|itinerar/i.test(askText);
  const spoken = guessLang(input.text, lang);
  // The rain that matters is the rain of the day being planned.
  const rainHours = ctx?.weather ? (planForTomorrow ? ctx.weather.rainByHourTomorrow : ctx.weather.rainByHour) ?? null : null;
  const rainLine = rainHours ? rainWindowsLine(rainHours) : null;
  const rain = rainLine && rainHours ? { windows: rainLine, wetHours: rainWindows(rainHours).flatMap((w) => Array.from({ length: w.to - w.from }, (_, i) => w.from + i)) } : null;
  const lead = turn.via === 'model' && turn.reply.trim() ? { lead: turn.reply.trim() } : {};

  // Intent, coverage, fast path, single-topic filter, guarded model path and
  // the render-boundary re-mint all live in answerFromCatalog, which the
  // benchmark runs on a fixed catalog. Same code, so the score means this.
  const outcome = await answerFromCatalog({
    text: askText,
    language: input.language,
    lat: input.lat,
    lon: input.lon,
    places: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      landmarkDescription: r.landmark_description,
      lat: r.lat,
      lon: r.lon,
      verificationStatus: r.verification_status,
      witnessCount: r.witness_count,
      tier: tierFor(r),
      corroboration: r.corroboration ?? 0,
      subcategory: r.public_subcategory ?? null,
    })),
    inference: opts.inference,
    minCandidates: opts.minCandidates,
    // After 17:00 "plan my day" means tomorrow: a whole day from the
    // morning, said so in the header. Before that, the day left from now.
    nowMin: planForTomorrow ? 8 * 60 : nowMin,
    ...(rain ? { rain } : {}),
  });

  // The concierge asked a question but chose 'ask', and the pipeline could
  // not place the text either: that turn is a question to the traveller,
  // not a refusal. Nothing is lost (an unclear text is not demand).
  if (
    outcome.kind === 'refusal' && outcome.reason === 'UNCLEAR_QUESTION' &&
    turn.via === 'model' && /\?\s*$/.test(turn.reply.trim())
  ) {
    return { kind: 'chat', text: turn.reply.trim(), placeIds: [], ...withCtx };
  }

  const category = outcome.category ?? extractIntent(askText).category;
  if (outcome.kind === 'refusal') {
    // The refusal itself is the demand record: the question row written here
    // is what the gap agent clusters on. Unrecorded means never commissioned.
    const questionId = await record(false, category, [], outcome.reason);
    const byCategory = new Map<string, number>();
    for (const r of rows) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
    const understood = outcome.reason === 'UNCLEAR_QUESTION' ? null : category;
    // Guaca says the refusal itself; the fixed line only when the model is
    // down or named something. The lead sentence would double up, so it goes.
    const narrated = await narrateRefusal(opts.inference, {
      text: input.text,
      language: input.language,
      history: input.history ?? [],
      reason: outcome.reason,
      category: understood,
      coverage: { verifiedNearby: verifiedRows.length, inCategory: understood ? (byCategory.get(understood) ?? 0) : 0 },
      placeNames: rows.map((r) => r.name),
      ...(ctx ? { now: contextLine(ctx) } : {}),
      ...(area ? { about: aboutLine(area, lang) } : {}),
    });
    return {
      kind: 'refusal',
      text: narrated ?? REFUSAL_TEXT[guessLang(input.text, input.language === 'es' ? 'es' : 'en')]!,
      placeIds: [],
      ...(narrated ? {} : lead),
      ...withNotes,
      ...withCtx,
      ...(questionId ? { questionId } : {}),
      refusal: {
        reason: outcome.reason,
        category: understood,
        coverage: { verifiedNearby: rows.length, inCategory: understood ? (byCategory.get(understood) ?? 0) : 0 },
        ...(narrated ? { spoken: true } : {}),
        options: refusalOptions({
          language: input.language, reason: outcome.reason, category: understood,
          verifiedNearby: rows.length, inCategory: understood ? (byCategory.get(understood) ?? 0) : 0, byCategory,
        }),
      },
    };
  }

  const ids = outcome.placeIds;
  const questionId = await record(true, category, ids, null);
  await recordUnverifiedStops(pool, input, rows.filter((r) => ids.includes(r.id) && tierFor(r) !== 'verified'));
  const sugg = await followUps(ids);
  const travelled = await applyTravel(outcome.artifact, new Map(rows.map((r) => [r.id, { lat: r.lat, lon: r.lon }])), opts.router ?? estimatingRouter());
  return {
    kind: 'answer',
    text: renderItinerary(travelled.artifact, places, spoken, { tomorrow: planForTomorrow, legs: travelled.legs }),
    placeIds: ids,
    ...lead,
    ...withNotes,
    ...withCtx,
    ...(questionId ? { questionId } : {}),
    ...(sugg ? { suggestions: sugg } : {}),
  };
}

export interface TripResult {
  kind: 'trip' | 'refusal';
  text: string;
  placeIds: string[];
  /** Present on success — the saved, shareable trip. */
  trip?: Trip;
  questionId?: string;
}

/**
 * Deterministic catalog ranking: blend where a place is (distance rank,
 * which findVerifiedNear already computed) with how much recorded demand
 * and engagement it has (trend rank). The guard only cares about catalog
 * MEMBERSHIP, so ranking cannot weaken grounding — but it decides which
 * verified places the model is even offered, which is the honest way to
 * make "trending" mean something without letting the model freestyle.
 */
export function rankCatalog(
  rows: readonly PlaceRow[],
  trendScores: ReadonlyMap<string, number>,
  interests: readonly string[],
): PlaceRow[] {
  // rows arrive distance-ordered (rank 0 = nearest).
  const distRank = new Map(rows.map((r, i) => [r.id, i]));
  const byTrend = [...rows].sort(
    (a, b) => (trendScores.get(b.id) ?? 0) - (trendScores.get(a.id) ?? 0),
  );
  const trendRank = new Map(byTrend.map((r, i) => [r.id, i]));
  const interestSet = new Set(interests);

  return [...rows]
    .map((r) => {
      const blend =
        0.6 * (distRank.get(r.id) ?? rows.length) +
        0.4 * (trendRank.get(r.id) ?? rows.length);
      // A stated interest lifts a place without ever hiding the rest.
      const lift = interestSet.has(r.category) ? -rows.length : 0;
      return { row: r, score: blend + lift };
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.row);
}

/** Keep at most `maxPerDay` stops of each day, earliest first — deterministic. */
function trimToPace(stops: TripStop[], pace: TripPace): TripStop[] {
  const maxPerDay = PACE_STOPS_PER_DAY[pace];
  const kept = new Map<number, TripStop[]>();
  for (const s of [...stops].sort((a, b) => a.startMin - b.startMin)) {
    const day = kept.get(s.dayIndex) ?? [];
    if (day.length < maxPerDay) {
      day.push(s);
      kept.set(s.dayIndex, day);
    }
  }
  // Restore the artifact's original ordering (day, then time).
  return stops.filter((s) => {
    const day = kept.get(s.dayIndex) ?? [];
    return day.includes(s);
  });
}

/**
 * The trip path: the same guarded pipeline as ask(), shaped by days and
 * pace, ranked by distance × trend, saved as a shareable trip. Every exit
 * records the question — a refused trip request is as much a demand signal
 * as a refused ask.
 */
export async function planTrip(
  pool: Pool,
  input: {
    touristId: string;
    text: string;
    language: string;
    lat: number;
    lon: number;
    days: number;
    pace: TripPace;
    interests?: readonly string[];
  },
  opts: { minCandidates: number; inference: Inference; router?: Router },
): Promise<TripResult> {
  const intent = extractIntent(input.text);
  let resolvedCategory: string | null = null;

  const record = async (
    answered: boolean,
    placeIds: string[],
    refusalReason: string | null,
  ): Promise<string | undefined> => {
    try {
      const rec = await recordQuestion(pool, {
        rawText: input.text,
        language: input.language,
        category: intent.category,
        lat: input.lat,
        lon: input.lon,
        answered,
        answerPlaceIds: placeIds,
        refusalReason,
      });
      return rec.questionId;
    } catch {
      return undefined;
    }
  };

  const refuse = async (reason: string): Promise<TripResult> => {
    const questionId = await record(false, [], reason);
    return {
      kind: 'refusal',
      text: REFUSAL_TEXT[input.language] ?? REFUSAL_TEXT.en!,
      placeIds: [],
      ...(questionId ? { questionId } : {}),
    };
  };

  if (!classifiesIntent(input.text)) {
    resolvedCategory = await classifyWithModel(opts.inference, input.text);
    if (!resolvedCategory) return refuse('UNCLEAR_QUESTION');
    intent.category = resolvedCategory as typeof intent.category;
  }

  const rows = await q.places.findPlannableNear(pool, input.lat, input.lon, 5000, undefined);
  const verifiedIds = new Set(rows.map((r) => r.id));
  const tierFor = (r: (typeof rows)[number]) => tierOf(r.verification_status, r.witness_count, r.corroboration ?? 0);

  if (rows.length < opts.minCandidates) {
    return refuse('INSUFFICIENT_COVERAGE');
  }

  const trends = await trendsForPlaces(pool, rows.map((r) => r.id));
  const trendScores = new Map(
    [...trends.entries()].map(([id, t]) => [id, t.score] as const),
  );
  const catalogRows = rankCatalog(rows, trendScores, input.interests ?? []).slice(0, 24);

  const outcome = await runGroundedPlanner({
    text: input.text,
    language: input.language,
    rows: catalogRows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      verificationStatus: r.verification_status,
      witnessCount: r.witness_count,
      tier: tierFor(r),
      corroboration: r.corroboration ?? 0,
      subcategory: r.public_subcategory ?? null,
    })),
    days: input.days,
    inference: opts.inference,
    onGap: () => undefined,
  });

  if (outcome.kind !== 'PlanArtifact') {
    return refuse(outcome.kind === 'RefusalArtifact' ? outcome.reason : 'PLANNER_ERROR');
  }

  const stops: TripStop[] = outcome.artifact.stops.map((s) => ({
    placeId: s.placeId,
    dayIndex: s.dayIndex,
    startMin: s.startMin,
    durationMin: s.durationMin,
    reasonCode: TripReasonCode.parse(s.reasonCode),
  }));
  // Pace trim, then the render-boundary re-mint against the verified set.
  const trimmed = trimToPace(stops, input.pace);
  if (trimmed.length === 0) return refuse('NO_GROUNDED_STOPS');
  const artifact = groundFromVerifiedRows(
    trimmed.map((s) => ({ ...s })),
    verifiedIds,
  );
  const ids = [...artifact.placeIds];
  await recordUnverifiedStops(pool, input, rows.filter((r) => ids.includes(r.id) && tierFor(r) !== 'verified'));
  const travelled = await applyTravel(artifact, new Map(rows.map((r) => [r.id, { lat: r.lat, lon: r.lon }])), opts.router ?? estimatingRouter());

  const places = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        landmarkDescription: r.landmark_description,
        category: r.category,
        tier: tierFor(r),
        corroboration: r.corroboration ?? 0,
        verifiedAt: r.verified_at ?? null,
        spotterName: r.spotter_name ?? null,
      },
    ]),
  );

  let trip: Trip | undefined;
  try {
    trip = await createTrip(pool, {
      touristId: input.touristId,
      question: input.text,
      language: input.language,
      stops: trimmed,
    });
  } catch {
    // The trip is the bonus, not the answer — a failed save must not cost
    // the guest their plan.
  }

  const questionId = await record(true, ids, null);
  return {
    kind: 'trip',
    text: renderItinerary(travelled.artifact, places, guessLang(input.text, input.language === 'es' ? 'es' : 'en'), { legs: travelled.legs }),
    placeIds: ids,
    ...(trip ? { trip } : {}),
    ...(questionId ? { questionId } : {}),
  };
}
