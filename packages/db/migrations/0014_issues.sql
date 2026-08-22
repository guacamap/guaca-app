-- The issues table — internal bug/task tracker for the team. Operators and
-- moderators file what needs fixing (a bug, a data problem, a Spotter
-- complaint, a "this map pin is wrong") so nothing lives only in someone's
-- head. Minimal by design: title, detail, priority, status, who filed it,
-- who resolved it. The audit trail is the resolution itself.

create table issues (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 200),
  detail text,
  kind text not null default 'task' check (kind in ('bug', 'task', 'data', 'spotter', 'security')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'wont_fix')),
  filed_by text not null default 'operator',
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index issues_open_idx on issues (priority desc, created_at desc) where status in ('open', 'in_progress');
