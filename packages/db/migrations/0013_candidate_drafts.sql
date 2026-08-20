-- The AI steward's drafts — machine-suggested enrichment of OSM candidates,
-- invisible to every tourist surface until two humans say otherwise.
--
-- The flow keeps the product's bright line intact: the AI never creates a
-- place and never reaches the tourist map. It DRAFTS enrichment for
-- candidates that already exist (imported from OpenStreetMap, shown only
-- as dots), the team reviews each draft manually, and an approved draft
-- updates the CANDIDATE row — which still requires a real Spotter's
-- physical verification (the two-witness rule) before anything becomes a
-- pin. Every approve/reject writes an operator_actions audit row.

create table candidate_drafts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references places(id) on delete cascade,
  model text not null,
  -- The draft itself: { category, landmarkHint, whyLikely, photoChecklist[],
  -- suggestedTags[] } — written by the model, read by the team only.
  draft jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index candidate_drafts_pending_idx on candidate_drafts (created_at desc)
  where status = 'pending';

-- One pending draft per candidate: re-running the steward replaces the
-- outstanding draft instead of stacking duplicates for the team.
create unique index candidate_drafts_one_pending
  on candidate_drafts (candidate_id) where status = 'pending';
