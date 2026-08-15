-- Opt-in "tell me when it's verified" links. Kept OUT of questions so the
-- questions table stays anonymous by design (COMPLIANCE.md): the link exists
-- only when the tourist explicitly asks for it, and erasing the account
-- (delete tourists row) cascades the link away.
create table question_notifications (
  question_id uuid not null references questions(id) on delete cascade,
  tourist_id uuid not null references tourists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, tourist_id)
);
