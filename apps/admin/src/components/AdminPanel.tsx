'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  Bot,
  Check,
  ClipboardList,
  Coins,
  Download,
  Globe2,
  Loader2,
  KeyRound,
  ListChecks,
  Lock,
  Megaphone,
  Play,
  Radio,
  Sparkles,
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

type Tab = 'map' | 'overview' | 'missions' | 'people' | 'waitlist' | 'moderation' | 'steward' | 'ai' | 'access';

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

interface OverviewDeltas {
  verifiedWeek: number; gapsWeek: number; missionsWeek: number; waitlistToday: number; conflictsResolvedWeek: number; actionsWeek: number;
}
interface AiCallRow { purpose: string; kind: string; model: string; calls: number; ok: number; schema_errors: number; timeouts: number; other_errors: number; avg_ms: number; p95_ms: number; tokens_in: number; tokens_out: number; }
interface AiOverview {
  hours: number;
  models: { text: string | null; vision: string | null; baseUrl: string | null };
  calls: AiCallRow[];
  questions: { total: number; answered: number; refused: number };
  refusals: Array<{ reason: string; n: number }>;
  verification: Array<{ decision: string; decided_by: string; n: number }>;
}
interface AiFailures {
  failedCalls: Array<{ id: string; ts: string; purpose: string; kind: string; model: string; error_kind: string; error_message: string | null; latency_ms: number }>;
  refusedQuestions: Array<{ id: string; ts: string; raw_text: string; language: string; refusal_reason: string | null; area: string | null }>;
}
interface AiBenchmark {
  id: string; ts: string; model: string; eval_set: string; rows_source: string; prompts: number; passes: number; plans: number; fast_path: number;
  refusals: number; schema_errors: number; errors: number; avg_ms: number; p95_ms: number; tokens_in: number; tokens_out: number;
  triggered_by: string; results: Array<{ id: string; expect: string; outcome: string; path?: string; pass: boolean; reason: string; ms: number }> | null;
}

interface Overview {
  deltas?: OverviewDeltas;
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
  email?: string | null;
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

interface WaitlistRow {
  id: string;
  role: string;
  name: string;
  contact: string;
  language: string;
  country: string;
  country_code: string;
  created_at: string;
  handled_at: string | null;
  operator_note: string | null;
}
interface WaitlistData {
  rows: WaitlistRow[];
  counts: { total: number; pending: number; traveler: number; spotter: number; owner: number };
  byCountry: Array<{ country: string; n: number }>;
}

interface OperatorAccount {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'moderator';
  active: boolean;
  lastLoginAt: string | null;
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
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [operatorRole, setOperatorRole] = useState<string | null>(null);
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [newOpEmail, setNewOpEmail] = useState('');
  const [newOpName, setNewOpName] = useState('');
  const [newOpRole, setNewOpRole] = useState<'admin' | 'operator' | 'moderator'>('operator');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('map');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [spotters, setSpotters] = useState<Spotter[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistData | null>(null);
  const [aiOverview, setAiOverview] = useState<AiOverview | null>(null);
  const [aiFailures, setAiFailures] = useState<AiFailures | null>(null);
  const [aiBenchmarks, setAiBenchmarks] = useState<AiBenchmark[]>([]);
  const [aiRunning, setAiRunning] = useState<{ model: string; startedAt: string } | null>(null);
  const [aiHours, setAiHours] = useState<24 | 168 | 720>(24);
  const [benchModel, setBenchModel] = useState('');
  const [wlStatus, setWlStatus] = useState<'all' | 'pending' | 'handled'>('all');
  const [wlRole, setWlRole] = useState<'' | 'traveler' | 'spotter' | 'owner'>('');
  const [wlQuery, setWlQuery] = useState('');
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
  const [newSpotterEmail, setNewSpotterEmail] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const [resumeChecked, setResumeChecked] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (saved) setToken(saved);
      else setResumeChecked(true);
    } catch { setResumeChecked(true); /* private mode */ }
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

  // Resume a saved session. A stored token proves nothing by itself, so ask
  // the API who we are: 200 signs us in, anything else clears the token and
  // shows the sign-in screen. Without this, every reload demanded a new
  // email code, which is not what the 30 minute auto-lock was meant to be.
  useEffect(() => {
    if (authed || resumeChecked || !token) return;
    setResumeChecked(true);
    void (async () => {
      // Deliberately not through api(): only a 401 means the session is
      // gone. A 5xx or a network error must not throw away a valid token,
      // or a blip in the API would sign every operator out.
      try {
        const res = await fetch('/api/operator/auth/me', { headers: { authorization: `Bearer ${token}` } });
        if (res.ok) {
          const me = (await res.json()) as { operator: { name: string; email: string; role: string } };
          setOperatorName(me.operator.name);
          setOperatorRole(me.operator.role);
          setAuthed(true);
        } else if (res.status === 401) {
          try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
          setFlash('Session expired. Sign in again.');
        } else {
          setFlash(`API unavailable (${res.status}). Your session is kept; reload to retry.`);
        }
      } catch {
        setFlash('Cannot reach the API. Your session is kept; reload to retry.');
      }
    })();
  }, [token, authed, resumeChecked]);

