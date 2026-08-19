'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';

interface TripStop {
  placeId: string;
  dayIndex: number;
  startMin: number;
  durationMin: number;
  reasonCode: string;
}

interface Trip {
  id: string;
  question: string;
  language: string;
  stops: TripStop[];
  shareSlug: string;
  createdAt: string;
}

interface PlaceLite {
  id: string;
  name: string;
  category: string;
  landmark_description: string | null;
  spotter_name: string | null;
  verified_at: string | null;
}

const CATEGORY_GLYPH: Record<string, string> = {
  eat_drink: '🍛',
  beach_water: '🐚',
  nature_walk: '🌿',
  culture_history: '🏛️',
  market_shop: '🧺',
  services: '🔧',
  nightlife_music: '🎶',
  practical: '🧭',
};

function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * The public trip share — what a WhatsApp recipient opens. No account, no
 * write path: the stops are guard-minted verified places, and the page is
 * read-only by construction.
 */
export default function SharedTripPage() {
  const params = useParams<{ slug: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [places, setPlaces] = useState<Record<string, PlaceLite>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'gone'>('loading');

  useEffect(() => {
    if (!params.slug) return;
    fetch(`/api/t/${params.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { trip: Trip } | null) => {
        if (!d) {
          setState('gone');
          return;
        }
        setTrip(d.trip);
        setState('ready');
        // Resolve the (few) distinct places the trip cites.
        const ids = [...new Set(d.trip.stops.map((s) => s.placeId))];
        return Promise.all(
          ids.map((id) =>
            fetch(`/api/places/${id}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((p: PlaceLite | null) => {
                if (p) setPlaces((prev) => ({ ...prev, [id]: p }));
              })
              .catch(() => {}),
          ),
        );
      })
      .catch(() => setState('gone'));
  }, [params.slug]);

  if (state === 'loading') {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#F7FAF8]">
        <p className="text-sm font-bold text-[#17272B]/50">…</p>
      </main>
    );
  }

  if (state === 'gone' || !trip) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#F7FAF8] px-6">
        <div className="text-center">
          <p className="text-4xl">🦜</p>
          <h1 className="mt-3 text-lg font-black text-[#17272B]">
            {trip?.language === 'es' ? 'Este viaje ya no está disponible' : 'This trip is no longer available'}
          </h1>
          <p className="mt-1 text-xs font-semibold text-[#17272B]/50">
            {trip?.language === 'es'
              ? 'Quien lo compartió lo eliminó de su cuenta.'
              : 'The traveller who shared it deleted it from their account.'}
          </p>
        </div>
      </main>
    );
  }

  const es = trip.language === 'es';
  const days = [...new Set(trip.stops.map((s) => s.dayIndex))].sort((a, b) => a - b);

  return (
    <main className="min-h-dvh bg-[#F7FAF8] px-4 pb-10 pt-8">
      <div className="mx-auto max-w-md">
        <p className="text-center text-[10px] font-black uppercase tracking-[.16em] text-[#0D7A72]">
          Guaca
        </p>
        <h1 className="mt-2 text-center text-xl font-black leading-snug text-[#17272B]">
          {es ? 'Un viaje verificado por locales' : 'A trip verified by locals'}
        </h1>
        <p className="mt-1 text-center text-[12px] font-semibold italic leading-relaxed text-[#17272B]/55">
          “{trip.question}”
        </p>

        {days.map((d) => (
          <section key={d} className="mt-5">
            <p className="px-1 text-[10px] font-black uppercase tracking-[.12em] text-[#0D7A72]">
              {es ? 'Día' : 'Day'} {d + 1}
            </p>
            <div className="mt-2 space-y-2">
              {trip.stops
                .filter((s) => s.dayIndex === d)
                .sort((a, b) => a.startMin - b.startMin)
                .map((s, i) => {
                  const p = places[s.placeId];
                  return (
                    <div
                      key={`${s.placeId}-${i}`}
                      className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5"
                    >
                      <span className="text-[11px] font-black tabular-nums text-[#17272B]/40">
                        {fmt(s.startMin)}
                      </span>
                      <span className="text-xl">{p ? CATEGORY_GLYPH[p.category] ?? '📍' : '📍'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-[#17272B]">
                          {p?.name ?? '…'}
                        </p>
                        {p?.landmark_description && (
                          <p className="truncate text-[11px] font-semibold text-[#17272B]/50">
                            {p.landmark_description}
                          </p>
                        )}
                        {p?.spotter_name && (
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-[#0D7A72]">
                            <BadgeCheck className="h-3 w-3" /> {p.spotter_name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}

        <p className="mt-8 text-center text-[10px] font-bold text-[#17272B]/40">
          {es
            ? 'Cada parada fue visitada y confirmada por dos locales con nombre. Testimonio, no invención.'
            : 'Every stop was visited and confirmed by two named locals. Witnessed, not inferred.'}
        </p>
        <a
          href="/"
          className="mx-auto mt-4 block w-fit rounded-full bg-[#0D7A72] px-5 py-2.5 text-[11px] font-black text-white"
        >
          {es ? 'Abrir Guaca' : 'Open Guaca'}
        </a>
      </div>
    </main>
  );
}
