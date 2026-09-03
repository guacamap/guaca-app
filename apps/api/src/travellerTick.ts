import type { Pool } from 'pg';
import { speakFirst, type Inference } from '@guaca/agents';
import { getTravellerState, guacaSpoke, heardFromTraveller, spokenToday, travellersToTick, type TravellerState } from '@guaca/db';
import { contextLine, rainWindows, type ContextProvider } from './context.js';
import { aboutLine, areaAt, contextFor, ask } from './plannerService.js';
import type { Router } from './routing.js';

/**
 * Guaca speaks first. Every fifteen minutes each traveller heard from in
 * the last two days, or with a plan today, is looked at against a short
 * list of triggers. A trigger that fires writes one message to their
 * inbox, in Guaca's voice, naming the reason. Three unprompted messages a
 * day at most, none between 22:00 and 08:00 local, never the same trigger
 * twice for the same day. The tick never invents a reason to talk.
 */
export interface TickDeps {
  pool: Pool;
  inference: Inference;
  contextProvider?: ContextProvider;
  router?: Router;
  minCandidates: number;
}

const OPEN_AIR = new Set(['beach_water', 'nature_walk', 'market_shop']);
const DAILY_CAP = 3;

const LINES = {
  morning_plan: {
    en: (rain: string | null) => `Morning. Want me to plan today?${rain ? ` Rain is likely ${rain}, so the open-air stops go outside those hours.` : ''}`,
    es: (rain: string | null) => `Buenos días. ¿Te armo el día?${rain ? ` Es probable que llueva ${rain}, así que lo de aire libre va fuera de esas horas.` : ''}`,
  },
  rain_replan: {
    en: (stop: string, when: string) => `Rain now looks likely around ${when}, right when you had ${stop}. I moved things so it stays dry; the new order is below.`,
    es: (stop: string, when: string) => `Ahora parece que llueve hacia las ${when}, justo cuando tenías ${stop}. Reordené para que te quede seco; el nuevo orden va abajo.`,
  },
  evening_checkin: {
    en: `How did today go? Tap each stop: it was good, it was not there, or you skipped it. It is the first thing that teaches me.`,
    es: `¿Cómo te fue hoy? Toca cada parada: estuvo bien, no existía, o la saltaste. Es lo primero que me enseña.`,
  },
  storm: {
    en: (name: string, km: number) => `A storm alert is up: ${name}, about ${km} km from you. No beach today; follow the official word and tell me if you need to change plans.`,
    es: (name: string, km: number) => `Hay alerta de tormenta: ${name}, a unos ${km} km. Nada de playa hoy; sigue la palabra oficial y dime si hay que cambiar el plan.`,
  },
};

function localMinutes(localTime: string): number {
  return Number(localTime.slice(11, 13)) * 60 + Number(localTime.slice(14, 16));
}

function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

const WELCOME = {
  en: (first: boolean) => (first ? 'Hey, I am Guaca. I live around here, and when I point you somewhere it is because a local actually went and stood there. What are you in the mood for today?' : 'Hey, welcome back. What is today about?'),
  es: (first: boolean) => (first ? 'Hola, soy Guaca. Vivo por aquí, y cuando te mando a un sitio es porque un local fue y estuvo ahí de verdad. ¿Qué te provoca hoy?' : 'Hola, qué bueno verte de nuevo. ¿De qué va el día de hoy?'),
};

/**
 * The first thing a traveller reads is Guaca, not a card. Once a day per
 * traveller; the sentence comes from the town, the weather right now and
 * what Guaca remembers, through the same guard as everything else. The
 * fixed line is the fallback and the model's version replaces it.
 */
export async function welcome(
  pool: Pool,
  input: { touristId: string; lat: number; lon: number; language: 'en' | 'es' },
  deps: { inference: Inference; contextProvider?: ContextProvider },
): Promise<{ id: string; trigger: 'welcome'; text: string } | null> {
  const area = await areaAt(pool, input.lat, input.lon);
  const ctx = await contextFor(deps.contextProvider, area, input.lat, input.lon);
  const nowMin = ctx ? localMinutes(ctx.localTime) : 12 * 60;
  const state = await getTravellerState(pool, input.touristId);
  const said = await spokenToday(pool, input.touristId, nowMin);
  if (said.triggers.includes('welcome')) return null;
  const returning = !!state?.lastHeardAt;
  const fallback = WELCOME[input.language](!returning);
  const reason = returning
    ? 'The traveller just opened the conversation again. Greet them like a friend who remembers them and ask what today is about.'
    : 'The traveller just opened the conversation for the first time. Introduce yourself by name (Guaca) in one breath: you live here, and when you point somewhere it is because a local actually went and stood there; then ask what they are in the mood for today. Warm, short, no sales pitch.';
  // The first hello is Guaca's own definition of itself, said the same way
  // every time; the model is trusted with the return greetings, where what
  // it remembers is the point. (The editor kept trimming the introduction.)
  const text = returning
    ? (await speakFirst(deps.inference, {
        language: input.language, reason, allowedNames: [], remembered: state?.notes ?? [],
        ...(ctx ? { now: contextLine(ctx) } : {}), ...(area ? { about: aboutLine(area, input.language) } : {}),
      })) ?? fallback
    : fallback;
  await heardFromTraveller(pool, input.touristId, { lat: input.lat, lon: input.lon, language: input.language, learned: [] });
  const id = await guacaSpoke(pool, input.touristId, { trigger: 'welcome', text });
  // Handed over in this response; the inbox must not deliver it again.
  await pool.query(`update guaca_messages set delivered_at = now() where id = $1`, [id]);
  return { id, trigger: 'welcome', text };
}

