create extension if not exists postgis;
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists h3;         -- h3_lat_lng_to_cell()

-- ── Geography & supply ────────────────────────────────────────────────
create table areas (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique,
  country char(2) not null, timezone text not null,
  geom geography(POLYGON,4326) not null,
  created_at timestamptz not null default now()
);
create index areas_geom_idx on areas using gist (geom);

-- Hand-drawn walkable zones. A zone is a walk a Spotter can actually do.
create table zones (
  id text primary key,                      -- 'malecon', 'casco-historico', … or 'h3:8a…'
  area_id uuid not null references areas(id),
  name text not null,
  geom geography(POLYGON,4326) not null,
  access_difficulty int not null default 0 check (access_difficulty between 0 and 2),
  created_at timestamptz not null default now()
);
create index zones_geom_idx on zones using gist (geom);

create table spotters (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- shown on every pin: territory identity
  photo_url text,
  phone text unique not null,
  area_id uuid not null references areas(id),
  home_h3 text,                             -- the zone they own
  level int not null default 1 check (level between 1 and 4),
  language char(2) not null default 'es',
  login_code_hash text,                     -- operator-issued one-time code
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table properties (               -- villas/posadas: distribution channel AND payer
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area_id uuid not null references areas(id),
  location geography(POINT,4326) not null,
  qr_token text not null unique,
  plan text not null default 'free' check (plan in ('free','paid')),
  subscription_minor int not null default 0,   -- monthly value, drives gap weighting
  currency char(3) not null default 'USD',
  created_at timestamptz not null default now()
);

-- ── Places: the core entity. NEVER AI-generated. ─────────────────────
create table places (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id),
  name text not null,
  category text not null,                   -- packages/shared taxonomy
  description text,
  landmark_description text,                -- landmark-first, not address-first
  location geography(POINT,4326) not null,
  h3_8 text not null,                        -- denormalised cluster key
  open_hours jsonb,
  price_band int check (price_band between 1 and 4),
  tags text[] not null default '{}',
  source text not null check (source in ('spotter','business','osm_candidate')),
  verification_status text not null default 'pending'
    check (verification_status in ('candidate','pending','provisional','verified','rejected')),
  witness_count int not null default 0,      -- must be >= 2 to enter a Catalog
  created_by_spotter_id uuid references spotters(id),
  confirmed_by_spotter_id uuid references spotters(id),   -- the REQUIRED second local
  verified_at timestamptz,
  rejection_reason text,
  osm_type text check (osm_type in ('node','way','relation')),
  osm_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index places_osm_idx on places (osm_type, osm_id) where osm_type is not null;
create index places_location_idx on places using gist (location);
create index places_lookup_idx on places (area_id, verification_status, category);
create index places_h3_idx on places (h3_8);
-- A verified place MUST have both a creator and an independent confirmer.
alter table places add constraint verified_needs_two_locals check (
  verification_status <> 'verified' or (
    created_by_spotter_id is not null
    and confirmed_by_spotter_id is not null
    and confirmed_by_spotter_id <> created_by_spotter_id
  )
);

create table place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  storage_key text not null,
  sha256 text not null,
  phash text not null,                       -- perceptual hash, rung 3
  capture_lat double precision,              -- device geolocation at capture
  capture_lon double precision,
  capture_accuracy_m double precision,
  captured_at timestamptz,                   -- client-claimed
  received_at timestamptz not null default now(),  -- server truth
  uploaded_by_spotter_id uuid references spotters(id),
  created_at timestamptz not null default now()
);
create index place_photos_phash_idx on place_photos (phash);

-- Time-bound observations. Describe PLACES AND CONDITIONS, NEVER PEOPLE.
create table place_conditions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  kind text not null check (kind in
    ('sea_state','road_condition','power_status','water_availability','crowd_level','opening_status')),
  value text not null,
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  reported_by_spotter_id uuid references spotters(id),
  created_at timestamptz not null default now()
);

create table events (                    -- businesses/organisers post FREE, time-bound
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  title text not null, description text,
  starts_at timestamptz not null, ends_at timestamptz not null,
  posted_by text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  created_at timestamptz not null default now()
);

