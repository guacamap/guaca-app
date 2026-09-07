-- Editorial things to do, plus a mock tourist plan entitlement (no billing).
-- Scenario action-taking Spotters live on the existing spotters table.

create table activities (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id),
  slug text not null unique,
  title_en text not null,
  title_es text not null,
  summary_en text not null,
  summary_es text not null,
  cover_image jsonb,
  place_ids uuid[] not null,
  category text not null,
  estimated_duration_min int not null check (estimated_duration_min > 0),
  travel_mode text not null check (travel_mode in ('walk', 'taxi', 'mixed')),
  interest_tags text[] not null,
  suggested_window text check (suggested_window in ('morning', 'afternoon', 'sunset', 'evening')),
  created_at timestamptz not null default now()
);

create index activities_area_idx on activities (area_id);

create table tourist_entitlements (
  tourist_id uuid primary key references tourists(id) on delete cascade,
  plan_code text not null,
  status text not null check (status in ('active', 'expired')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  source text not null default 'scenario_fixture',
  created_at timestamptz not null default now()
);