export interface TickResult { looked: number; spoke: Array<{ touristId: string; trigger: string }> }

export async function runTravellerTick(deps: TickDeps): Promise<TickResult> {
  const out: TickResult = { looked: 0, spoke: [] };
  const travellers = await travellersToTick(deps.pool);
  for (const t of travellers) {
    out.looked++;
    try {
      const fired = await tickOne(deps, t);
      if (fired) out.spoke.push({ touristId: t.touristId, trigger: fired });
    } catch {
      // One traveller's failure never silences the others.
    }
  }
  return out;
}

async function tickOne(deps: TickDeps, t: TravellerState): Promise<string | null> {
  if (t.lastLat == null || t.lastLon == null) return null;
  const area = await areaAt(deps.pool, t.lastLat, t.lastLon);
  const ctx = await contextFor(deps.contextProvider, area, t.lastLat, t.lastLon);
  if (!ctx) return null;
  const nowMin = localMinutes(ctx.localTime);
  const today = ctx.localTime.slice(0, 10);
  if (nowMin < 8 * 60 || nowMin >= 22 * 60) return null;

  const said = await spokenToday(deps.pool, t.touristId, nowMin);
  if (said.count >= DAILY_CAP) return null;
  const lang: 'en' | 'es' = t.language === 'es' ? 'es' : 'en';
  const plan = t.activePlan && t.activePlanDate === today ? t.activePlan : null;
  const voice = async (reason: string, fallback: string, allowed: readonly string[]) =>
    (await speakFirst(deps.inference, {
      language: lang, reason, allowedNames: allowed, remembered: t.notes,
      now: contextLine(ctx), ...(area ? { about: aboutLine(area, lang) } : {}),
    })) ?? fallback;

  // 1. Storm: outranks everything, once.
  if (ctx.alert && !said.triggers.includes('storm')) {
    const text = LINES.storm[lang](ctx.alert.name, Math.round(ctx.alert.distanceKm));
    await guacaSpoke(deps.pool, t.touristId, { trigger: 'storm', text });
    return 'storm';
  }

  // 2. Rain moved onto an open-air stop in the next two hours: replan.
  if (plan && ctx.weather?.rainByHour && !said.triggers.includes('rain_replan')) {
    const wet = new Set(rainWindows(ctx.weather.rainByHour).flatMap((w) => Array.from({ length: w.to - w.from }, (_, i) => w.from + i)));
    const threatened = plan.stops.find((s) => OPEN_AIR.has(s.category) && s.startMin > nowMin && s.startMin <= nowMin + 120 && wet.has(Math.floor(s.startMin / 60)));
    if (threatened) {
      const re = await ask(deps.pool, {
        text: `${lang === 'es' ? 'planifica mi día' : 'plan my day'}: ${plan.question}`,
        language: lang, lat: t.lastLat, lon: t.lastLon, touristId: t.touristId,
      }, { minCandidates: deps.minCandidates, inference: deps.inference, ...(deps.contextProvider ? { contextProvider: deps.contextProvider } : {}), ...(deps.router ? { router: deps.router } : {}) });
      if (re.kind === 'answer') {
        const fallback = LINES.rain_replan[lang](threatened.name, fmt(threatened.startMin));
        const text = await voice(`Rain is now likely around ${fmt(threatened.startMin)}, when the traveller had ${threatened.name} (open air). You have already reordered the day so it stays dry; the new plan follows your message.`, fallback, plan.stops.map((s) => s.name));
        await guacaSpoke(deps.pool, t.touristId, { trigger: 'rain_replan', text, payload: { plan: re.text, placeIds: re.placeIds } });
        return 'rain_replan';
      }
    }
  }

  // 3. Morning with no plan for today: offer, once, between 08:00 and 10:30.
  if (!plan && nowMin < 10 * 60 + 30 && !said.triggers.includes('morning_plan') && t.lastHeardAt) {
    const rainLine = ctx.weather?.rainByHour ? rainWindows(ctx.weather.rainByHour).map((w) => `${fmt(w.from * 60)}–${fmt(w.to * 60)}`).join(', ') || null : null;
    const fallback = LINES.morning_plan[lang](rainLine);
    const text = await voice(`It is morning and the traveller has no plan for today. Offer to plan it.${rainLine ? ` Rain is likely ${rainLine}.` : ''}`, fallback, []);
    await guacaSpoke(deps.pool, t.touristId, { trigger: 'morning_plan', text });
    return 'morning_plan';
  }

  // 4. Evening after a plan day: ask how it went, once, after the last stop.
  if (plan && !said.triggers.includes('evening_checkin')) {
    const last = Math.max(...plan.stops.map((s) => s.startMin + s.durationMin));
    if (nowMin >= Math.max(last + 60, 18 * 60)) {
      const text = LINES.evening_checkin[lang];
      await guacaSpoke(deps.pool, t.touristId, { trigger: 'evening_checkin', text, payload: { stops: plan.stops.map((s) => ({ placeId: s.placeId, name: s.name })) } });
      return 'evening_checkin';
    }
  }
  return null;
}


