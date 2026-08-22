'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Bot,
  Check,
  ClipboardList,
  Coins,
  Globe2,
  Loader2,
  Lock,
  Megaphone,
  Radio,
  Users,
  X,
} from 'lucide-react';
import { Button, GuacaMap, GuacaLogo, Input } from '@guaca/ui';
import { StewardReview } from './StewardReview';

/**
 * The admin panel — every operator capability the CLI has, behind the same
 * OPERATOR_TOKEN, with the audit trail the database already keeps. English
 * by design: this is the team's tool, not a tourist surface.
 */

const TOKEN_KEY = 'guaca:op-token';

type Tab = 'map' | 'overview' | 'missions' | 'people' | 'moderation' | 'steward';

interface MapData {
  places: Array<{ id: string; name: string; category: string; lat: number; lon: number; spotterName: string | null }>;
  gaps: Array<{ id: string; category: string; questionCount: number; lat: number; lon: number }>;
  candidates: Array<{ id: string; lat: number; lon: number }>;
  heat: Array<{ lat: number; lon: number; weight: number }>;
}

interface ActivityEvent {
  id: string;
  kind: string;
  agent: string;
  loopId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

const CATEGORY_GLYPH: Record<string, { emoji: string; color: string }> = {
  eat_drink: { emoji: '🍽️', color: '#D97E00' },
  beach_water: { emoji: '🏖️', color: '#0D7A72' },
  nature_walk: { emoji: '🌿', color: '#2E7D32' },
  culture_history: { emoji: '🏛️', color: '#6A4C93' },
  market_shop: { emoji: '🧺', color: '#B07A2E' },
  services: { emoji: '🔧', color: '#455A64' },
  nightlife_music: { emoji: '🎶', color: '#8E24AA' },
  practical: { emoji: '🧭', color: '#546E7A' },
};

const ACTIVITY_ICON: Record<string, string> = {
  QUESTION_ASKED: '💬',
  REFUSED: '🚫',
  GAP_SCORED: '📊',
  MISSION_APPROVED: '📝',
  SUBMITTED: '📸',
  CHECKS_PASSED: '✅',
  VISION_OK: '👁️',
  SECOND_LOCAL_CONFIRMED: '🤝',
  VERIFIED: '📍',
  LOOP_CLOSED: '🔄',
};

interface Overview {
  verifiedPlaces: number;
  candidates: number;
  openGaps: number;
  offeredMissions: number;
  verifiedMissions: number;
  activeSpotters: number;
  properties: number;
  questions30d: number;
  pendingDrafts: number;
  pendingEscalations: number;
  reportedPosts: number;
  pendingRegistrations: number;
}

interface Gap {
  id: string;
  category: string;
  h3_8: string;
  questionCount: number;
  distinctSessionCount: number;
  score: number;
}

interface Mission {
  id: string;
  gapId: string;
  spotterId: string;
  brief: string;
  status: string;
  rewardMinor: number;
  createdBy: string;
}

interface Spotter {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  level?: number;
  openMissions?: number;
  lastCodeAt?: string | null;
}

interface QueueItem {
  id: string;
  placeName?: string;
  reason?: string;
  trust?: number;
}

interface Registration {
  id: string;
  role: string;
  name: string;
  contact: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface Conflict {
  id: string;
  kind: string;
  severity: 'high' | 'normal' | 'low';
  title: string;
  detail: string | null;
  evidence: Record<string, unknown>;
  createdAt: string;
  verificationRunId?: string;
  postId?: string;
}

interface Issue {
  id: string;
  title: string;
  detail: string | null;
  kind: string;
  priority: string;
  status: string;
  filedBy: string;
  resolutionNote: string | null;
  createdAt: string;
}

interface ReportedPost {
  id: string;
  body: string;
  reports: number;
  author: string;
}

export function AdminPanel() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('map');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [spotters, setSpotters] = useState<Spotter[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [posts, setPosts] = useState<ReportedPost[]>([]);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDetail, setIssueDetail] = useState('');
  const [issueKind, setIssueKind] = useState('task');
  const [issuePriority, setIssuePriority] = useState('normal');
  const [newSpotterName, setNewSpotterName] = useState('');
  const [newSpotterPhone, setNewSpotterPhone] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (saved) {
        setToken(saved);
      }
    } catch { /* private mode */ }
  }, []);

  // Auto-lock after 30 minutes of no interaction — an unlocked admin
  // panel on an unattended screen is the weakest link in the chain.
  useEffect(() => {
    if (!authed) return;
    let timer: ReturnType<typeof setTimeout>;
    const lock = () => { setAuthed(false); setFlash('Auto-locked after 30 min idle.'); };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, 30 * 60 * 1000);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => document.removeEventListener(e, reset));
    };
  }, [authed]);

  const api = useCallback(
    async <T,>(method: string, path: string, body?: unknown): Promise<T | null> => {
      setBusy(true);
      try {
        const res = await fetch(path, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        if (res.status === 401) {
          setAuthed(false);
          setFlash('Wrong operator token.');
          return null;
        }
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setFlash(err.error ?? `Request failed (${res.status}).`);
          return null;
        }
        return (await res.json()) as T;
      } catch {
        setFlash('Cannot reach the API.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  const loadAll = useCallback(async () => {
    const o = await api<Overview>('GET', '/api/operator/overview');
    if (o) {
      setOverview(o);
      setAuthed(true);
      try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
    }
  }, [api, token]);

  const loadTab = useCallback(
    async (t: Tab) => {
      if (t === 'overview') await loadAll();
      if (t === 'map') {
        const [m, a] = await Promise.all([
          api<MapData>('GET', '/api/operator/map'),
          api<{ events: ActivityEvent[] }>('GET', '/api/operator/activity'),
        ]);
        if (m) setMapData(m);
        if (a) setActivity(a.events);
      }
      if (t === 'missions') {
        const [g, m] = await Promise.all([
          api<{ gaps: Gap[] }>('GET', '/api/operator/gaps'),
          api<{ missions: Mission[] }>('GET', '/api/operator/missions'),
        ]);
        if (g) setGaps(g.gaps);
        if (m) setMissions(m.missions);
      }
      if (t === 'people') {
        const [s, r] = await Promise.all([
          api<{ spotters: Spotter[] }>('GET', '/api/operator/spotters'),
          api<{ registrations: Registration[] }>('GET', '/api/operator/registrations'),
        ]);
        if (s) setSpotters(s.spotters);
        if (r) setRegistrations(r.registrations);
      }
      if (t === 'moderation') {
        const [c, i] = await Promise.all([
          api<{ conflicts: Conflict[] }>('GET', '/api/operator/conflicts'),
          api<{ issues: Issue[] }>('GET', '/api/operator/issues'),
        ]);
        if (c) setConflicts(c.conflicts);
        if (i) setIssues(i.issues);
      }
    },
    [api, loadAll],
  );

  useEffect(() => {
    if (authed) void loadTab(tab);
  }, [authed, tab, loadTab]);

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-guaca-sand-light px-5">
        <div className="guaca-card w-full max-w-sm rounded-[30px] p-6">
          <GuacaLogo className="mx-auto h-10" />
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-[.1em] text-guaca-teal">
            <Lock className="h-3.5 w-3.5" /> Admin panel
          </p>
          <p className="mt-2 text-center text-[11px] font-semibold leading-relaxed text-guaca-ink/55">
            Operator access only. Every action is audited.
          </p>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Operator token"
            aria-label="Operator token"
            className="mt-4 h-11"
          />
          <Button
            type="button"
            disabled={busy || token.length === 0}
            onClick={() => void loadAll()}
            className="mt-3 h-11 w-full rounded-2xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock'}
          </Button>
          {flash && <p className="mt-2 text-center text-[11px] font-bold text-guaca-coral-dark">{flash}</p>}
        </div>
      </div>
    );
  }

  const TABS: Array<{ id: Tab; label: string; icon: typeof Globe2 }> = [
    { id: 'map', label: 'Oversight Map', icon: Radio },
    { id: 'overview', label: 'Overview', icon: Globe2 },
    { id: 'missions', label: 'Missions & Gaps', icon: Radio },
    { id: 'people', label: 'People', icon: Users },
    { id: 'moderation', label: 'Moderation', icon: Megaphone },
    { id: 'steward', label: 'AI Steward', icon: Bot },
  ];

  return (
    <div className="min-h-screen overflow-y-auto bg-guaca-sand-light px-5 pb-14 pt-10">
      <header className="flex items-center justify-between">
        <div>
          <GuacaLogo className="h-9" />
          <p className="mt-1 text-[11px] font-bold text-guaca-ink/45">Admin panel</p>
        </div>
        <button
          type="button"
          onClick={() => { setAuthed(false); setToken(''); try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }}
          className="rounded-full bg-guaca-ink/6 px-3 py-1.5 text-[10px] font-black text-guaca-ink/60 hover:bg-guaca-ink/10"
        >
          Lock
        </button>
      </header>

      <nav className="mt-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-black ${tab === id ? 'bg-guaca-ocean-deep text-white' : 'bg-white/80 text-guaca-ink/65 ring-1 ring-guaca-sand'}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      {flash && (
        <p className="mt-3 rounded-2xl bg-guaca-coral/10 px-4 py-2.5 text-[11px] font-bold text-guaca-coral-dark">{flash}</p>
      )}

      {tab === 'map' && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-3 px-1 text-[9px] font-black uppercase tracking-[.1em] text-guaca-ink/45">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-guaca-teal" /> verified ({mapData?.places.length ?? 0})</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-guaca-coral" /> demand gaps ({mapData?.gaps.length ?? 0})</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0C4A5C]/50" /> OSM candidates ({mapData?.candidates.length ?? 0} shown)</span>
          </div>
          <div className="mt-2 h-[55vh] overflow-hidden rounded-[26px] shadow-lg ring-1 ring-guaca-sand">
            {mapData ? (
              <GuacaMap
                pins={mapData.places.map((p) => {
                  const glyph = CATEGORY_GLYPH[p.category] ?? { emoji: '📍', color: '#0D8B8B' };
                  return {
                    id: p.id,
                    lat: p.lat,
                    lng: p.lon,
                    emoji: glyph.emoji,
                    label: `${p.name}${p.spotterName ? ` — ${p.spotterName}` : ''}`,
                    spotterColor: glyph.color,
                    spotterInitials: p.spotterName?.slice(0, 2).toUpperCase() ?? '??',
                    verified: true,
                  };
                })}
                gapPins={mapData.gaps.map((g) => ({
                  id: g.id,
                  lat: g.lat,
                  lng: g.lon,
                  label: `${g.category} · ${g.questionCount} asks`,
                  asks: g.questionCount,
                  category: g.category,
                }))}
                dots={mapData.candidates.map((c) => ({
                  id: c.id,
                  lat: c.lat,
                  lng: c.lon,
                  label: 'OSM candidate',
                  category: 'practical',
                }))}
                heat={mapData.heat.map((h) => ({ lat: h.lat, lng: h.lon, weight: h.weight }))}
                mapStyle="streets"
                center={[-66, 14]}
                zoom={4.5}
              />
            ) : (
              <div className="grid h-full place-items-center bg-guaca-sand-light">
                <Loader2 className="h-6 w-6 animate-spin text-guaca-teal" />
              </div>
            )}
          </div>

          <h2 className="mt-5 px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Live activity — what people and agents did</h2>
          <div className="mt-2 space-y-1.5">
            {activity.length === 0 && <EmptyCard text="No activity recorded yet." />}
            {activity.map((e) => (
              <div key={e.id} className="flex items-baseline gap-2.5 rounded-[16px] bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-guaca-sand/70">
                <span className="text-[13px]">{ACTIVITY_ICON[e.kind] ?? '•'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-guaca-ink">{e.kind.replaceAll('_', ' ').toLowerCase()}</p>
                  <p className="truncate text-[9.5px] font-semibold text-guaca-ink/45">
                    {e.agent}
                    {typeof e.payload.reason === 'string' ? ` · ${e.payload.reason}` : ''}
                    {typeof e.payload.category === 'string' ? ` · ${e.payload.category}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[9px] font-bold tabular-nums text-guaca-ink/35">
                  {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {(
            [
              ['Verified places', overview.verifiedPlaces, BadgeCheck],
              ['OSM candidates', overview.candidates, ClipboardList],
              ['Open gaps', overview.openGaps, Radio],
              ['Offered missions', overview.offeredMissions, Radio],
              ['Awaiting payout', overview.verifiedMissions, Coins],
              ['Active spotters', overview.activeSpotters, Users],
              ['Properties', overview.properties, Globe2],
              ['Questions · 30d', overview.questions30d, Globe2],
              ['Steward drafts', overview.pendingDrafts, Bot],
              ['Escalations', overview.pendingEscalations, ClipboardList],
              ['Reported posts', overview.reportedPosts, Megaphone],
              ['Registrations', overview.pendingRegistrations, Users],
            ] as Array<[string, number, typeof Globe2]>
          ).map(([label, value, Icon]) => (
            <div key={label} className="rounded-[22px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
              <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[.1em] text-guaca-ink/40">
                <Icon className="h-3 w-3" /> {label}
              </p>
              <p className="mt-1 text-[22px] font-black leading-none text-guaca-ink">{value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'missions' && (
        <div className="mt-5 space-y-5">
          <section>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Open gaps · ranked by score</h2>
            <div className="mt-2 space-y-2">
              {gaps.length === 0 && <EmptyCard text="No open gaps — demand is covered." />}
              {gaps.slice(0, 10).map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-[20px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                  <span className="grid h-10 w-12 shrink-0 place-items-center rounded-xl bg-guaca-teal/8 text-[13px] font-black text-guaca-teal">
                    {g.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black text-guaca-ink">{g.category}</p>
                    <p className="text-[10px] font-bold text-guaca-ink/45">
                      {g.questionCount} asks · {g.distinctSessionCount} people
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const res = await api<{ status: string }>('POST', `/api/operator/gaps/${g.id}/commission`);
                      if (res) { setFlash(`Commissioned: ${res.status}`); await loadTab('missions'); }
                    }}
                    className="h-9 rounded-xl bg-guaca-teal px-3 text-[10px] font-black text-white hover:bg-guaca-teal-dark"
                  >
                    Commission
                  </Button>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Missions · newest first</h2>
            <div className="mt-2 space-y-2">
              {missions.length === 0 && <EmptyCard text="No missions yet." />}
              {missions.slice(0, 15).map((m) => (
                <div key={m.id} className="rounded-[20px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-bold text-guaca-ink/70">{m.brief.slice(0, 60)}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${m.status === 'offered' ? 'bg-guaca-mango/15 text-guaca-ocean-deep' : m.status === 'verified' ? 'bg-guaca-teal/10 text-guaca-teal' : 'bg-guaca-ink/5 text-guaca-ink/50'}`}>
                      {m.status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {m.status === 'offered' && (
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const res = await api('POST', `/api/operator/missions/${m.id}/cancel`, { reason: 'admin panel' });
                          if (res) { setFlash('Mission cancelled.'); await loadTab('missions'); }
                        }}
                        className="h-8 flex-1 rounded-xl bg-guaca-ink/6 text-[10px] font-black text-guaca-ink/60 hover:bg-guaca-coral/12 hover:text-guaca-coral-dark"
                      >
                        <Ban className="mr-1 h-3 w-3" /> Cancel
                      </Button>
                    )}
                    {m.status === 'verified' && (
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const res = await api<{ status: string }>('POST', `/api/operator/missions/${m.id}/pay`);
                          if (res) { setFlash(`Payout: ${res.status}`); await loadTab('missions'); }
                        }}
                        className="h-8 flex-1 rounded-xl bg-guaca-teal text-[10px] font-black text-white hover:bg-guaca-teal-dark"
                      >
                        <Coins className="mr-1 h-3 w-3" /> Pay
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'people' && (
        <div className="mt-5 space-y-5">
          <section>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Add a spotter</h2>
            <div className="mt-2 flex gap-2">
              <Input value={newSpotterName} onChange={(e) => setNewSpotterName(e.target.value)} placeholder="Name" aria-label="Name" className="h-10 flex-1" />
              <Input value={newSpotterPhone} onChange={(e) => setNewSpotterPhone(e.target.value)} placeholder="+58 …" aria-label="Phone" className="h-10 flex-1" />
              <Button
                type="button"
                disabled={busy || newSpotterName.length < 2 || newSpotterPhone.length < 6}
                onClick={async () => {
                  const res = await api('POST', '/api/operator/spotters', { name: newSpotterName, phone: newSpotterPhone });
                  if (res) { setFlash('Spotter added.'); setNewSpotterName(''); setNewSpotterPhone(''); await loadTab('people'); }
                }}
                className="h-10 rounded-xl bg-guaca-teal px-4 text-[10px] font-black text-white hover:bg-guaca-teal-dark"
              >
                Add
              </Button>
            </div>
          </section>
          <section>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Spotter roster</h2>
            <div className="mt-2 space-y-2">
              {spotters.slice(0, 20).map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-[20px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black text-guaca-ink">{s.name}</p>
                    <p className="text-[10px] font-bold text-guaca-ink/45">{s.phone}</p>
                  </div>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const res = await api<{ code: string }>('POST', `/api/operator/spotters/${s.id}/code`);
                      if (res) setFlash(`${s.name}'s one-time code: ${res.code} (shown once — deliver in person)`);
                    }}
                    className="h-9 rounded-xl bg-guaca-ocean-deep px-3 text-[10px] font-black text-white"
                  >
                    Issue code
                  </Button>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Registrations inbox</h2>
            <div className="mt-2 space-y-2">
              {registrations.length === 0 && <EmptyCard text="No pending registrations." />}
              {registrations.map((r) => (
                <div key={r.id} className="rounded-[20px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                  <p className="text-[12px] font-black text-guaca-ink">
                    {r.name} <span className="font-bold text-guaca-ink/40">· {r.role}</span>
                  </p>
                  <p className="text-[10px] font-bold text-guaca-ink/45">{r.contact}</p>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const res = await api('POST', `/api/operator/registrations/${r.id}/handle`, { note: 'handled via panel' });
                      if (res) { setFlash('Marked handled.'); await loadTab('people'); }
                    }}
                    className="mt-2 h-8 rounded-xl bg-guaca-ink/6 px-3 text-[10px] font-black text-guaca-ink/60 hover:bg-guaca-ink/10"
                  >
                    <Check className="mr-1 h-3 w-3" /> Handled
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'moderation' && (
        <div className="mt-5 space-y-5">
          <section>
            <h2 className="flex items-center justify-between px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">
              <span>Conflicts · {conflicts.length} needing attention</span>
              <span className="text-[9px] font-bold text-guaca-ink/35">
                {conflicts.filter((c) => c.severity === 'high').length} high · {' '}
                {conflicts.filter((c) => c.kind === 'escalation').length} escalations · {' '}
                {conflicts.filter((c) => c.kind === 'post_report').length} reports
              </span>
            </h2>
            <div className="mt-2 space-y-2">
              {conflicts.length === 0 && <EmptyCard text="No conflicts — the system is calm." />}
              {conflicts.map((c) => (
                <div key={c.id} className={`rounded-[20px] bg-white p-4 shadow-sm ring-1 ${c.severity === 'high' ? 'ring-guaca-coral/30' : 'ring-guaca-sand/75'}`}>
                  <button type="button" className="flex w-full items-start gap-2.5 text-left" onClick={() => setExpandedConflict(expandedConflict === c.id ? null : c.id)}>
                    <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.severity === 'high' ? 'bg-guaca-coral' : c.severity === 'normal' ? 'bg-guaca-mango' : 'bg-guaca-ink/20'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-guaca-ink">{c.title}</p>
                      {c.detail && <p className="text-[10px] font-semibold text-guaca-ink/45">{c.detail}</p>}
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-guaca-ink/30">
                        {c.kind.replaceAll('_', ' ')} · {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-black text-guaca-ink/25">{expandedConflict === c.id ? '−' : '+'}</span>
                  </button>

                  {expandedConflict === c.id && (
                    <div className="mt-3 border-t border-guaca-sand pt-3">
                      <p className="text-[9px] font-black uppercase tracking-[.1em] text-guaca-ink/35">Evidence</p>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-xl bg-guaca-sand-light/70 p-3 text-[10px] leading-relaxed text-guaca-ink/70">
{JSON.stringify(c.evidence, null, 2)}
                      </pre>
                      <div className="mt-2.5 flex gap-2">
                        {c.verificationRunId && (
                          <>
                            <Button type="button" disabled={busy} onClick={async () => { await api('POST', `/api/operator/verify/${c.verificationRunId}`, { decision: 'approve' }); setFlash('Approved.'); await loadTab('moderation'); }} className="h-8 flex-1 rounded-xl bg-guaca-teal text-[10px] font-black text-white">
                              ✓ Approve
                            </Button>
                            <Button type="button" disabled={busy} onClick={async () => { await api('POST', `/api/operator/verify/${c.verificationRunId}`, { decision: 'reject', note: 'moderation' }); setFlash('Rejected.'); await loadTab('moderation'); }} className="h-8 flex-1 rounded-xl bg-guaca-ink/6 text-[10px] font-black text-guaca-ink/60">
                              ✕ Reject
                            </Button>
                          </>
                        )}
                        {c.postId && (
                          <>
                            <Button type="button" disabled={busy} onClick={async () => { await api('POST', `/api/operator/posts/${c.postId}/hide`); setFlash('Hidden.'); await loadTab('moderation'); }} className="h-8 flex-1 rounded-xl bg-guaca-coral/10 text-[10px] font-black text-guaca-coral-dark">
                              Hide post
                            </Button>
                            <Button type="button" disabled={busy} onClick={async () => { await api('POST', `/api/operator/posts/${c.postId}/show`); setFlash('Restored.'); await loadTab('moderation'); }} className="h-8 flex-1 rounded-xl bg-guaca-ink/6 text-[10px] font-black text-guaca-ink/60">
                              Keep visible
                            </Button>
                          </>
                        )}
                        <Button type="button" disabled={busy} onClick={async () => {
                          await api('POST', '/api/operator/issues', { title: `Conflict: ${c.title}`, detail: c.detail ?? '', kind: 'data', priority: c.severity === 'high' ? 'high' : 'normal' });
                          setFlash('Filed as issue.'); await loadTab('moderation');
                        }} className="h-8 flex-1 rounded-xl bg-guaca-ocean/8 text-[10px] font-black text-guaca-ocean">
                          📋 File as issue
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">File an issue</h2>
            <div className="mt-2 rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
              <div className="flex gap-2">
                <Input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder="What needs fixing?" aria-label="Issue title" className="h-10 flex-1" />
              </div>
              <div className="mt-2 flex gap-2">
                <Input value={issueDetail} onChange={(e) => setIssueDetail(e.target.value)} placeholder="Detail (optional)" aria-label="Detail" className="h-10 flex-1" />
              </div>
              <div className="mt-2 flex gap-1.5">
                {['bug', 'task', 'data', 'spotter', 'security'].map((k) => (
                  <button key={k} type="button" onClick={() => setIssueKind(k)} className={`rounded-full px-2.5 py-1 text-[9px] font-black ${issueKind === k ? 'bg-guaca-ocean-deep text-white' : 'bg-guaca-ink/5 text-guaca-ink/50'}`}>
                    {k}
                  </button>
                ))}
                <span className="flex-1" />
                {['low', 'normal', 'high', 'urgent'].map((p) => (
                  <button key={p} type="button" onClick={() => setIssuePriority(p)} className={`rounded-full px-2.5 py-1 text-[9px] font-black ${issuePriority === p ? (p === 'urgent' ? 'bg-guaca-coral text-white' : 'bg-guaca-mango text-guaca-ocean-deep') : 'bg-guaca-ink/5 text-guaca-ink/50'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <Button type="button" disabled={busy || issueTitle.trim().length < 3} onClick={async () => {
                const res = await api('POST', '/api/operator/issues', { title: issueTitle, detail: issueDetail || undefined, kind: issueKind, priority: issuePriority });
                if (res) { setFlash('Issue filed.'); setIssueTitle(''); setIssueDetail(''); await loadTab('moderation'); }
              }} className="mt-2.5 h-10 w-full rounded-xl bg-guaca-teal text-[11px] font-black text-white hover:bg-guaca-teal-dark">
                File issue
              </Button>
            </div>
          </section>

          <section>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Issues · {issues.filter((i) => i.status === 'open').length} open</h2>
            <div className="mt-2 space-y-2">
              {issues.length === 0 && <EmptyCard text="No issues filed." />}
              {issues.map((i) => (
                <div key={i.id} className={`rounded-[20px] bg-white p-3.5 shadow-sm ring-1 ${i.priority === 'urgent' ? 'ring-guaca-coral/30' : 'ring-guaca-sand/75'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-guaca-ink">{i.title}</p>
                      {i.detail && <p className="text-[10px] font-semibold text-guaca-ink/45">{i.detail}</p>}
                      <p className="mt-0.5 text-[9px] font-bold uppercase text-guaca-ink/30">
                        {i.kind} · {i.priority} · filed by {i.filedBy} · {new Date(i.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${i.status === 'open' ? 'bg-guaca-mango/15 text-guaca-ocean-deep' : i.status === 'resolved' ? 'bg-guaca-teal/10 text-guaca-teal' : 'bg-guaca-ink/5 text-guaca-ink/50'}`}>
                      {i.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  {i.status === 'open' && (
                    <div className="mt-2 flex gap-2">
                      <Button type="button" disabled={busy} onClick={async () => {
                        const note = window.prompt('How was this resolved?') ?? '';
                        if (!note.trim()) return;
                        await api('POST', `/api/operator/issues/${i.id}/resolve`, { status: 'resolved', note });
                        setFlash('Resolved.'); await loadTab('moderation');
                      }} className="h-8 flex-1 rounded-xl bg-guaca-teal text-[10px] font-black text-white">
                        ✓ Resolve
                      </Button>
                      <Button type="button" disabled={busy} onClick={async () => {
                        await api('POST', `/api/operator/issues/${i.id}/resolve`, { status: 'wont_fix', note: 'wont fix' });
                        setFlash("Won't fix."); await loadTab('moderation');
                      }} className="h-8 flex-1 rounded-xl bg-guaca-ink/6 text-[10px] font-black text-guaca-ink/60">
                        Won't fix
                      </Button>
                    </div>
                  )}
                  {i.resolutionNote && i.status !== 'open' && (
                    <p className="mt-1.5 rounded-lg bg-guaca-sand-light/60 px-2.5 py-1.5 text-[9.5px] font-semibold text-guaca-ink/50">→ {i.resolutionNote}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'steward' && (
        <div className="mt-2">
          {/* The steward section keeps its own token handling for now —
              same key, same gate. */}
          <StewardReview />
        </div>
      )}

      <p className="mt-8 flex items-center justify-center gap-1 text-[9px] font-bold text-guaca-ink/35">
        <BadgeCheck className="h-3 w-3" /> every mutation writes an operator_actions audit row
      </p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-guaca-sand bg-white/60 px-4 py-4 text-center text-[11px] font-semibold text-guaca-ink/40">
      {text}
    </p>
  );
}
