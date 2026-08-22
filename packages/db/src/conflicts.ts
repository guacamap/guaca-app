import type { Pool } from 'pg';

export type ConflictKind =
  | 'escalation'
  | 'l6_denial'
  | 'recheck_request'
  | 'post_report'
  | 'rejected_submission';

export interface ConflictRow {
  id: string;
  kind: ConflictKind;
  severity: 'high' | 'normal' | 'low';
  title: string;
  detail: string | null;
  evidence: Record<string, unknown>;
  createdAt: string;
  /** For escalations: the verification_run id, so approve/reject works. */
  verificationRunId?: string;
  /** For post reports: the post id, so hide/show works. */
  postId?: string;
}

/**
 * The unified conflict feed — everything that needs a human decision, in
 * one query. Each kind carries its own evidence so the moderator sees WHY
 * it's flagged, not just THAT it's flagged:
 *
 * - escalations: the verification ladder couldn't decide (mid-band trust,
 *   inconclusive geo, vision uncertainty) and punted to a human
 * - l6_denials: a second local DENIED the verification — rivalry and
 *   honest error both exist, always escalated
 * - recheck_requests: a traveller doubted a place's freshness
 *   ("still accurate?" → no) — the demand that funds refresh missions
 * - post_reports: reported user content (auto-hidden at 2 reports,
 *   but the moderator confirms or restores)
 * - rejected_submissions: places the ladder rejected — surfaced so the
 *   moderator can spot patterns (a Spotter filing junk, a zone with
 *   systematic data problems)
 */
export async function operatorConflicts(pool: Pool): Promise<ConflictRow[]> {
  const [escalations, denials, rechecks, reports, rejects] = await Promise.all([
    pool.query(
      `select vr.id, vr.place_id, vr.checks, vr.created_at,
              p.name as place_name
         from verification_runs vr
         left join places p on p.id = vr.place_id
        where vr.decision = 'escalated'
        order by vr.created_at desc
        limit 20`,
    ),
    pool.query(
      `select vr.id, vr.place_id, vr.checks, vr.created_at,
              p.name as place_name
         from verification_runs vr
         left join places p on p.id = vr.place_id
        where vr.decision = 'DENY' and vr.decided_by = 'second_local'
        order by vr.created_at desc
        limit 20`,
    ),
    pool.query(
      `select q.id, q.raw_text, q.created_at, q.intent->>'category' as category
         from questions q
        where q.refusal_reason = 'RECHECK_REQUESTED'
        order by q.created_at desc
        limit 20`,
    ),
    pool.query(
      `select pp.id, pp.body, pp.status, count(*)::int as reports,
              coalesce(t.email, s.name, 'unknown') as author,
              max(r.created_at) as latest_report
         from place_post_reports r
         join place_posts pp on pp.id = r.post_id
         left join tourists t on t.id = pp.tourist_id
         left join spotters s on s.id = pp.spotter_id
        group by pp.id, pp.body, pp.status, t.email, s.name
        order by reports desc, latest_report desc
        limit 20`,
    ),
    pool.query(
      `select p.id, p.name, p.rejection_reason, p.created_at,
              s.name as spotter_name
         from places p
         left join spotters s on s.id = p.created_by_spotter_id
        where p.verification_status = 'rejected'
        order by p.created_at desc
        limit 20`,
    ),
  ]);

  const out: ConflictRow[] = [];

  for (const r of escalations.rows as Array<{ id: string; place_id: string; checks: Record<string, unknown>; created_at: Date; place_name: string | null }>) {
    out.push({
      id: `esc:${r.id}`,
      kind: 'escalation',
      severity: 'high',
      title: `Verification escalated: ${r.place_name ?? r.place_id}`,
      detail: 'The ladder could not decide — needs human judgment.',
      evidence: r.checks ?? {},
      createdAt: r.created_at.toISOString(),
      verificationRunId: r.id,
    });
  }

  for (const r of denials.rows as Array<{ id: string; place_id: string; checks: Record<string, unknown>; created_at: Date; place_name: string | null }>) {
    out.push({
      id: `l6:${r.id}`,
      kind: 'l6_denial',
      severity: 'high',
      title: `Second local DENIED: ${r.place_name ?? r.place_id}`,
      detail: 'A different local rejected this verification — rivalry or honest error, always human.',
      evidence: r.checks ?? {},
      createdAt: r.created_at.toISOString(),
      verificationRunId: r.id,
    });
  }

  for (const r of rechecks.rows as Array<{ id: string; raw_text: string; created_at: Date; category: string | null }>) {
    out.push({
      id: `rc:${r.id}`,
      kind: 'recheck_request',
      severity: 'normal',
      title: `Freshness doubt: ${r.category ?? 'unknown category'}`,
      detail: r.raw_text,
      evidence: { category: r.category },
      createdAt: r.created_at.toISOString(),
    });
  }

  for (const r of reports.rows as Array<{ id: string; body: string; status: string; reports: number; author: string; latest_report: Date }>) {
    out.push({
      id: `post:${r.id}`,
      kind: 'post_report',
      severity: r.reports >= 2 ? 'high' : 'normal',
      title: `Reported post (${r.reports}×): "${r.body.slice(0, 50)}…"`,
      detail: `By ${r.author} · currently ${r.status}`,
      evidence: { body: r.body, author: r.author, reports: r.reports, status: r.status },
      createdAt: r.latest_report.toISOString(),
      postId: r.id,
    });
  }

  for (const r of rejects.rows as Array<{ id: string; name: string; rejection_reason: string | null; created_at: Date; spotter_name: string | null }>) {
    out.push({
      id: `rej:${r.id}`,
      kind: 'rejected_submission',
      severity: 'low',
      title: `Rejected: ${r.name}`,
      detail: `By ${r.spotter_name ?? 'unknown'} · ${r.rejection_reason ?? 'no reason recorded'}`,
      evidence: { placeId: r.id, reason: r.rejection_reason },
      createdAt: r.created_at.toISOString(),
    });
  }

  // Most urgent + most recent first
  const sev = { high: 0, normal: 1, low: 2 };
  out.sort((a, b) => sev[a.severity] - sev[b.severity] || b.createdAt.localeCompare(a.createdAt));
  return out;
}

