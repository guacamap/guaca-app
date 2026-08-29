import type { Pool } from 'pg';
import {
  answerFromCatalog,
  converse,
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
import { contextLine, type AreaContext, type ContextProvider } from './context.js';

export interface AreaRow { id: string; slug: string; name: string; country: string; timezone: string; lat: number; lon: number }

/** The area a point falls in, with its centroid; null outside every area. */
export async function areaAt(pool: Pool, lat: number, lon: number): Promise<AreaRow | null> {
  const r = await pool.query<AreaRow>(
    `select id, slug, name, country, timezone,
            ST_Y(ST_Centroid(geom::geometry)) as lat, ST_X(ST_Centroid(geom::geometry)) as lon
       from areas where ST_Covers(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) limit 1`,
    [lat, lon],
  );
  return r.rows[0] ?? null;
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
  es: 'Nadie ha verificado lugares para eso todavía.',
  en: 'No one has verified places for that yet.',
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
  opts: { minCandidates: number; inference: import('@guaca/agents').Inference; contextProvider?: ContextProvider },
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

  const allRows = await q.places.findVerifiedNear(pool, input.lat, input.lon, 5000, undefined);
  const { skipBeaches, notes } = contextNotes(ctx, lang);
  const rows = skipBeaches ? allRows.filter((r) => r.category !== 'beach_water') : allRows;
  const withNotes = notes.length ? { notes } : {};
  const places = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        landmarkDescription: r.landmark_description,
        category: r.category,
        // A phone is spoken only once a local confirmed it; a public listing
        // is shown on the sheet as public, never read out as fact.
        ...(r.contact_confirmed_at && r.public_phone ? { phone: r.public_phone } : {}),
      },
    ]),
  );

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
    coverage: { verifiedNearby: rows.length, byCategory: byCategoryAll },
    placeNames: rows.map((r) => r.name),
    ...(ctx ? { now: contextLine(ctx) } : {}),
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
    })),
    inference: opts.inference,
    minCandidates: opts.minCandidates,
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
    return {
      kind: 'refusal',
      text: REFUSAL_TEXT[input.language] ?? REFUSAL_TEXT.en!,
      placeIds: [],
      ...lead,
      ...withNotes,
      ...withCtx,
      ...(questionId ? { questionId } : {}),
      refusal: {
        reason: outcome.reason,
        category: understood,
        coverage: { verifiedNearby: rows.length, inCategory: understood ? (byCategory.get(understood) ?? 0) : 0 },
        options: refusalOptions({
          language: input.language, reason: outcome.reason, category: understood,
          verifiedNearby: rows.length, inCategory: understood ? (byCategory.get(understood) ?? 0) : 0, byCategory,
        }),
      },
    };
  }

  const ids = outcome.placeIds;
  const questionId = await record(true, category, ids, null);
  const sugg = await followUps(ids);
  return {
    kind: 'answer',
    text: renderItinerary(outcome.artifact, places, input.language),
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
  opts: { minCandidates: number; inference: Inference },
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

  const rows = await q.places.findVerifiedNear(pool, input.lat, input.lon, 5000, undefined);
  const verifiedIds = new Set(rows.map((r) => r.id));

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

  const places = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        landmarkDescription: r.landmark_description,
        category: r.category,
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
    text: renderItinerary(artifact, places, input.language),
    placeIds: ids,
    ...(trip ? { trip } : {}),
    ...(questionId ? { questionId } : {}),
  };
}
