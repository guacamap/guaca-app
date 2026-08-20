/**
 * `guaca steward` — the AI steward's review queue, over the API (the
 * inference lives in the API; the CLI never calls a model itself).
 *
 *   guaca steward enrich [--limit 10]   draft enrichment for OSM candidates
 *   guaca steward drafts [--status pending|approved|rejected]
 *   guaca steward approve <id> [--note "..."]
 *   guaca steward reject <id> --note "..."
 *
 * Auth is the same OPERATOR_TOKEN the mutating CLI commands require.
 */

export interface StewardDraftView {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateCategory: string;
  existingLandmark: string | null;
  model: string;
  draft: {
    category: string;
    landmarkHint: string;
    whyLikely: string;
    photoChecklist: string[];
    suggestedTags: string[];
  };
  status: string;
  reviewNote: string | null;
  createdAt: string;
}

export interface StewardApi {
  enrich(limit: number): Promise<{ drafted: number; skipped: number; considered: number }>;
  drafts(status: string): Promise<StewardDraftView[]>;
  approve(id: string, note?: string): Promise<{ ok: boolean; error?: string }>;
  reject(id: string, note: string): Promise<{ ok: boolean; error?: string }>;
}

/** Build the API client; `fetchImpl` injected for tests. */
export function stewardApi(
  baseUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): StewardApi {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(json.error ?? `${method} ${path} failed: ${res.status}`);
    return json;
  };
  return {
    enrich: (limit) => call('POST', '/api/operator/steward/enrich', { limit }),
    drafts: (status) =>
      call<{ drafts: StewardDraftView[] }>('GET', `/api/operator/steward/drafts?status=${status}`).then(
        (r) => r.drafts,
      ),
    approve: async (id, note) => {
      try {
        await call('POST', `/api/operator/steward/drafts/${id}/approve`, { note });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
    reject: async (id, note) => {
      try {
        await call('POST', `/api/operator/steward/drafts/${id}/reject`, { note });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  };
}

/** Render the queue for a terminal — team-facing, so readable over JSON. */
export function renderDraft(d: StewardDraftView): string {
  const lines = [
    `# ${d.id}`,
    `  candidate : ${d.candidateName} (importer category: ${d.candidateCategory})`,
    `  ai category: ${d.draft.category}`,
    `  hint (es)  : ${d.draft.landmarkHint}`,
    `  why        : ${d.draft.whyLikely}`,
    `  photos     : ${d.draft.photoChecklist.join('; ')}`,
    `  tags       : ${d.draft.suggestedTags.join(', ') || '(none)'}`,
  ];
  if (d.status !== 'pending') {
    lines.push(`  status    : ${d.status}${d.reviewNote ? ` — ${d.reviewNote}` : ''}`);
  }
  return lines.join('\n');
}
