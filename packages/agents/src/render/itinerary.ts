import { tierWords, type PlaceTier } from '@guaca/shared';
import type { PlanArtifact } from '../guard/assertGrounded.js';

/**
 * A place as the renderer sees it — from DB rows, never from the model.
 */
export interface RenderPlace {
  id: string;
  name: string;
  landmarkDescription: string;
  category: string;
  /** Only when a local confirmed it in person; public listing data never rides here. */
  phone?: string | null;
  /** Tiered honesty; absent renders as verified, which is what every caller before tiers meant. */
  tier?: PlaceTier;
  corroboration?: number;
  verifiedAt?: string | null;
  spotterName?: string | null;
}

/**
 * NOTE: the renderer deliberately accepts ONLY the branded PlanArtifact, not a
 * structural equivalent. Widening this to a plain {placeIds, stops} interface
 * defeats the brand entirely: the chain is model output → guard → branded
 * artifact → renderer, and if the last link accepts any object shape then
 * nothing stops unverified content reaching a guest. Callers that legitimately
 * build a plan from deterministic code (the fast path) mint one through
 * `groundFromVerifiedRows`, which re-checks every id against the verified set.
 */

interface Template {
  stop: (name: string, start: string, reason: string) => string;
  day: (n: number) => string;
  header: string;
  headerTomorrow: string;
  footer: string;
  reasons: Record<string, string>;
}

const TEMPLATES: Record<string, Template> = {
  en: {
    header: 'Here is your plan:',
    headerTomorrow: 'Here is your plan for tomorrow:',
    footer: 'Every stop says how much is known about it.',
    stop: (name, start, reason) => `${start} — ${name} (${reason})`,
    day: (n) => `Day ${n}`,
    reasons: { NEAREST: 'closest to you', OPEN_NOW: 'open now', MATCHES_TOPIC: 'what you asked for', BEST_RATED: 'a favourite', AVOID_CLOSED: 'fits the timing', SEQUENCE_FIT: 'on the way' },
  },
  es: {
    header: 'Este es tu plan:',
    headerTomorrow: 'Este es tu plan para mañana:',
    footer: 'Cada parada dice cuánto se sabe de ella.',
    stop: (name, start, reason) => `${start} — ${name} (${reason})`,
    day: (n) => `Día ${n}`,
    reasons: { NEAREST: 'lo más cerca', OPEN_NOW: 'abierto ahora', MATCHES_TOPIC: 'lo que pediste', BEST_RATED: 'un favorito', AVOID_CLOSED: 'encaja en el horario', SEQUENCE_FIT: 'de camino' },
  },
};

/** "25 min by car", "8 min on foot", "by boat, ask a local"; an estimate says so. */
function legWords(leg: { minutes: number; mode: 'foot' | 'car' | 'boat'; estimated: boolean }, lang: string): string {
  const es = lang === 'es';
  if (leg.mode === 'boat') return es ? `en lancha, pregunta a un local (unos ${leg.minutes} min)` : `by boat, ask a local (about ${leg.minutes} min)`;
  const mode = leg.mode === 'foot' ? (es ? 'a pie' : 'on foot') : es ? 'en carro' : 'by car';
  const est = leg.estimated ? (es ? ', estimado' : ', estimate') : '';
  return `${leg.minutes} min ${mode}${est}`;
}

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * P3 — prose is rendered from database rows by a pure function. The model
 * chooses ordering and timing only; every word a tourist reads comes from
 * here, reading names from DB rows exclusively. A model-supplied string can
 * never reach the output.
 */
export function renderItinerary(
  artifact: PlanArtifact,
  places: ReadonlyMap<string, RenderPlace>,
  lang: string,
  opts: { tomorrow?: boolean; legs?: ReadonlyMap<string, { minutes: number; mode: 'foot' | 'car' | 'boat'; estimated: boolean }> } = {},
): string {
  const t = TEMPLATES[lang] ?? TEMPLATES.en!;
  // Single-day plans render exactly as they always have — no day header.
  // A day header only appears when the plan actually spans days.
  const multiDay = artifact.stops.some((s) => s.dayIndex > 0);
  const lines = [opts.tomorrow && !multiDay ? t.headerTomorrow : t.header];
  let unverified = false;
  const days = [...new Set(artifact.stops.map((s) => s.dayIndex))].sort((a, b) => a - b);
  for (const day of days) {
    if (multiDay) {
      lines.push('');
      lines.push(t.day(day + 1));
    }
    let prevId: string | null = null;
    for (const stop of [...artifact.stops.filter((s) => s.dayIndex === day)].sort((a, b) => a.startMin - b.startMin)) {
      const leg = prevId ? opts.legs?.get(`${prevId}>${stop.placeId}`) : undefined;
      if (leg) lines.push(`   ↳ ${legWords(leg, lang)}`);
      prevId = stop.placeId;
      const place = places.get(stop.placeId);
      // Fail closed. A grounded artifact passed the step-6 re-read, so a missing
      // row means the caller supplied a mismatched map — silently dropping the
      // stop would hand the guest a shorter plan than the one that was verified.
      if (!place) {
        throw new Error(
          `renderItinerary: no verified DB row for placeId ${stop.placeId}`,
        );
      }
      const tier = place.tier ?? 'verified';
      lines.push(
        t.stop(place.name, fmt(stop.startMin), t.reasons[stop.reasonCode] ?? stop.reasonCode) +
          (place.phone ? ` · tel ${place.phone}` : '') +
          ` · ${tierWords(tier, lang, { corroboration: place.corroboration ?? 0, verifiedAt: place.verifiedAt ?? null, spotter: place.spotterName ?? null })}`,
      );
      if (tier !== 'verified') unverified = true;
    }
  }
  lines.push(unverified ? (lang === 'es' ? 'Las paradas sin verificar vienen de mapas abiertos; un local puede confirmarlas.' : 'Unverified stops come from open maps; a local can confirm them.') : t.footer);
  return lines.join('\n');
}