-- ── Demand: questions, gaps, missions ────────────────────────────────
create table sessions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id),
  language char(2) not null default 'en',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  property_id uuid references properties(id),
  area_id uuid references areas(id),
  raw_text text not null,
  language char(2) not null,
  intent jsonb,                              -- {category, h3_8, when, party_size}
  answered boolean not null default false,
  answer_place_ids uuid[] not null default '{}',
  refusal_reason text,
  gap_id uuid,                               -- set when refusal creates/joins a gap
  created_at timestamptz not null default now()
);
create index questions_unanswered_idx on questions (answered, created_at) where answered = false;

create table gaps (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id),
  category text not null,
  h3_8 text not null,
  question_count int not null default 0,
  distinct_session_count int not null default 0,
  paying_property_minor int not null default 0,
  coverage_density numeric not null default 0,
  score numeric not null default 0,
  last_asked_at timestamptz,
  status text not null default 'open'
    check (status in ('open','commissioned','filled','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index gaps_cluster_idx on gaps (area_id, category, h3_8);

create table missions (
  id uuid primary key default gen_random_uuid(),
  gap_id uuid not null references gaps(id),
  spotter_id uuid not null references spotters(id),
  brief text not null,                       -- in the Spotter's language
  target_category text not null,
  target_h3 text not null,
  reward_minor int not null,
  currency char(3) not null default 'USD',
  status text not null default 'offered'
    check (status in ('offered','accepted','submitted','verified','paid','expired','cancelled')),
  created_by text not null check (created_by in ('agent','operator')),
  result_place_id uuid references places(id),
  offered_at timestamptz not null default now(),
  accepted_at timestamptz, submitted_at timestamptz, paid_at timestamptz,
  expires_at timestamptz not null,
  cancel_reason text
);
-- ONE open mission per gap. Enforces "one mission, one Spotter, one payment".
create unique index missions_one_open_per_gap
  on missions (gap_id) where status in ('offered','accepted','submitted');

create table payouts (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id),
  spotter_id uuid not null references spotters(id),
  provider text not null,                    -- 'mock' | 'reloadly'
  provider_ref text,
  idempotency_key text not null unique,      -- = mission_id; guarantees single payment
  amount_minor int not null, currency char(3) not null,
  status text not null check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now()
);

-- ── The loop thread: this table IS the demo ──────────────────────────
-- A loop_id is minted at the tourist's question and carried onto every row that
-- follows it: question → gap → mission → submission → verification → the answer
-- that finally succeeds. Add `loop_id uuid` to questions, gaps, missions and
-- verification_runs. One query then renders the entire chain with wall-clock deltas.
create table loop_events (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null,
  kind text not null,      -- QUESTION_ASKED | REFUSED | GAP_SCORED | MISSION_APPROVED |
                           -- SUBMITTED | CHECKS_PASSED | VISION_OK | SECOND_LOCAL_CONFIRMED |
                           -- VERIFIED | LOOP_CLOSED
  agent text, payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index loop_events_loop_idx on loop_events (loop_id, created_at);

-- ── Observability & human oversight ──────────────────────────────────
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('planner','gap','verification')),
  status text not null check (status in ('running','ok','refused','escalated','error')),
  input jsonb not null, output jsonb, steps jsonb not null default '[]',
  model text, tokens_in int not null default 0, tokens_out int not null default 0,
  latency_ms int, error text,
  created_at timestamptz not null default now()
);

create table verification_runs (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  photo_id uuid references place_photos(id),
  agent_run_id uuid references agent_runs(id),
  checks jsonb not null,                     -- per-rung results, §7.4
  decision text not null check (decision in ('verified','rejected','needs_second_local','needs_operator')),
  decided_by text not null check (decided_by in ('agent','operator')),
  operator_note text,
  created_at timestamptz not null default now()
);

create table operator_actions (              -- human-in-the-loop audit trail
  id uuid primary key default gen_random_uuid(),
  operator text not null,
  action text not null,                      -- verify.approve, mission.cancel, gap.commission…
  target_type text not null, target_id uuid not null,
  reason text,
  before_state jsonb, after_state jsonb,
  created_at timestamptz not null default now()
);
