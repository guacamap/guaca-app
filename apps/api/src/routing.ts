/**
 * Travel between stops. Honest about what it knows: a road time from an
 * OSRM-compatible router when one answers, a straight-line estimate when it
 * does not, and "by boat" when the road network cannot connect two points
 * at all (an island stop). Live traffic is never claimed; there is no open
 * feed for it here, and a guess in Guaca's voice would be a lie.
 *
 * ROUTING_URL points at any OSRM server (self-hosted, or the public demo
 * for light use). Unset, every leg is an estimate and says so.
 */
export type TravelMode = 'foot' | 'car' | 'boat';

export interface Leg {
  minutes: number;
  mode: TravelMode;
  /** True when no router answered and the number is a straight-line guess. */
  estimated: boolean;
  distanceKm: number;
}

export interface Router {
  legs(points: ReadonlyArray<{ lat: number; lon: number }>): Promise<Leg[]>;
}

const WALK_KMH = 4.5;
const DRIVE_KMH = 30;
const BOAT_KMH = 15;
const WALK_MAX_KM = 1.5;

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function estimateLeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): Leg {
  const km = haversineKm(a, b);
  const mode: TravelMode = km <= WALK_MAX_KM ? 'foot' : 'car';
  const kmh = mode === 'foot' ? WALK_KMH : DRIVE_KMH;
  return { minutes: Math.max(1, Math.round((km / kmh) * 60)), mode, estimated: true, distanceKm: km };
}

export function estimatingRouter(): Router {
  return { legs: async (pts) => pts.slice(1).map((p, i) => estimateLeg(pts[i]!, p)) };
}

/**
 * OSRM `table` for consecutive pairs. One request per plan, cached by the
 * rounded coordinates for six hours. A null duration between two points
 * means the road graph does not connect them: that is a boat.
 */
export function osrmRouter(baseUrl: string, fetchImpl: typeof fetch = fetch, cacheMs = 6 * 60 * 60 * 1000): Router {
  const cache = new Map<string, { at: number; legs: Leg[] }>();
  return {
    async legs(pts) {
      if (pts.length < 2) return [];
      const key = pts.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join(';');
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < cacheMs) return hit.legs;
      const fallback = estimatingRouter();
      try {
        const coords = pts.map((p) => `${p.lon},${p.lat}`).join(';');
        const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/table/v1/driving/${coords}?annotations=duration,distance`, {
          headers: { 'user-agent': 'guaca-app/1.0 (hola@guaca.live)' },
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return fallback.legs(pts);
        const j = (await res.json()) as { code: string; durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>> };
        if (j.code !== 'Ok' || !j.durations) return fallback.legs(pts);
        const legs: Leg[] = pts.slice(1).map((p, i) => {
          const a = pts[i]!;
          const sec = j.durations![i]?.[i + 1] ?? null;
          const straightKm = haversineKm(a, p);
          if (sec === null) {
            return { minutes: Math.max(5, Math.round((straightKm / BOAT_KMH) * 60)), mode: 'boat', estimated: true, distanceKm: straightKm };
          }
          const roadKm = (j.distances?.[i]?.[i + 1] ?? null) !== null ? j.distances![i]![i + 1]! / 1000 : straightKm;
          // A short hop is walked even if the road time says otherwise.
          if (roadKm <= WALK_MAX_KM) {
            return { minutes: Math.max(1, Math.round((roadKm / WALK_KMH) * 60)), mode: 'foot', estimated: false, distanceKm: roadKm };
          }
          return { minutes: Math.max(1, Math.round(sec / 60)), mode: 'car', estimated: false, distanceKm: roadKm };
        });
        cache.set(key, { at: Date.now(), legs });
        return legs;
      } catch {
        return fallback.legs(pts);
      }
    },
  };
}

export function routerFromEnv(env: NodeJS.ProcessEnv = process.env): Router {
  const url = env.ROUTING_URL?.trim();
  return url ? osrmRouter(url) : estimatingRouter();
}
