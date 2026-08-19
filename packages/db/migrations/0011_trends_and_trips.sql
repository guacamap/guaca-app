-- Trends & trips: the trend engine's storage and the saved-itinerary table.
--
-- place_trends holds the deterministic trend engine's output, recomputed by
-- the scheduler each cycle from recorded behaviour only (answers that cited
-- the place, favourites, visible posts and presence-verified ratings,
-- re-check doubts, verification freshness) and modulated by an optional
-- area weather forecast. Trends only ever RANK verified places — a row here
-- is a derived fact about recorded behaviour, never a new place, and never
-- a claim about a person.
--
-- trips are itineraries a tourist asked for. Stops are jsonb shaped by the
-- shared trip contract (placeId + integers + enums — the guard minted them,
-- the renderer named them). share_slug is the public read-only link used by
-- WhatsApp shares. Deleting a tourist cascades: the account holds the email,
-- the saved itinerary and its public link die with it (erasure covers both).

create table place_trends (
  place_id uuid primary key references places(id) on delete cascade,
  score integer not null,
  breakdown jsonb not null default '{}',
  weather_state text,
  computed_at timestamptz not null default now(),
  trend_version text not null
);

create index place_trends_score_idx on place_trends (score desc);

create table trips (
  id uuid primary key default gen_random_uuid(),
  tourist_id uuid not null references tourists(id) on delete cascade,
  question text not null,
  language text not null default 'en',
  stops jsonb not null,
  share_slug text not null unique,
  created_at timestamptz not null default now()
);

create index trips_tourist_idx on trips (tourist_id, created_at desc);
