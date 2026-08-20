import type { Pool } from 'pg';

/** The draft's shape — produced by the model, consumed by the team. */
export interface CandidateDraftPayload {
  category: string;
  landmarkHint: string;
  whyLikely: string;
  photoChecklist: string[];
  suggestedTags: string[];
}

export interface StewardDraftRow {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateCategory: string;
  existingLandmark: string | null;
  existingTags: string[];
  model: string;
  draft: CandidateDraftPayload;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

const DRAFT_COLUMNS = `d.id, d.candidate_id, p.name as candidate_name,
  p.category as candidate_category, p.landmark_description as existing_landmark,
  p.tags as existing_tags, d.model, d.draft, d.status,
  d.reviewed_by, d.review_note, d.created_at`;

interface RawRow {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_category: string;
  existing_landmark: string | null;
  existing_tags: string[] | null;
  model: string;
  draft: CandidateDraftPayload;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  review_note: string | null;
  created_at: Date;
}

function toRow(r: RawRow): StewardDraftRow {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    candidateName: r.candidate_name,
    candidateCategory: r.candidate_category,
    existingLandmark: r.existing_landmark,
    existingTags: r.existing_tags ?? [],
    model: r.model,
    draft: r.draft,
    status: r.status,
    reviewedBy: r.reviewed_by,
    reviewNote: r.review_note,
    createdAt: r.created_at.toISOString(),
  };
}

/** Candidates with no pending or approved draft — the steward's worklist. */
export async function unenrichedCandidates(
  pool: Pool,
  opts: { limit: number; areaId?: string | null },
): Promise<Array<{ id: string; name: string; category: string; landmarkDescription: string | null; tags: string[] }>> {
  const res = await pool.query<{
    id: string;
    name: string;
    category: string;
    landmark_description: string | null;
    tags: string[] | null;
  }>(
    `select p.id, p.name, p.category, p.landmark_description, p.tags
       from places p
      where p.source = 'osm_candidate'
        and p.verification_status = 'candidate'
        and ($1::uuid is null or p.area_id = $1)
        and not exists (
          select 1 from candidate_drafts d
           where d.candidate_id = p.id and d.status in ('pending', 'approved')
        )
      order by p.created_at asc
      limit $2`,
    [opts.areaId ?? null, opts.limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    landmarkDescription: r.landmark_description,
    tags: r.tags ?? [],
  }));
}

export async function saveDraft(
  pool: Pool,
  input: { candidateId: string; model: string; draft: CandidateDraftPayload },
): Promise<StewardDraftRow> {
  await pool.query(
    `insert into candidate_drafts (candidate_id, model, draft)
     values ($1, $2, $3::jsonb)
     on conflict (candidate_id) where status = 'pending'
       do update set model = excluded.model, draft = excluded.draft, created_at = now()`,
    [input.candidateId, input.model, JSON.stringify(input.draft)],
  );
  const saved = await pool.query<RawRow>(
    `select ${DRAFT_COLUMNS}
       from candidate_drafts d join places p on p.id = d.candidate_id
      where d.candidate_id = $1 and d.status = 'pending'`,
    [input.candidateId],
  );
  return toRow(saved.rows[0]!);
}

/** The review queue — newest first; `pending` by default. */
export async function stewardDrafts(
  pool: Pool,
  status: 'pending' | 'approved' | 'rejected',
): Promise<StewardDraftRow[]> {
  const res = await pool.query<RawRow>(
    `select ${DRAFT_COLUMNS}
       from candidate_drafts d join places p on p.id = d.candidate_id
      where d.status = $1
      order by d.created_at desc
      limit 100`,
    [status],
  );
  return res.rows.map(toRow);
}

export type StewardDecision =
  | { ok: true; draft: StewardDraftRow }
  | { ok: false; reason: 'not found' | 'already reviewed' };

/**
 * Approve: the draft's enrichment lands on the CANDIDATE row (still
 * invisible to tourists, still requiring a Spotter's physical
 * verification), and the decision is audited. An unaudited state change is
 * a defect — the operator_actions row is written in the same transaction.
 */
export async function approveDraft(
  pool: Pool,
  draftId: string,
  operator: string,
  note?: string,
): Promise<StewardDecision> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const draft = await client.query<{
      candidate_id: string;
      draft: CandidateDraftPayload;
      status: string;
    }>(
      `select candidate_id, draft, status from candidate_drafts
        where id = $1 for update`,
      [draftId],
    );
    if (draft.rows.length === 0) {
      await client.query('rollback');
      return { ok: false, reason: 'not found' };
    }
    if (draft.rows[0]!.status !== 'pending') {
      await client.query('rollback');
      return { ok: false, reason: 'already reviewed' };
    }
    const payload = draft.rows[0]!.draft;
    const tags = [
      ...new Set([...(payload.suggestedTags ?? []).map((t) => t.toLowerCase())]),
    ];
    await client.query(
      `update places set
         category = $2,
         landmark_description = $3,
         tags = coalesce((
           select array_agg(distinct t) from unnest(coalesce(tags, '{}'::text[]) || $4::text[]) as t
         ), '{}'::text[])
       where id = $1`,
      [draft.rows[0]!.candidate_id, payload.category, payload.landmarkHint, tags],
    );
    await client.query(
      `update candidate_drafts
         set status = 'approved', reviewed_by = $2, review_note = $3, reviewed_at = now()
        where id = $1`,
      [draftId, operator, note ?? null],
    );
    await client.query(
      `insert into operator_actions (operator, action, target_type, target_id, reason, before_state, after_state)
       values ($1, 'steward.approve', 'candidate_draft', $2, $3,
         jsonb_build_object('status', 'pending'),
         jsonb_build_object('status', 'approved', 'category', $4::text, 'landmarkHint', $5::text))`,
      [operator, draftId, note ?? null, payload.category, payload.landmarkHint],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  const after = await pool.query<RawRow>(
    `select ${DRAFT_COLUMNS}
       from candidate_drafts d join places p on p.id = d.candidate_id
      where d.id = $1`,
    [draftId],
  );
  return { ok: true, draft: toRow(after.rows[0]!) };
}

export async function rejectDraft(
  pool: Pool,
  draftId: string,
  operator: string,
  note: string,
): Promise<StewardDecision> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const res = await client.query<{ status: string }>(
      `update candidate_drafts
         set status = 'rejected', reviewed_by = $2, review_note = $3, reviewed_at = now()
        where id = $1 and status = 'pending'
        returning status`,
      [draftId, operator, note],
    );
    if (res.rows.length === 0) {
      await client.query('rollback');
      return { ok: false, reason: 'not found' };
    }
    await client.query(
      `insert into operator_actions (operator, action, target_type, target_id, reason, before_state, after_state)
       values ($1, 'steward.reject', 'candidate_draft', $2, $3,
         jsonb_build_object('status', 'pending'),
         jsonb_build_object('status', 'rejected'))`,
      [operator, draftId, note],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  const after = await pool.query<RawRow>(
    `select ${DRAFT_COLUMNS}
       from candidate_drafts d join places p on p.id = d.candidate_id
      where d.id = $1`,
    [draftId],
  );
  return after.rows.length > 0
    ? { ok: true, draft: toRow(after.rows[0]!) }
    : { ok: false, reason: 'not found' };
}
