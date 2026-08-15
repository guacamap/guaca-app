-- Play policy: an app carrying user content must let users flag it and must
-- act on flags. One report per person per post; the API auto-hides a post
-- once it reaches the threshold, and an operator can review either way.
create table place_post_reports (
  post_id uuid not null references place_posts(id) on delete cascade,
  reporter_key text not null,          -- tourist:<id> or spotter:<id>
  reason text not null default 'other',
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_key)
);
create index place_post_reports_post_idx on place_post_reports (post_id);
