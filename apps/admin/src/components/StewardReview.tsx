'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Bot, Check, RefreshCcw, X } from 'lucide-react';
import { Button, Input } from '@guaca/ui';

/**
 * The AI steward's review queue — the "AI person" that drafts candidate
 * enrichment and the team that confirms it. The AI's output never reaches
 * a tourist: an approval only enriches an OpenStreetMap CANDIDATE, and a
 * candidate still needs a Spotter's physical verification to become a pin.
 */
interface Draft {
  id: string;
  candidateName: string;
  candidateCategory: string;
  draft: {
    category: string;
    landmarkHint: string;
    whyLikely: string;
    photoChecklist: string[];
    suggestedTags: string[];
  };
}

const TOKEN_KEY = 'guaca:op-token';

export function StewardReview() {
  const [token, setToken] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY) ?? '');
    } catch {
      /* private mode etc. */
    }
  }, []);

  const authHeaders = () => ({
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  });

  const loadDrafts = async () => {
    if (!token) return;
    setBusy(true);
    setError(false);
    setMessage(null);
    try {
      localStorage.setItem(TOKEN_KEY, token);
      const res = await fetch('/api/operator/steward/drafts?status=pending', {
        headers: authHeaders(),
      });
      if (!res.ok) {
        setError(true);
        setMessage(res.status === 401 ? 'Wrong operator token.' : `API error ${res.status}.`);
        return;
      }
      setDrafts(((await res.json()) as { drafts: Draft[] }).drafts);
    } catch {
      setError(true);
      setMessage('Cannot reach the API.');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, action: 'approve' | 'reject', note?: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/operator/steward/drafts/${id}/${action}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        setError(true);
        setMessage(`Failed to ${action}.`);
        return;
      }
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setMessage(action === 'approve' ? 'Approved — candidate enriched; a Spotter still verifies it on the ground.' : 'Rejected.');
      setError(false);
    } catch {
      setError(true);
      setMessage('Cannot reach the API.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-7 rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-guaca-sand/80">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[.1em] text-guaca-teal">
        <Bot aria-hidden="true" className="h-4 w-4" /> AI steward — candidate drafts
      </p>
      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-guaca-ink/55">
        The AI drafts enrichment for OpenStreetMap candidates; the team confirms each one by
        hand. Approvals only enrich a <strong>candidate</strong> — nothing reaches the tourist
        map until a Spotter physically verifies it.
      </p>

      <div className="mt-3 flex gap-2">
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Operator token"
          aria-label="Operator token"
          className="h-9 flex-1 text-[12px]"
        />
        <Button
          type="button"
          disabled={busy || token.length === 0}
          onClick={() => void loadDrafts()}
          className="h-9 rounded-xl bg-guaca-teal px-4 text-[11px] font-black text-white hover:bg-guaca-teal-dark"
        >
          <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Load
        </Button>
      </div>

      {message && (
        <p className={`mt-2 text-[11px] font-bold ${error ? 'text-guaca-coral-dark' : 'text-guaca-teal'}`}>
          {message}
        </p>
      )}

      <div className="mt-3 space-y-3">
        {drafts.length === 0 && !busy && (
          <p className="rounded-2xl border border-dashed border-guaca-sand px-4 py-3 text-center text-[11px] font-semibold text-guaca-ink/40">
            No pending drafts. Generate some with <code>guaca steward enrich</code>.
          </p>
        )}
        {drafts.map((d) => (
          <div key={d.id} className="rounded-[20px] bg-guaca-sand-light/70 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-black text-guaca-ink">{d.candidateName}</p>
              <span className="shrink-0 rounded-full bg-guaca-teal/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-guaca-teal">
                {d.draft.category}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-bold italic text-guaca-ink/70">“{d.draft.landmarkHint}”</p>
            <p className="mt-1 text-[10px] font-semibold leading-relaxed text-guaca-ink/50">
              Why: {d.draft.whyLikely}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-guaca-ink/50">
              Photos: {d.draft.photoChecklist.join(' · ')}
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void decide(d.id, 'approve')}
                className="h-8 flex-1 rounded-xl bg-guaca-teal text-[10px] font-black text-white hover:bg-guaca-teal-dark"
              >
                <Check className="mr-1 h-3 w-3" /> Approve
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  const note = window.prompt('Why reject this draft?') ?? '';
                  if (note.trim().length === 0) return;
                  void decide(d.id, 'reject', note);
                }}
                className="h-8 flex-1 rounded-xl bg-guaca-ink/8 text-[10px] font-black text-guaca-ink/70 hover:bg-guaca-coral/12 hover:text-guaca-coral-dark"
              >
                <X className="mr-1 h-3 w-3" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 flex items-center gap-1 text-[9px] font-bold text-guaca-ink/35">
        <BadgeCheck className="h-3 w-3" /> every decision is audited in operator_actions
      </p>
    </section>
  );
}