  const requestCode = async () => {
    setBusy(true); setFlash(null);
    try {
      const res = await fetch('/api/operator/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { setCodeSent(true); }
      else { const e = await res.json().catch(() => ({})); setFlash(e.error ?? 'Failed to send code.'); }
    } catch { setFlash('Cannot reach the API.'); }
    finally { setBusy(false); }
  };

  const verifyCode = async () => {
    setBusy(true); setFlash(null);
    try {
      const res = await fetch('/api/operator/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setFlash(e.error ?? 'Invalid code.');
        return;
      }
      const d = (await res.json()) as { token: string; operator: { name: string; email: string; role?: string } };
      setToken(d.token);
      setOperatorName(d.operator.name);
      setOperatorRole(d.operator.role ?? null);
      setAuthed(true);
      try { localStorage.setItem(TOKEN_KEY, d.token); } catch { /* ignore */ }
    } catch { setFlash('Cannot reach the API.'); }
    finally { setBusy(false); }
  };

  const loadAll = useCallback(async () => {
    // Check who we are (also validates the stored token)
    const me = await api<{ operator: { name: string; email: string; role: string } }>('GET', '/api/operator/auth/me');
    if (me) {
      setOperatorName(me.operator.name);
      setOperatorRole(me.operator.role);
      const o = await api<Overview>('GET', '/api/operator/overview');
      if (o) setOverview(o);
      setAuthed(true);
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
      if (t === 'waitlist') {
        const params = new URLSearchParams({ status: wlStatus });
        if (wlRole) params.set('role', wlRole);
        if (wlQuery.trim()) params.set('q', wlQuery.trim());
        const w = await api<WaitlistData>('GET', `/api/operator/waitlist?${params.toString()}`);
        if (w) setWaitlist(w);
      }
      if (t === 'ai') {
        const [o, f, b] = await Promise.all([
          api<AiOverview>('GET', `/api/operator/ai/overview?hours=${aiHours}`),
          api<AiFailures>('GET', '/api/operator/ai/failures'),
          api<{ benchmarks: AiBenchmark[]; running: { model: string; startedAt: string } | null }>('GET', '/api/operator/ai/benchmarks'),
        ]);
        if (o) { setAiOverview(o); if (!benchModel && o.models.text) setBenchModel(o.models.text); }
        if (f) setAiFailures(f);
        if (b) { setAiBenchmarks(b.benchmarks); setAiRunning(b.running); }
      }
      if (t === 'access') {
        const o = await api<{ operators: OperatorAccount[] }>('GET', '/api/operator/operators');
        if (o) setOperators(o.operators);
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
    [api, loadAll, wlStatus, wlRole, wlQuery, aiHours, benchModel],
  );

  useEffect(() => {
    if (authed) void loadTab(tab);
  }, [authed, tab, loadTab]);

  // The right-hand feed is the pulse of the network; it lives on every tab.
  useEffect(() => {
    if (!authed) return;
    let stop = false;
    const tick = async () => {
      const a = await api<{ events: ActivityEvent[] }>('GET', '/api/operator/activity');
      if (a && !stop) setActivity(a.events);
    };
    void tick();
    const id = setInterval(() => { void tick(); }, 30_000);
    return () => { stop = true; clearInterval(id); };
  }, [authed, api]);

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

          {!codeSent ? (
            <>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[.1em] text-guaca-ink/40">Email</p>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@guaca.live"
                aria-label="Email"
                className="mt-1.5 h-11"
                onKeyDown={(e) => { if (e.key === 'Enter' && email.includes('@')) void requestCode(); }}
              />
              <Button
                type="button"
                disabled={busy || !email.includes('@')}
                onClick={() => void requestCode()}
                className="mt-3 h-11 w-full rounded-2xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send code'}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[.1em] text-guaca-ink/40">
                Code sent to {email}
              </p>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                aria-label="6-digit code"
                className="mt-1.5 h-11 text-center text-lg tracking-[.4em]"
                onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) void verifyCode(); }}
              />
              <Button
                type="button"
                disabled={busy || code.length !== 6}
                onClick={() => void verifyCode()}
                className="mt-3 h-11 w-full rounded-2xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
              <button
                type="button"
                onClick={() => { setCodeSent(false); setCode(''); setFlash(null); }}
                className="mt-2 w-full py-2 text-[10px] font-bold text-guaca-ink/40 underline-offset-2 hover:underline"
              >
                ← use a different email
              </button>
            </>
          )}

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
    { id: 'waitlist', label: 'Waitlist', icon: ListChecks },
    { id: 'moderation', label: 'Moderation', icon: Megaphone },
    { id: 'steward', label: 'AI Steward', icon: Bot },
    { id: 'ai', label: 'Guaca AI', icon: Sparkles },
    ...(operatorRole === 'admin' ? [{ id: 'access' as Tab, label: 'Access', icon: KeyRound }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-guaca-sand-light">
      {/* Sidebar — always visible on desktop, the primary nav */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-guaca-sand/80 bg-white/70 px-4 py-5">
        <div className="flex items-center gap-2.5 px-1">
          <img src="/brand/guaca-mark.png" alt="" className="h-10 w-10 object-contain" draggable={false} />
          <div>
            <p className="text-[20px] font-black leading-none tracking-[-.02em] text-guaca-ocean-deep">Guaca</p>
            <p className="mt-0.5 text-[8.5px] font-black uppercase tracking-[.18em] text-guaca-ink/40">Admin console</p>
          </div>
        </div>
        {operatorName && (
          <div className="mt-5 px-1">
            <p className="text-[13px] font-black text-guaca-ink">{operatorName}</p>
            <p className="text-[11px] font-bold capitalize text-guaca-teal">{operatorRole === 'admin' ? 'Administrator' : operatorRole ?? 'Operator'}</p>
          </div>
        )}

        <nav className="mt-6 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-black transition-colors ${
                tab === id
                  ? 'bg-guaca-ocean-deep text-white shadow-md shadow-guaca-ocean-deep/20'
                  : 'text-guaca-ink/65 hover:bg-guaca-sand-light hover:text-guaca-ink'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          {overview && (
            <div className="rounded-2xl bg-guaca-sand-light/80 px-3.5 py-3">
              <p className="text-[8.5px] font-black uppercase tracking-[.14em] text-guaca-ink/40">Network at a glance</p>
              <div className="mt-2 space-y-1.5 text-[11px] font-bold text-guaca-ink/70">
                {(
                  [
                    ['Verified spots', overview.verifiedPlaces, BadgeCheck, 'text-guaca-teal'],
                    ['Open gaps', overview.openGaps, Radio, 'text-guaca-coral'],
                    ['Active spotters', overview.activeSpotters, Users, 'text-guaca-teal'],
                    ['Conflicts', overview.pendingEscalations + overview.reportedPosts, AlertTriangle, 'text-guaca-coral-dark'],
                    ['Waitlist', overview.pendingRegistrations, ListChecks, 'text-guaca-mango-dark'],
                    ['Actions this week', overview.deltas?.actionsWeek ?? 0, ClipboardList, 'text-guaca-ink/50'],
                  ] as Array<[string, number, typeof Globe2, string]>
                ).map(([label, value, Icon, tone]) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${tone}`} />
                    <span className="flex-1 truncate">{label}</span>
                    <span className="font-black tabular-nums text-guaca-ink">{value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => { setAuthed(false); setToken(''); setOperatorName(null); setCodeSent(false); setCode(''); setEmail(''); try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-guaca-sand-light px-3 py-2.5 text-[11px] font-black text-guaca-ink/60 hover:bg-guaca-coral/10 hover:text-guaca-coral-dark"
          >
            <Lock className="h-3.5 w-3.5" /> Lock panel
          </button>
          <p className="text-center text-[9px] font-bold text-guaca-ink/30">Every action audited</p>
        </div>
      </aside>

      {/* Main content — scrolls, uses the full width */}
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
        {flash && (
          <div className="mb-4 rounded-2xl bg-guaca-coral/10 px-4 py-3 text-[12px] font-bold text-guaca-coral-dark">
            {flash}
            <button type="button" onClick={() => setFlash(null)} className="ml-3 text-guaca-ink/30 hover:text-guaca-ink/60">✕</button>
          </div>
        )}

        {tab === 'map' && (
          <div>
            <div className="flex items-baseline justify-between">
              <h1 className="text-[26px] font-black tracking-[-.02em] text-guaca-ink">Oversight map</h1>
              <div className="flex gap-4 text-[10px] font-black uppercase tracking-[.08em] text-guaca-ink/45">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-guaca-teal" /> verified ({mapData?.places.length ?? 0})</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-guaca-coral" /> gaps ({mapData?.gaps.length ?? 0})</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0C4A5C]/50" /> OSM ({mapData?.candidates.length ?? 0})</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <div className="h-[calc(100vh-220px)] min-h-[400px] overflow-hidden rounded-2xl shadow-lg ring-1 ring-guaca-sand">
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

              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                <h2 className="shrink-0 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Live activity</h2>
                {activity.length === 0 && <EmptyCard text="No activity yet." />}
                {activity.map((e) => (
                  <div key={e.id} className="flex shrink-0 items-baseline gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-guaca-sand/60">
                    <span className="text-[12px]">{ACTIVITY_ICON[e.kind] ?? '•'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-guaca-ink">{e.kind.replaceAll('_', ' ').toLowerCase()}</p>
                      <p className="truncate text-[9px] font-semibold text-guaca-ink/40">
                        {e.agent}{typeof e.payload.reason === 'string' ? ` · ${e.payload.reason}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[8.5px] font-bold tabular-nums text-guaca-ink/30">
                      {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'overview' && overview && (
          <div>
            <PageHead title="Overview" lede="Totals with this week's movement beside them. Everything here is counted from the database, never estimated." />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {(
                [
                  ['Verified spots', overview.verifiedPlaces, BadgeCheck, 'teal', overview.deltas ? `+${overview.deltas.verifiedWeek} this week` : ''],
                  ['Open gaps', overview.openGaps, Radio, 'coral', overview.deltas ? `+${overview.deltas.gapsWeek} this week` : ''],
                  ['Active spotters', overview.activeSpotters, Users, 'teal', ''],
                  ['Conflicts', overview.pendingEscalations + overview.reportedPosts, AlertTriangle, 'coral', overview.deltas ? `${overview.deltas.conflictsResolvedWeek} resolved this week` : ''],
                  ['Waitlist', overview.pendingRegistrations, ListChecks, 'mango', overview.deltas ? `+${overview.deltas.waitlistToday} new today` : ''],
                  ['Offered missions', overview.offeredMissions, Radio, 'ocean', overview.deltas ? `+${overview.deltas.missionsWeek} this week` : ''],
                  ['OSM candidates', overview.candidates, ClipboardList, 'ocean', ''],
                  ['Awaiting payout', overview.verifiedMissions, Coins, 'mango', ''],
                  ['Properties', overview.properties, Globe2, 'ocean', ''],
                  ['Questions · 30d', overview.questions30d, Globe2, 'teal', ''],
                  ['Steward drafts', overview.pendingDrafts, Bot, 'ocean', ''],
                  ['Reported posts', overview.reportedPosts, Megaphone, 'coral', ''],
                ] as Array<[string, number, typeof Globe2, 'teal' | 'coral' | 'mango' | 'ocean', string]>
              ).map(([label, value, Icon, tone, delta]) => (
                <StatTile key={label} label={label} value={value} Icon={Icon} tone={tone} delta={delta} />
              ))}
            </div>
          </div>
        )}

        {tab === 'missions' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section>
              <h1 className="text-[16px] font-black text-guaca-ink">Open gaps · ranked by score</h1>
              <div className="mt-3 space-y-2">
                {gaps.length === 0 && <EmptyCard text="No open gaps — demand is covered." />}
                {gaps.slice(0, 15).map((g) => (
                  <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                    <span className="grid h-11 w-14 shrink-0 place-items-center rounded-xl bg-guaca-teal/8 text-[14px] font-black text-guaca-teal">
                      {g.score}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-guaca-ink">{g.category}</p>
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
                      className="h-9 rounded-xl bg-guaca-teal px-4 text-[10px] font-black text-white hover:bg-guaca-teal-dark"
                    >
                      Commission
                    </Button>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h1 className="text-[16px] font-black text-guaca-ink">Missions · newest first</h1>
              <div className="mt-3 space-y-2">
                {missions.length === 0 && <EmptyCard text="No missions yet." />}
                {missions.slice(0, 20).map((m) => (
                  <div key={m.id} className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-guaca-ink/70">{m.brief.slice(0, 80)}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${m.status === 'offered' ? 'bg-guaca-mango/15 text-guaca-ocean-deep' : m.status === 'verified' ? 'bg-guaca-teal/10 text-guaca-teal' : 'bg-guaca-ink/5 text-guaca-ink/50'}`}>
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
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section>
              <h1 className="text-[16px] font-black text-guaca-ink">Spotter roster</h1>
              <div className="mt-2 flex gap-2">
                <Input value={newSpotterName} onChange={(e) => setNewSpotterName(e.target.value)} placeholder="Name" aria-label="Name" className="h-10 w-40" />
                <Input value={newSpotterEmail} onChange={(e) => setNewSpotterEmail(e.target.value)} placeholder="email (their login)" aria-label="Email" type="email" className="h-10 w-52" />
                <Input value={newSpotterPhone} onChange={(e) => setNewSpotterPhone(e.target.value)} placeholder="+58 … (contact)" aria-label="Phone" className="h-10 w-36" />
                <Button
                  type="button"
                  disabled={busy || newSpotterName.length < 2 || newSpotterPhone.length < 6 || !newSpotterEmail.includes('@')}
                  onClick={async () => {
                    const res = await api('POST', '/api/operator/spotters', { name: newSpotterName, email: newSpotterEmail, phone: newSpotterPhone });
                    if (res) { setFlash('Spotter added.'); setNewSpotterName(''); setNewSpotterPhone(''); setNewSpotterEmail(''); await loadTab('people'); }
                  }}
                  className="h-10 rounded-xl bg-guaca-teal px-4 text-[10px] font-black text-white hover:bg-guaca-teal-dark"
                >
                  Add
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {spotters.slice(0, 30).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-guaca-sand/75">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-guaca-ink">{s.name}</p>
                      <p className="text-[10px] font-bold text-guaca-ink/45">{s.email ?? s.phone}</p>
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
              <h1 className="text-[16px] font-black text-guaca-ink">Registrations inbox</h1>
              <div className="mt-3 space-y-2">
                {registrations.length === 0 && <EmptyCard text="No pending registrations." />}
                {registrations.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                    <p className="text-[13px] font-black text-guaca-ink">
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

        {tab === 'waitlist' && (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[26px] font-black tracking-[-.02em] text-guaca-ink">Waitlist</h1>
                <p className="mt-1 text-[12px] font-bold text-guaca-ink/45">
                  Everyone who signed up on guaca.live, by role and country. The People tab is the inbox; this is the demand map.
                </p>
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await fetch('/api/operator/waitlist.csv', { headers: { authorization: `Bearer ${token}` } });
                    if (!res.ok) { setFlash(`Export failed (${res.status}).`); return; }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'guaca-waitlist.csv'; a.click();
                    URL.revokeObjectURL(url);
                    setFlash('CSV downloaded.');
                  } finally { setBusy(false); }
                }}
                className="h-9 rounded-xl bg-guaca-ocean-deep px-3 text-[10px] font-black text-white"
              >
                <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>

            {waitlist && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {(
                    [
                      ['Total', waitlist.counts.total],
                      ['Pending', waitlist.counts.pending],
                      ['Travellers', waitlist.counts.traveler],
                      ['Spotters', waitlist.counts.spotter],
                      ['Businesses', waitlist.counts.owner],
                    ] as Array<[string, number]>
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/70">
                      <p className="text-[9.5px] font-black uppercase tracking-[.08em] text-guaca-ink/40">{label}</p>
                      <p className="mt-1.5 text-[26px] font-black leading-none text-guaca-ink">{value}</p>
                    </div>
                  ))}
                </div>

                {waitlist.byCountry.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {waitlist.byCountry.map((c) => (
                      <button
                        key={c.country}
                        type="button"
                        onClick={() => setWlQuery(c.country === 'Unknown' ? '' : c.country)}
                        className="rounded-full bg-guaca-teal/10 px-2.5 py-1 text-[10px] font-black text-guaca-teal-dark hover:bg-guaca-teal/20"
                      >
                        {c.country} · {c.n}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(['all', 'pending', 'handled'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setWlStatus(st)}
                      className={`h-8 rounded-full px-3 text-[10px] font-black ${wlStatus === st ? 'bg-guaca-ink text-white' : 'bg-white text-guaca-ink/55 ring-1 ring-guaca-sand'}`}
                    >
                      {st}
                    </button>
                  ))}
                  <span className="mx-1 h-5 w-px bg-guaca-sand" />
                  {([['', 'all roles'], ['traveler', 'traveller'], ['spotter', 'spotter'], ['owner', 'business']] as const).map(([r, label]) => (
                    <button
                      key={r || 'any'}
                      type="button"
                      onClick={() => setWlRole(r)}
                      className={`h-8 rounded-full px-3 text-[10px] font-black ${wlRole === r ? 'bg-guaca-teal text-white' : 'bg-white text-guaca-ink/55 ring-1 ring-guaca-sand'}`}
                    >
                      {label}
                    </button>
                  ))}
                  <Input
                    value={wlQuery}
                    onChange={(e) => setWlQuery(e.target.value)}
                    placeholder="Search name, contact, country"
                    className="h-8 w-56 rounded-full text-[11px]"
                  />
                </div>

                <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-guaca-sand/70">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="text-[9.5px] font-black uppercase tracking-[.08em] text-guaca-ink/40">
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Role</th>
                        <th className="px-3 py-2.5">Name</th>
                        <th className="px-3 py-2.5">Contact</th>
                        <th className="px-3 py-2.5">Country</th>
                        <th className="px-3 py-2.5">Lang</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {waitlist.rows.length === 0 && (
                        <tr><td colSpan={8} className="px-3 py-6 text-center text-[12px] font-bold text-guaca-ink/40">Nobody matches these filters.</td></tr>
                      )}
                      {waitlist.rows.map((r) => (
                        <tr key={r.id} className="border-t border-guaca-sand/60">
                          <td className="whitespace-nowrap px-3 py-2 font-bold text-guaca-ink/55">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase ${
                              r.role === 'spotter' ? 'bg-guaca-coral/12 text-guaca-coral-dark'
                              : r.role === 'owner' ? 'bg-guaca-mango/20 text-guaca-mango-dark'
                              : 'bg-guaca-teal/10 text-guaca-teal-dark'}`}>
                              {r.role === 'owner' ? 'business' : r.role === 'traveler' ? 'traveller' : r.role}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-black text-guaca-ink">{r.name}</td>
                          <td className="px-3 py-2 font-bold text-guaca-ink/60">{r.contact}</td>
                          <td className="px-3 py-2 font-bold text-guaca-ink/60">{r.country || <span className="text-guaca-ink/30">unknown</span>}</td>
                          <td className="px-3 py-2 font-bold uppercase text-guaca-ink/45">{r.language}</td>
                          <td className="px-3 py-2">
                            {r.handled_at
                              ? <span className="text-[10px] font-black text-guaca-ink/40">handled</span>
                              : <span className="text-[10px] font-black text-guaca-teal">pending</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {!r.handled_at && (
                              <Button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  const res = await api('POST', `/api/operator/registrations/${r.id}/handle`, { note: 'handled via waitlist' });
                                  if (res) { setFlash('Marked handled.'); await loadTab('waitlist'); }
                                }}
                                className="h-7 rounded-xl bg-guaca-ink/6 px-2.5 text-[10px] font-black text-guaca-ink/60 hover:bg-guaca-ink/10"
                              >
                                <Check className="mr-1 h-3 w-3" /> Handled
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'ai' && (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <PageHead title="Guaca AI" lede="What the agents did, what they refused, where they failed, and how the planner scores on the standing eval set." />
              <div className="flex gap-1.5">
                {([24, 168, 720] as const).map((h) => (
                  <button key={h} type="button" onClick={() => setAiHours(h)} className={`h-8 rounded-full px-3 text-[10px] font-black ${aiHours === h ? 'bg-guaca-ink text-white' : 'bg-white text-guaca-ink/55 ring-1 ring-guaca-sand'}`}>
                    {h === 24 ? '24h' : h === 168 ? '7d' : '30d'}
                  </button>
                ))}
              </div>
            </div>

            {aiOverview && (() => {
              const c = aiOverview.calls;
              const sum = (k: keyof AiCallRow) => c.reduce((a, r) => a + Number(r[k] ?? 0), 0);
              const calls = sum('calls'), ok = sum('ok'), schema = sum('schema_errors'), timeouts = sum('timeouts');
              const avg = calls ? Math.round(c.reduce((a, r) => a + r.avg_ms * r.calls, 0) / calls) : 0;
              const q = aiOverview.questions;
              return (
                <>
                  <p className="mt-3 text-[11px] font-bold text-guaca-ink/45">
                    Text model <span className="font-black text-guaca-ink">{aiOverview.models.text ?? 'unset'}</span> · Vision <span className="font-black text-guaca-ink">{aiOverview.models.vision ?? 'unset'}</span>
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                    <StatTile label="Inference calls" value={calls} Icon={Activity} tone="ocean" delta={`${aiOverview.hours}h window`} />
                    <StatTile label="Success rate" value={calls ? Math.round((ok / calls) * 100) : 100} suffix="%" Icon={BadgeCheck} tone={calls && ok / calls < 0.9 ? 'coral' : 'teal'} delta={`${calls - ok} failed`} />
                    <StatTile label="Schema failures" value={schema} Icon={AlertTriangle} tone={schema ? 'coral' : 'teal'} delta={`${timeouts} timeouts`} />
                    <StatTile label="Avg latency" value={avg} suffix=" ms" Icon={Activity} tone="ocean" delta={`p95 ${Math.max(0, ...c.map((r) => r.p95_ms))} ms`} />
                    <StatTile label="Tokens" value={sum('tokens_in') + sum('tokens_out')} Icon={Coins} tone="mango" delta={`${sum('tokens_out').toLocaleString()} out`} />
                    <StatTile label="Questions answered" value={q.answered} Icon={Sparkles} tone={q.total && q.refused / q.total > 0.5 ? 'coral' : 'teal'} delta={`${q.refused} refused of ${q.total}`} />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/70">
                      <h2 className="text-[12px] font-black uppercase tracking-[.08em] text-guaca-ink/50">Refusals by reason</h2>
                      <p className="mt-1 text-[10.5px] font-bold text-guaca-ink/40">A refusal is demand the map cannot meet yet. This is what the gap agent turns into missions.</p>
                      <div className="mt-3 space-y-2">
                        {aiOverview.refusals.length === 0 && <EmptyCard text="No refusals in this window." />}
                        {aiOverview.refusals.map((r) => {
                          const max = aiOverview.refusals[0]?.n ?? 1;
                          return (
                            <div key={r.reason}>
                              <div className="flex justify-between text-[11px] font-black text-guaca-ink"><span>{r.reason}</span><span className="tabular-nums">{r.n}</span></div>
                              <div className="mt-1 h-1.5 rounded-full bg-guaca-sand-light"><div className="h-1.5 rounded-full bg-guaca-coral" style={{ width: `${Math.max(6, (r.n / max) * 100)}%` }} /></div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/70">
                      <h2 className="text-[12px] font-black uppercase tracking-[.08em] text-guaca-ink/50">Calls by purpose</h2>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead><tr className="text-[9px] font-black uppercase tracking-[.08em] text-guaca-ink/40"><th className="py-1.5 pr-2">Purpose</th><th className="py-1.5 pr-2">Model</th><th className="py-1.5 pr-2 text-right">Calls</th><th className="py-1.5 pr-2 text-right">OK</th><th className="py-1.5 pr-2 text-right">p95</th></tr></thead>
                          <tbody>
                            {c.length === 0 && <tr><td colSpan={5} className="py-4 text-center font-bold text-guaca-ink/40">No inference calls in this window.</td></tr>}
                            {c.map((r) => (
                              <tr key={`${r.purpose}-${r.model}`} className="border-t border-guaca-sand/60 font-bold text-guaca-ink/70">
                                <td className="py-1.5 pr-2 font-black text-guaca-ink">{r.purpose}</td>
                                <td className="max-w-[160px] truncate py-1.5 pr-2">{r.model.split('/').pop()}</td>
                                <td className="py-1.5 pr-2 text-right tabular-nums">{r.calls}</td>
                                <td className={`py-1.5 pr-2 text-right tabular-nums ${r.ok < r.calls ? 'text-guaca-coral-dark' : ''}`}>{Math.round((r.ok / r.calls) * 100)}%</td>
                                <td className="py-1.5 pr-2 text-right tabular-nums">{r.p95_ms} ms</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {aiOverview.verification.length > 0 && (
                        <p className="mt-3 text-[10.5px] font-bold text-guaca-ink/45">
                          Verification: {aiOverview.verification.map((v) => `${v.n} ${v.decision} by ${v.decided_by}`).join(' · ')}
                        </p>
                      )}
                    </section>
                  </div>
                </>
              );
            })()}

            <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/70">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[12px] font-black uppercase tracking-[.08em] text-guaca-ink/50">Benchmarks</h2>
                  <p className="mt-1 text-[10.5px] font-bold text-guaca-ink/40">Thirty fixed prompts, English and Spanish, through the real guard. A pass means the outcome matched what the prompt should produce.</p>
                </div>
                <form
                  className="flex items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await api<{ started: boolean; model: string }>('POST', '/api/operator/ai/bench', { model: benchModel });
                    if (res) { setFlash(`Benchmark started for ${res.model}. Results appear here when it finishes (a few minutes).`); await loadTab('ai'); }
                  }}
                >
                  <Input list="bench-models" value={benchModel} onChange={(e) => setBenchModel(e.target.value)} placeholder="model id" className="h-9 w-72 text-[11px]" />
                  <datalist id="bench-models">
                    {[...new Set([aiOverview?.models.text ?? '', ...aiBenchmarks.map((b) => b.model)].filter(Boolean))].map((m) => <option key={m} value={m} />)}
                  </datalist>
                  <Button type="submit" disabled={busy || !!aiRunning || !benchModel.trim()} className="h-9 rounded-xl bg-guaca-ocean-deep px-3 text-[10px] font-black text-white">
                    <Play className="mr-1 h-3.5 w-3.5" /> {aiRunning ? `Running ${aiRunning.model.split('/').pop()}…` : 'Run benchmark'}
                  </Button>
                </form>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead><tr className="text-[9px] font-black uppercase tracking-[.08em] text-guaca-ink/40">
                    <th className="py-1.5 pr-2">When</th><th className="py-1.5 pr-2">Model</th><th className="py-1.5 pr-2">Rows</th><th className="py-1.5 pr-2 text-right">Pass</th><th className="py-1.5 pr-2 text-right">Plans</th><th className="py-1.5 pr-2 text-right">Refusals</th><th className="py-1.5 pr-2 text-right">Schema</th><th className="py-1.5 pr-2 text-right">Avg</th><th className="py-1.5 pr-2 text-right">p95</th><th className="py-1.5 pr-2 text-right">Tokens</th><th className="py-1.5 pr-2">By</th>
                  </tr></thead>
                  <tbody>
                    {aiBenchmarks.length === 0 && <tr><td colSpan={11} className="py-4 text-center font-bold text-guaca-ink/40">No benchmark yet. Run one against the current model to set the baseline.</td></tr>}
                    {aiBenchmarks.map((b) => (
                      <tr key={b.id} className="border-t border-guaca-sand/60 font-bold text-guaca-ink/70">
                        <td className="whitespace-nowrap py-1.5 pr-2">{new Date(b.ts).toLocaleString()}</td>
                        <td className="max-w-[200px] truncate py-1.5 pr-2 font-black text-guaca-ink">{b.model}</td>
                        <td className="py-1.5 pr-2">{b.rows_source}</td>
                        <td className={`py-1.5 pr-2 text-right font-black tabular-nums ${b.passes / b.prompts >= 0.8 ? 'text-guaca-teal' : b.passes / b.prompts >= 0.5 ? 'text-guaca-mango-dark' : 'text-guaca-coral-dark'}`}>{b.passes}/{b.prompts}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{b.plans} <span className="text-guaca-ink/40">({b.fast_path} fast)</span></td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{b.refusals}</td>
                        <td className={`py-1.5 pr-2 text-right tabular-nums ${b.schema_errors ? 'text-guaca-coral-dark' : ''}`}>{b.schema_errors}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{b.avg_ms} ms</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{b.p95_ms} ms</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{(b.tokens_in + b.tokens_out).toLocaleString()}</td>
                        <td className="py-1.5 pr-2">{b.triggered_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {aiBenchmarks[0]?.results && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] font-black text-guaca-teal-dark">Latest run, prompt by prompt</summary>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    {aiBenchmarks[0].results.map((r) => (
                      <div key={r.id} className={`rounded-xl px-3 py-2 text-[10.5px] font-bold ring-1 ${r.pass ? 'bg-guaca-teal/8 ring-guaca-teal/20 text-guaca-ink/70' : 'bg-guaca-coral/8 ring-guaca-coral/25 text-guaca-ink/70'}`}>
                        <span className="font-black text-guaca-ink">{r.id}</span> · {r.outcome}{r.path ? ` via ${r.path}` : ''} · {r.ms} ms{r.reason ? ` · ${r.reason}` : ''}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>

            {aiFailures && (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/70">
                  <h2 className="text-[12px] font-black uppercase tracking-[.08em] text-guaca-ink/50">Failed calls</h2>
                  <div className="mt-3 space-y-2">
                    {aiFailures.failedCalls.length === 0 && <EmptyCard text="No failed inference calls recorded." />}
                    {aiFailures.failedCalls.map((f) => (
                      <div key={f.id} className="rounded-xl bg-guaca-coral/6 px-3 py-2 ring-1 ring-guaca-coral/20">
                        <div className="flex justify-between text-[10.5px] font-black text-guaca-ink"><span>{f.purpose} · <span className="uppercase text-guaca-coral-dark">{f.error_kind}</span></span><span className="text-guaca-ink/40">{timeAgo(f.ts)}</span></div>
                        <p className="mt-0.5 truncate text-[10px] font-bold text-guaca-ink/55">{f.model.split('/').pop()} · {f.latency_ms} ms · {f.error_message ?? ''}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/70">
                  <h2 className="text-[12px] font-black uppercase tracking-[.08em] text-guaca-ink/50">Refused questions</h2>
                  <div className="mt-3 space-y-2">
                    {aiFailures.refusedQuestions.length === 0 && <EmptyCard text="No refused questions yet." />}
                    {aiFailures.refusedQuestions.map((r) => (
                      <div key={r.id} className="rounded-xl bg-guaca-sand-light px-3 py-2">
                        <div className="flex justify-between text-[10.5px] font-black text-guaca-ink"><span className="truncate">“{r.raw_text}”</span><span className="shrink-0 text-guaca-ink/40">{timeAgo(r.ts)}</span></div>
                        <p className="mt-0.5 text-[10px] font-bold text-guaca-ink/55">{r.refusal_reason ?? 'no reason'} · {r.language.toUpperCase()}{r.area ? ` · ${r.area}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {tab === 'access' && (
          <div>
            <h1 className="text-[26px] font-black tracking-[-.02em] text-guaca-ink">Access</h1>
            <p className="mt-1 text-[12px] font-bold text-guaca-ink/45">
              Who can sign in to this panel. An email not on this list cannot request a code. Every change here is audited.
            </p>

            <form
              className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/70"
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await api('POST', '/api/operator/operators', { email: newOpEmail, name: newOpName, role: newOpRole });
                if (res) {
                  setFlash(`${newOpEmail.trim().toLowerCase()} can now sign in as ${newOpRole}.`);
                  setNewOpEmail(''); setNewOpName('');
                  await loadTab('access');
                }
              }}
            >
              <label className="flex flex-col gap-1 text-[9.5px] font-black uppercase tracking-[.08em] text-guaca-ink/40">
                Email
                <Input value={newOpEmail} onChange={(e) => setNewOpEmail(e.target.value)} placeholder="person@guaca.live" className="h-9 w-60 text-[12px] normal-case tracking-normal" />
              </label>
              <label className="flex flex-col gap-1 text-[9.5px] font-black uppercase tracking-[.08em] text-guaca-ink/40">
                Name
                <Input value={newOpName} onChange={(e) => setNewOpName(e.target.value)} placeholder="Full name" className="h-9 w-48 text-[12px] normal-case tracking-normal" />
              </label>
              <label className="flex flex-col gap-1 text-[9.5px] font-black uppercase tracking-[.08em] text-guaca-ink/40">
                Role
                <select
                  value={newOpRole}
                  onChange={(e) => setNewOpRole(e.target.value as 'admin' | 'operator' | 'moderator')}
                  className="h-9 rounded-xl border border-guaca-sand bg-white px-2 text-[12px] font-bold normal-case tracking-normal text-guaca-ink"
                >
                  <option value="operator">operator</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <Button type="submit" disabled={busy || !newOpEmail.trim() || !newOpName.trim()} className="h-9 rounded-xl bg-guaca-ocean-deep px-4 text-[10px] font-black text-white">
                Add to allowlist
              </Button>
            </form>

            <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-guaca-sand/70">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-[9.5px] font-black uppercase tracking-[.08em] text-guaca-ink/40">
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Last sign in</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {operators.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-[12px] font-bold text-guaca-ink/40">No operators yet.</td></tr>
                  )}
                  {operators.map((o) => (
                    <tr key={o.id} className={`border-t border-guaca-sand/60 ${o.active ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-2 font-black text-guaca-ink">{o.name}</td>
                      <td className="px-3 py-2 font-bold text-guaca-ink/60">{o.email}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase ${
                          o.role === 'admin' ? 'bg-guaca-coral/12 text-guaca-coral-dark'
                          : o.role === 'moderator' ? 'bg-guaca-mango/20 text-guaca-mango-dark'
                          : 'bg-guaca-teal/10 text-guaca-teal-dark'}`}>{o.role}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold text-guaca-ink/55">
                        {o.lastLoginAt ? new Date(o.lastLoginAt).toLocaleString() : <span className="text-guaca-ink/30">never</span>}
                      </td>
                      <td className="px-3 py-2">
                        {o.active
                          ? <span className="text-[10px] font-black text-guaca-teal">active</span>
                          : <span className="text-[10px] font-black text-guaca-ink/40">deactivated</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            if (o.active && !window.confirm(`Deactivate ${o.email}? They will not be able to sign in until reactivated.`)) return;
                            const res = await api('POST', `/api/operator/operators/${o.id}/active`, { active: !o.active });
                            if (res) { setFlash(o.active ? `${o.email} deactivated.` : `${o.email} reactivated.`); await loadTab('access'); }
                          }}
                          className={`h-7 rounded-xl px-2.5 text-[10px] font-black ${o.active ? 'bg-guaca-ink/6 text-guaca-ink/60 hover:bg-guaca-coral/15 hover:text-guaca-coral-dark' : 'bg-guaca-teal/10 text-guaca-teal-dark hover:bg-guaca-teal/20'}`}
                        >
                          {o.active ? <><Ban className="mr-1 h-3 w-3" /> Deactivate</> : <><Check className="mr-1 h-3 w-3" /> Reactivate</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'moderation' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
            <section>
              <div className="flex items-baseline justify-between">
                <h1 className="text-[16px] font-black text-guaca-ink">Conflicts · {conflicts.length} needing attention</h1>
                <span className="text-[9px] font-bold text-guaca-ink/35">
                  {conflicts.filter((c) => c.severity === 'high').length} high · {' '}
                  {conflicts.filter((c) => c.kind === 'escalation').length} escalations · {' '}
                  {conflicts.filter((c) => c.kind === 'post_report').length} reports
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {conflicts.length === 0 && <EmptyCard text="No conflicts — the system is calm." />}
                {conflicts.map((c) => (
                  <div key={c.id} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${c.severity === 'high' ? 'ring-guaca-coral/30' : 'ring-guaca-sand/75'}`}>
                    <button type="button" className="flex w-full items-start gap-2.5 text-left" onClick={() => setExpandedConflict(expandedConflict === c.id ? null : c.id)}>
                      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.severity === 'high' ? 'bg-guaca-coral' : c.severity === 'normal' ? 'bg-guaca-mango' : 'bg-guaca-ink/20'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-guaca-ink">{c.title}</p>
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
                        <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-guaca-sand-light/70 p-3 text-[10px] leading-relaxed text-guaca-ink/70">
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

            <section className="space-y-5">
              <div>
                <h2 className="text-[13px] font-black text-guaca-ink">File an issue</h2>
                <div className="mt-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
                  <Input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder="What needs fixing?" aria-label="Issue title" className="h-10 w-full" />
                  <Input value={issueDetail} onChange={(e) => setIssueDetail(e.target.value)} placeholder="Detail (optional)" aria-label="Detail" className="mt-2 h-10 w-full" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
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
              </div>

              <div>
                <h2 className="text-[13px] font-black text-guaca-ink">Issues · {issues.filter((i) => i.status === 'open').length} open</h2>
                <div className="mt-2 max-h-[500px] space-y-2 overflow-y-auto">
                  {issues.length === 0 && <EmptyCard text="No issues filed." />}
                  {issues.map((i) => (
                    <div key={i.id} className={`rounded-2xl bg-white p-3 shadow-sm ring-1 ${i.priority === 'urgent' ? 'ring-guaca-coral/30' : 'ring-guaca-sand/75'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-black text-guaca-ink">{i.title}</p>
                          {i.detail && <p className="text-[10px] font-semibold text-guaca-ink/45">{i.detail}</p>}
                          <p className="mt-0.5 text-[9px] font-bold uppercase text-guaca-ink/30">
                            {i.kind} · {i.priority} · {new Date(i.createdAt).toLocaleDateString()}
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
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 'steward' && (
          <div className="max-w-2xl">
            <StewardReview />
          </div>
        )}
      </main>

      {/* Live activity: the pulse of the network, on every tab */}
      <aside className="hidden w-[300px] shrink-0 flex-col border-l border-guaca-sand/80 bg-white/60 xl:flex">
        <div className="flex items-center justify-between px-5 pb-3 pt-6">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-guaca-ink/50">Live activity</p>
          <span className="flex items-center gap-1.5 text-[10px] font-black text-guaca-teal"><span className="h-2 w-2 rounded-full bg-guaca-teal ring-4 ring-guaca-teal/15" /> Live</span>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {activity.length === 0 && <EmptyCard text="Nothing yet. Events appear here as the loop runs." />}
          {activity.slice(0, 40).map((e) => {
            const v = describeEvent(e);
            return (
              <div key={e.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-guaca-sand/70">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${v.bg}`}><v.Icon className={`h-4 w-4 ${v.fg}`} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="flex items-center gap-1.5 truncate text-[12px] font-black text-guaca-ink"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${v.dot}`} />{v.title}</p>
                    <span className="shrink-0 text-[9.5px] font-bold text-guaca-ink/35">{timeAgo(e.createdAt)}</span>
                  </div>
                  <p className="truncate text-[10.5px] font-bold text-guaca-ink/50">{v.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setTab('map')} className="m-4 mt-0 rounded-2xl bg-guaca-sand-light px-3 py-2.5 text-[11px] font-black text-guaca-ink/60 hover:bg-guaca-sand">
          View all activity
        </button>
      </aside>
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

function PageHead({ title, lede }: { title: string; lede: string }) {
  return (
    <div>
      <h1 className="text-[26px] font-black tracking-[-.02em] text-guaca-ink">{title}</h1>
      <p className="mt-1 max-w-2xl text-[12.5px] font-bold text-guaca-ink/45">{lede}</p>
    </div>
  );
}

const TONE: Record<'teal' | 'coral' | 'mango' | 'ocean', { ring: string; icon: string; delta: string }> = {
  teal: { ring: 'bg-guaca-teal/10', icon: 'text-guaca-teal', delta: 'text-guaca-teal' },
  coral: { ring: 'bg-guaca-coral/12', icon: 'text-guaca-coral', delta: 'text-guaca-coral-dark' },
  mango: { ring: 'bg-guaca-mango/20', icon: 'text-guaca-mango-dark', delta: 'text-guaca-mango-dark' },
  ocean: { ring: 'bg-guaca-ocean/10', icon: 'text-guaca-ocean', delta: 'text-guaca-ink/45' },
};

function StatTile({ label, value, suffix = '', Icon, tone, delta }: { label: string; value: number; suffix?: string; Icon: typeof Globe2; tone: keyof typeof TONE; delta: string }) {
  const t = TONE[tone];
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-guaca-sand/70">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${t.ring}`}><Icon className={`h-5 w-5 ${t.icon}`} /></span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-black uppercase tracking-[.06em] text-guaca-ink/45">{label}</p>
        <p className="text-[24px] font-black leading-none tabular-nums text-guaca-ink">{value.toLocaleString()}{suffix}</p>
        {delta && <p className={`mt-1 truncate text-[10px] font-bold ${t.delta}`}>{delta}</p>}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function describeEvent(e: ActivityEvent): { title: string; subtitle: string; Icon: typeof Globe2; bg: string; fg: string; dot: string } {
  const p = e.payload ?? {};
  const pick = (...keys: string[]) => { for (const k of keys) { const v = p[k]; if (typeof v === 'string' && v.trim()) return v; } return ''; };
  const byKind: Record<string, [string, typeof Globe2, 'teal' | 'coral' | 'mango' | 'ocean']> = {
    QUESTION_ASKED: ['Question asked', Sparkles, 'ocean'],
    MISSION_COMMISSIONED: ['Mission created', Radio, 'coral'],
    PLACE_VERIFIED: ['Place verified', BadgeCheck, 'teal'],
    GAP_OPENED: ['Gap created', Radio, 'coral'],
    REGISTRATION: ['Waitlist signup', ListChecks, 'mango'],
  };
  // Operator actions arrive as OPERATOR_<ACTION> with the action code in
  // payload.reason; the code stays in the subtitle because it is what the
  // audit log says, and the title says it in words.
  const byAction: Record<string, string> = {
    'operator.upsert': 'Operator added or updated', 'operator.deactivate': 'Operator deactivated',
    'spotter.add': 'Spotter added', 'waitlist.export': 'Waitlist exported', 'ai.benchmark': 'Benchmark run',
    'issue.create': 'Issue opened', 'issue.resolve': 'Issue resolved', 'spotter.commission': 'Mission commissioned',
  };
  const action = e.kind.startsWith('OPERATOR_') ? pick('reason') : '';
  const fallback = e.kind.startsWith('OPERATOR_')
    ? `Operator: ${e.kind.slice(9).toLowerCase().replace(/_/g, ' ')}`
    : e.kind.toLowerCase().replace(/[._]/g, ' ');
  const [title, Icon, tone] = byKind[e.kind] ?? [byAction[action] ?? fallback, action ? KeyRound : Activity, 'ocean'];
  const t = TONE[tone];
  return { title, subtitle: pick('name', 'title', 'brief', 'text', 'raw_text', 'email', 'reason') || `${e.agent}`, Icon, bg: t.ring, fg: t.icon, dot: tone === 'coral' ? 'bg-guaca-coral' : tone === 'mango' ? 'bg-guaca-mango' : 'bg-guaca-teal' };
}
