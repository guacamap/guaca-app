-- "What locals say" — posts ABOUT a verified place: tips and social videos
-- (Reels/TikTok links). Strictly commentary: a post never creates or edits
-- map facts, which only enter through the witness pipeline. Exactly one
-- author reference is set; deleting the account deletes the posts.
create table place_posts (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  spotter_id uuid references spotters(id) on delete cascade,
  tourist_id uuid references tourists(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  media_url text,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(spotter_id, tourist_id) = 1)
);
create index place_posts_place_idx on place_posts (place_id, status, created_at desc);
