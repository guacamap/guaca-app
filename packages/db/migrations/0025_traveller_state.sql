-- What Guaca remembers about a traveller between turns, and what it says
-- to them unprompted. Until now every conversation started from zero and
-- Guaca only ever answered. Both tables are the traveller's own; nothing
-- here is shown to anyone else.
create table traveller_state (
  tourist_id uuid primary key references tourists(id) on delete cascade,
  -- Learned in conversation, in Guaca's own short notes: party, pace,
  -- interests, dislikes, dates in town, done, declined. Free-form lines.
  notes text[] not null default '{}',
  -- The plan Guaca is keeping true today: stops with times and tiers, and
  -- the local date it is for. Null when nothing is in progress.
  active_plan jsonb,
  active_plan_date date,
  -- Where the traveller last stood, for the tick's travel and area lookup.
  last_lat double precision,
  last_lon double precision,
  language text not null default 'en',
  last_spoke_at timestamptz,
  last_heard_at timestamptz,
  updated_at timestamptz not null default now()
);

create table guaca_messages (
  id uuid primary key default gen_random_uuid(),
  tourist_id uuid not null references tourists(id) on delete cascade,
  -- Why Guaca spoke: every unprompted message names its trigger.
  trigger text not null check (trigger in ('rain_replan','storm','morning_plan','evening_checkin','stop_verified','stop_rejected','next_stop')),
  text text not null,
  -- For a replan: the new plan, so the app can swap it in.
  payload jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  -- The traveller's answer to an evening check-in, one word per stop.
  reply jsonb
);
create index guaca_messages_inbox_idx on guaca_messages (tourist_id, created_at desc) where delivered_at is null;

-- What a traveller said about a stop after the day. The weakest witness,
-- and still the first feedback the plan has ever had.
create table stop_feedback (
  id uuid primary key default gen_random_uuid(),
  tourist_id uuid not null references tourists(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  verdict text not null check (verdict in ('good','not_there','skipped','bad')),
  created_at timestamptz not null default now(),
  unique (tourist_id, place_id, created_at)
);
create index stop_feedback_place_idx on stop_feedback (place_id, verdict);
