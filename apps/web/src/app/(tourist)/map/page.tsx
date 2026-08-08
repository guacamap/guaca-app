'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import TabBar from '../tab-bar';
import styles from './map.module.css';

export interface PlacePin {
  id: string;
  name: string;
  category: string;
  landmarkDescription: string;
  lat: number;
  lon: number;
  spotterName: string | null;
  spotterPhotoUrl: string | null;
  verifiedAt: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  kind?: 'answer' | 'refusal';
  text: string;
  placeIds: string[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Where coverage currently exists. The map opens here so it is never blank
 * while the device is being located, and falls back here when the visitor
 * declines or the browser cannot place them.
 */
const COVERED = { lon: -68.0056, lat: 10.4716, label: 'Puerto Cabello' };

/** Roughly a 6km box around a point — the walkable radius a guest asks about. */
function bboxAround(lon: number, lat: number, km = 6): string {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
    .map((n) => n.toFixed(4))
    .join(',');
}

/** The visitor's own position: a plain dot, never a pin. A pin on this map
 *  means a place a named local stood in, and the guest is not one of those. */
const HERE = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="9" cy="9" r="7.5" fill="#0b0b0b" fill-opacity="0.12"/>
  <circle cx="9" cy="9" r="3.5" fill="#0b0b0b" stroke="#f7f6f2" stroke-width="1.5"/>
</svg>`;

type Origin = { lon: number; lat: number; source: 'covered' | 'device' };

/** Authored marker — one stroke weight, matching the page's hairlines. */
const MARKER = `<svg width="20" height="26" viewBox="0 0 20 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M10 25C10 25 18.5 15.6 18.5 9.5C18.5 4.81 14.69 1 10 1C5.31 1 1.5 4.81 1.5 9.5C1.5 15.6 10 25 10 25Z" fill="#f7f6f2" stroke="#0b0b0b" stroke-width="1.25"/>
  <circle cx="10" cy="9.5" r="2.75" fill="#0b0b0b"/>
</svg>`;

export default function TouristMap() {
  const container = useRef<HTMLDivElement>(null);
  const [places, setPlaces] = useState<PlacePin[]>([]);
  const [selected, setSelected] = useState<PlacePin | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const hereRef = useRef<maplibregl.Marker | null>(null);
  const [origin, setOrigin] = useState<Origin>({ ...COVERED, source: 'covered' });
  const [located, setLocated] = useState<'pending' | 'ok' | 'denied'>('pending');

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [COVERED.lon, COVERED.lat],
      zoom: 14,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* Ask the device where it is. The map is already usable before this
     resolves, so a slow or refused fix costs the visitor nothing. */
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocated('denied');
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const { longitude: lon, latitude: lat } = pos.coords;
        setOrigin({ lon, lat, source: 'device' });
        setLocated('ok');
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({ center: [lon, lat], zoom: 14, speed: 0.8 });
        const el = document.createElement('div');
        el.innerHTML = HERE;
        el.setAttribute('aria-label', 'Your position');
        hereRef.current?.remove();
        hereRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map);
      },
      () => {
        if (!cancelled) setLocated('denied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch(`${API}/api/places?bbox=${bboxAround(origin.lon, origin.lat)}`)
      .then((r) => r.json())
      .then((data: { places: PlacePin[] }) => {
        setPlaces(data.places);
        const map = mapRef.current;
        if (!map) return;
        for (const m of markersRef.current) m.remove();
        markersRef.current = [];
        for (const p of data.places) {
          const el = document.createElement('div');
          el.className = styles.pin ?? '';
          el.innerHTML = MARKER;
          el.setAttribute('role', 'button');
          el.setAttribute('tabindex', '0');
          el.setAttribute('aria-label', p.name);
          el.addEventListener('click', () => setSelected(p));
          el.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter') setSelected(p);
          });
          markersRef.current.push(
            new maplibregl.Marker({ element: el })
              .setLngLat([p.lon, p.lat])
              .addTo(map),
          );
        }
      })
      .catch(() => {
        // The map still renders; pins appear once the API is up.
      });
  }, [origin]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function ask() {
    if (!question.trim() || busy) return;
    const text = question.trim();
    setQuestion('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text, placeIds: [] }]);
    try {
      const res = await fetch(`${API}/api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        /* The question is asked from wherever the visitor actually is, so a
           refusal is about their ground and not a demo coordinate. */
        body: JSON.stringify({
          text,
          language: 'en',
          lat: origin.lat,
          lon: origin.lon,
        }),
      });
      const body = (await res.json()) as {
        kind: 'answer' | 'refusal';
        text: string;
        placeIds: string[];
      };
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          kind: body.kind,
          text: body.text,
          placeIds: body.placeIds,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          kind: 'refusal',
          text: 'The service is unreachable right now. Try again shortly.',
          placeIds: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      {/* Search-first: a guest opens this to ask, so the field is the first
          thing under their thumb and the map is what it acts on. */}
      <header className={styles.topbar}>
        <Link href="/" className={styles.wordmark} aria-label="GUACA home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} />
        </Link>
        <form
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <input
            id="map-ask"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask Guaca…"
            disabled={busy}
            aria-label="Ask about this area"
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Asking' : 'Ask'}
          </button>
        </form>
      </header>

      <p className={`${styles.count} u-micro u-figures`}>
        {places.length} documented
        {origin.source === 'device' ? ' where you are' : ` in ${COVERED.label}`}
      </p>

      <div ref={container} className={styles.map} />

      <aside className={styles.chat} aria-label="Ask about Puerto Cabello">
        <div ref={scrollRef} className={styles.scroll}>
          {messages.length === 0 && (
            <p className={styles.empty}>
              {origin.source === 'device' && places.length === 0
                ? 'Nobody has documented anything where you are standing. Ask anyway — the question becomes a paid mission for a local.'
                : 'Ask about a place here. If nobody has documented it, this will say so.'}
            </p>
          )}
          {origin.source === 'device' && places.length === 0 && (
            <button
              type="button"
              className={styles.jump}
              onClick={() => {
                setOrigin({ ...COVERED, source: 'covered' });
                mapRef.current?.flyTo({
                  center: [COVERED.lon, COVERED.lat],
                  zoom: 14,
                  speed: 0.8,
                });
              }}
            >
              Go to {COVERED.label}, where coverage has started
            </button>
          )}
          {located === 'denied' && messages.length === 0 && (
            <p className="u-micro">
              Showing {COVERED.label}. Allow location to ask about where you are.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`${styles.msg} ${m.role === 'user' ? styles.user : ''} ${
                m.kind === 'refusal' ? styles.refusal : ''
              }`}
            >
              {m.role === 'assistant' && (
                <span className="u-micro">
                  {m.kind === 'refusal' ? 'Not documented' : 'Documented'}
                </span>
              )}
              <p className={styles.bubble}>{m.text}</p>
            </div>
          ))}
          {busy && (
            <div className={styles.msg}>
              <p className={styles.bubble}>…</p>
            </div>
          )}
        </div>
      </aside>

      {selected && (
        <aside className={styles.sheet} aria-label={selected.name}>
          <button
            className={styles.close}
            onClick={() => setSelected(null)}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M1 1L13 13M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.25"
              />
            </svg>
          </button>
          <h2 className={styles.sheetTitle}>{selected.name}</h2>
          <p className={styles.landmark}>{selected.landmarkDescription}</p>
          {selected.spotterName && (
            <div className={styles.spotter}>
              {selected.spotterPhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.spotterPhotoUrl} alt="" />
              )}
              <span className="u-micro">
                Visited by {selected.spotterName}
                {selected.verifiedAt
                  ? ` · ${new Date(selected.verifiedAt).toLocaleDateString()}`
                  : ''}
              </span>
            </div>
          )}
        </aside>
      )}

      <TabBar />
    </main>
  );
}
