'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
const BBOX = '-68.03,10.44,-67.98,10.52';

export default function TouristMap() {
  const container = useRef<HTMLDivElement>(null);
  const [places, setPlaces] = useState<PlacePin[]>([]);
  const [selected, setSelected] = useState<PlacePin | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);

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
      center: [-68.0056, 10.4716],
      zoom: 14,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    fetch(`${API}/api/places?bbox=${BBOX}`)
      .then((r) => r.json())
      .then((data: { places: PlacePin[] }) => {
        setPlaces(data.places);
        const map = mapRef.current;
        if (!map) return;
        for (const p of data.places) {
          const el = document.createElement('div');
          el.className = 'pin';
          el.innerHTML = '📍';
          el.addEventListener('click', () => setSelected(p));
          new maplibregl.Marker({ element: el })
            .setLngLat([p.lon, p.lat])
            .addTo(map);
        }
      })
      .catch(() => {
        // The map still renders; pins appear once the API is up.
      });
  }, []);

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
        body: JSON.stringify({ text, language: 'en', lat: 10.4716, lon: -68.0056 }),
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
          text: 'Something went wrong. Please try again shortly.',
          placeIds: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="tourist-page">
      <header className="topbar">
        <strong>GUACA</strong>
        <span>Puerto Cabello — witnessed, not inferred</span>
      </header>
      <div ref={container} className="map" />
      <aside className="chat">
        <div className="chat-scroll">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role} ${m.kind ?? ''}`}>
              <div className="bubble">{m.text}</div>
              {m.kind === 'refusal' && (
                <div className="refusal-note">
                  No one has been there yet — we&apos;ve commissioned a local to
                  go look.
                </div>
              )}
            </div>
          ))}
          {busy && <div className="msg assistant"><div className="bubble">…</div></div>}
        </div>
        <div className="chat-input">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="Ask about Puerto Cabello…"
            disabled={busy}
          />
          <button onClick={ask} disabled={busy}>Ask</button>
        </div>
      </aside>
      {selected && (
        <aside className="sheet">
          <button onClick={() => setSelected(null)} aria-label="close">×</button>
          <h2>{selected.name}</h2>
          <p className="landmark">{selected.landmarkDescription}</p>
          {selected.spotterName && (
            <div className="spotter">
              {selected.spotterPhotoUrl && (
                <img src={selected.spotterPhotoUrl} alt={selected.spotterName} />
              )}
              <span>
                Visited by <strong>{selected.spotterName}</strong>
                {selected.verifiedAt
                  ? ` on ${new Date(selected.verifiedAt).toLocaleDateString()}`
                  : ''}
              </span>
            </div>
          )}
        </aside>
      )}
      <style jsx>{`
        .tourist-page {
          position: relative;
          height: 100vh;
          font-family: system-ui, sans-serif;
        }
        .topbar {
          position: absolute;
          top: 0; left: 0; right: 0; z-index: 10;
          display: flex; gap: 12px; align-items: center;
          padding: 12px 16px;
          background: rgba(255,255,255,0.92);
          border-bottom: 1px solid #ddd;
        }
        .map { width: 100%; height: 100%; }
        .pin { cursor: pointer; font-size: 22px; }
        .chat {
          position: absolute; right: 16px; top: 64px; bottom: 16px; z-index: 10;
          width: 340px; display: flex; flex-direction: column;
          background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        }
        .chat-scroll { flex: 1; overflow-y: auto; padding: 12px; }
        .msg { margin-bottom: 10px; }
        .msg.user { text-align: right; }
        .bubble {
          display: inline-block; padding: 8px 12px; border-radius: 12px;
          background: #eee; max-width: 90%; text-align: left; white-space: pre-wrap;
        }
        .msg.user .bubble { background: #dbeafe; }
        .msg.refusal .bubble {
          background: #fff3cd; border: 1px solid #f0d58a; font-weight: 500;
        }
        .refusal-note { font-size: 12px; color: #7a5b00; margin-top: 4px; }
        .chat-input { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; }
        .chat-input input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 8px; }
        .chat-input button { padding: 8px 14px; border: 0; border-radius: 8px; background: #1d5cb0; color: #fff; cursor: pointer; }
        .chat-input button:disabled { opacity: 0.5; }
        .sheet {
          position: absolute; bottom: 16px; left: 16px; z-index: 10;
          background: #fff; border-radius: 12px; padding: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25); max-width: 320px;
        }
        .sheet button { float: right; border: 0; background: none; font-size: 20px; cursor: pointer; }
        .landmark { color: #444; }
        .spotter { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
        .spotter img { width: 32px; height: 32px; border-radius: 50%; }
      `}</style>
    </main>
  );
}
