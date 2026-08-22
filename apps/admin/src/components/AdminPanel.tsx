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
import { Button, GuacaLogo, Input } from '@guaca/ui';
import { StewardReview } from './StewardReview';

/**
 * The admin panel — every operator capability the CLI has, behind the same
 * OPERATOR_TOKEN, with the audit trail the database already keeps. English
 * by design: this is the team's tool, not a tourist surface.
 */

const TOKEN_KEY = 'guaca:op-token';

type Tab = 'overview' | 'missions' | 'people' | 'moderation' | 'steward';

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
  const [tab, setTab] = useState<Tab>('overview');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [spotters, setSpotters] = useState<Spotter[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [posts, setPosts] = useState<ReportedPost[]>([]);
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
        const p = await api<{ posts: ReportedPost[] }>('GET', '/api/operator/posts/reported');
        if (p) setPosts(p.posts);
        const q = await api<{ queue: QueueItem[] }>('GET', '/api/operator/queue');
        if (q) setQueue(q.queue);
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
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Reported posts</h2>
            <div className="mt-2 space-y-2">
              {posts.length === 0 && <EmptyCard text="No reported posts awaiting review." />}
              {posts.map((p) => (
                <div key={p.id} className="rounded-[20px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                  <p className="text-[12px] font-bold text-guaca-ink">“{p.body.slice(0, 80)}”</p>
                  <p className="text-[10px] font-bold text-guaca-ink/45">{p.author} · {p.reports} reports</p>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const res = await api('POST', `/api/operator/posts/${p.id}/hide`);
                      if (res) { setFlash('Post hidden.'); await loadTab('moderation'); }
                    }}
                    className="mt-2 h-8 rounded-xl bg-guaca-coral/10 px-3 text-[10px] font-black text-guaca-coral-dark hover:bg-guaca-coral/20"
                  >
                    <X className="mr-1 h-3 w-3" /> Hide
                  </Button>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[.1em] text-guaca-ink/50">Verification escalations</h2>
            <div className="mt-2 space-y-2">
              {queue.length === 0 && <EmptyCard text="Queue is empty." />}
              {queue.map((q) => (
                <div key={q.id} className="rounded-[20px] bg-white p-3.5 shadow-sm ring-1 ring-guaca-sand/75">
                  <p className="text-[12px] font-black text-guaca-ink">{q.placeName ?? q.id}</p>
                  {q.reason && <p className="text-[10px] font-bold text-guaca-ink/45">{q.reason}</p>}
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const res = await api('POST', `/api/operator/verify/${q.id}`, { decision: 'approve' });
                        if (res) { setFlash('Approved.'); await loadTab('moderation'); }
                      }}
                      className="h-8 flex-1 rounded-xl bg-guaca-teal text-[10px] font-black text-white hover:bg-guaca-teal-dark"
                    >
                      <Check className="mr-1 h-3 w-3" /> Approve
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const res = await api('POST', `/api/operator/verify/${q.id}`, { decision: 'reject', note: 'admin panel' });
                        if (res) { setFlash('Rejected.'); await loadTab('moderation'); }
                      }}
                      className="h-8 flex-1 rounded-xl bg-guaca-ink/6 text-[10px] font-black text-guaca-ink/60 hover:bg-guaca-coral/12 hover:text-guaca-coral-dark"
                    >
                      <X className="mr-1 h-3 w-3" /> Reject
                    </Button>
                  </div>
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
