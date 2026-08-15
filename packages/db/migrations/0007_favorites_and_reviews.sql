-- Reviews ride the posts feed: a post made physically AT the place (geo
-- proximity, server-checked) earns visited=true and may carry a rating.
-- Stars from someone who wasn't there are stripped, not stored — presence
-- is the currency, same as the witness pipeline.
alter table place_posts add column visited boolean not null default false;
alter table place_posts add column rating smallint check (rating between 1 and 5);

-- Favorites: a tourist's private save-list. No counts are ever shown on the
-- map (no popularity contest — coverage is demand-driven, not like-driven).
create table tourist_favorites (
  tourist_id uuid not null references tourists(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tourist_id, place_id)
);