export interface IssueRow {
  id: string;
  title: string;
  detail: string | null;
  kind: string;
  priority: string;
  status: string;
  filedBy: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export async function listIssues(pool: Pool, status?: string): Promise<IssueRow[]> {
  const res = await pool.query(
    `select id, title, detail, kind, priority, status, filed_by,
            resolution_note, resolved_at, created_at
       from issues
      where ($1::text is null or status = $1)
      order by case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
               created_at desc
      limit 100`,
    [status ?? null],
  );
  return res.rows.map((r: { id: string; title: string; detail: string | null; kind: string; priority: string; status: string; filed_by: string; resolution_note: string | null; resolved_at: Date | null; created_at: Date }) => ({
    id: r.id,
    title: r.title,
    detail: r.detail,
    kind: r.kind,
    priority: r.priority,
    status: r.status,
    filedBy: r.filed_by,
    resolutionNote: r.resolution_note,
    resolvedAt: r.resolved_at ? r.resolved_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function createIssue(
  pool: Pool,
  input: { title: string; detail?: string; kind?: string; priority?: string; filedBy?: string },
): Promise<IssueRow> {
  const res = await pool.query(
    `insert into issues (title, detail, kind, priority, filed_by)
     values ($1, $2, $3, $4, $5)
     returning id, title, detail, kind, priority, status, filed_by,
               resolution_note, resolved_at, created_at`,
    [
      input.title,
      input.detail ?? null,
      input.kind ?? 'task',
      input.priority ?? 'normal',
      input.filedBy ?? 'operator',
    ],
  );
  const r = res.rows[0] as { id: string; title: string; detail: string | null; kind: string; priority: string; status: string; filed_by: string; resolution_note: string | null; resolved_at: Date | null; created_at: Date };
  return {
    id: r.id, title: r.title, detail: r.detail, kind: r.kind, priority: r.priority,
    status: r.status, filedBy: r.filed_by, resolutionNote: r.resolution_note,
    resolvedAt: r.resolved_at ? r.resolved_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function resolveIssue(
  pool: Pool,
  issueId: string,
  status: 'resolved' | 'wont_fix' | 'in_progress',
  note: string,
): Promise<IssueRow | null> {
  const res = await pool.query(
    `update issues
        set status = $2, resolution_note = $3,
            resolved_at = case when $2 in ('resolved', 'wont_fix') then now() else null end
      where id = $1
      returning id, title, detail, kind, priority, status, filed_by,
                resolution_note, resolved_at, created_at`,
    [issueId, status, note],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0] as { id: string; title: string; detail: string | null; kind: string; priority: string; status: string; filed_by: string; resolution_note: string | null; resolved_at: Date | null; created_at: Date };
  return {
    id: r.id, title: r.title, detail: r.detail, kind: r.kind, priority: r.priority,
    status: r.status, filedBy: r.filed_by, resolutionNote: r.resolution_note,
    resolvedAt: r.resolved_at ? r.resolved_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}
