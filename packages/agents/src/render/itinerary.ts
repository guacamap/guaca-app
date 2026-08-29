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
  footer: string;
}

const TEMPLATES: Record<string, Template> = {
  en: {
    header: 'Here is your plan:',
    footer: 'Witnessed by local spotters.',
    stop: (name, start, reason) => `${start} — ${name} (${reason})`,
    day: (n) => `Day ${n}`,
  },
  es: {
    header: 'Este es tu plan:',
    footer: 'Verificado por locales.',
    stop: (name, start, reason) => `${start} — ${name} (${reason})`,
    day: (n) => `Día ${n}`,
  },
};

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
): string {
  const t = TEMPLATES[lang] ?? TEMPLATES.en!;
  // Single-day plans render exactly as they always have — no day header.
  // A day header only appears when the plan actually spans days.
  const multiDay = artifact.stops.some((s) => s.dayIndex > 0);
  const lines = [t.header];
  const days = [...new Set(artifact.stops.map((s) => s.dayIndex))].sort((a, b) => a - b);
  for (const day of days) {
    if (multiDay) {
      lines.push('');
      lines.push(t.day(day + 1));
    }
    for (const stop of artifact.stops.filter((s) => s.dayIndex === day)) {
      const place = places.get(stop.placeId);
      // Fail closed. A grounded artifact passed the step-6 re-read, so a missing
      // row means the caller supplied a mismatched map — silently dropping the
      // stop would hand the guest a shorter plan than the one that was verified.
      if (!place) {
        throw new Error(
          `renderItinerary: no verified DB row for placeId ${stop.placeId}`,
        );
      }
      lines.push(t.stop(place.name, fmt(stop.startMin), stop.reasonCode) + (place.phone ? ` · tel ${place.phone}` : ''));
    }
  }
  lines.push(t.footer);
  return lines.join('\n');
}
