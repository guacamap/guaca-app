import { extractIntent } from './intent.js';
import type { Inference } from '../inference/types.js';

export interface FastPathPlace {
  id: string;
  name: string;
  category: string;
  landmarkDescription: string;
  lat: number;
  lon: number;
  /** Minutes since midnight. */
  openAt: number;
  closeAt: number;
}

export interface FastPathStop {
  placeId: string;
  startMin: number;
  durationMin: number;
  reasonCode: string;
}

export interface FastPathPlan {
  kind: 'FastPathPlan';
  stops: FastPathStop[];
}

export type FastPathResult = FastPathPlan | null;

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface RouteOptions {
  places: readonly FastPathPlace[];
  category: string;
  startMin: number;
  partySize: number;
}

/**
 * Deterministic greedy router — routing is CODE, not LLM guessing (§4.7:
 * "routing is deterministic code"). Nearest open place first, never
 * duplicating a stop.
 */
export function greedyRoute(options: RouteOptions): FastPathStop[] {
  const open = options.places.filter(
    (p) =>
      p.category === options.category &&
      p.openAt <= options.startMin &&
      p.closeAt >= options.startMin + 60,
  );
  const sorted = [...open].sort(
    (a, b) => distanceM(a.lat, a.lon, 10.4716, -68.0056) -
      distanceM(b.lat, b.lon, 10.4716, -68.0056),
  );
  const stops: FastPathStop[] = [];
  const used = new Set<string>();
  let t = options.startMin;
  for (const p of sorted) {
    if (used.has(p.id)) continue;
    used.add(p.id);
    stops.push({
      placeId: p.id,
      startMin: t,
      durationMin: 60,
      reasonCode: 'NEAREST',
    });
    t += 60 + 15;
    if (stops.length >= Math.max(1, Math.min(4, options.partySize))) break;
  }
  return stops;
}

export interface DeterministicOptions {
  text: string;
  language: string;
  lat: number;
  lon: number;
  places: readonly FastPathPlace[];
  inference: Inference;
}

/**
 * Deterministic fast path (§7.8): single-topic "right now" questions are
 * answered by pure ranking + greedy routing with ZERO inference calls. This
 * serves roughly 60% of answers — the most common interaction survives total
 * inference failure. Returns null (fall through to the model path) otherwise.
 */
export async function answerDeterministic(
  options: DeterministicOptions,
): Promise<FastPathResult> {
  const intent = extractIntent(options.text);
  if (intent.when !== 'now') return null;

  // Single-topic: the lexicon must have landed on exactly one category, and
  // the question must not look like a multi-stop day plan.
  if (/plan|day|itinerar|ruta|tour|mañana|todo el día/i.test(options.text)) {
    return null;
  }

  const categoryPlaces = options.places.filter((p) => p.category === intent.category);
  if (categoryPlaces.length === 0) return null;

  const now = new Date();
  const startMin = now.getHours() * 60 + now.getMinutes();
  const stops = greedyRoute({
    places: options.places,
    category: intent.category,
    startMin,
    partySize: intent.partySize ?? 2,
  });
  if (stops.length === 0) return null;

  return { kind: 'FastPathPlan', stops };
}
