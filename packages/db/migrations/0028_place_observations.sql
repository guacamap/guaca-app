-- Time-sensitive facts about a place, separate from the enduring profile.
-- Expired rows stop reading as current: callers use place_observations_current
-- (status = active AND valid_until is null or still in the future).

create table place_observations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  kind text not null check (kind in ('schedule', 'access', 'service', 'condition')),
  statement_en text not null,
  statement_es text not null,
  source_kind text not null check (source_kind in (
    'public_listing', 'business_statement', 'pending_local_check', 'locally_confirmed'
  )),
  source_label text not null,
  observed_at timestamptz not null,
  valid_until timestamptz,
  status text not null default 'active'
    check (status in ('active', 'expired', 'superseded')),
  evidence_photo_url text,
  created_by uuid references spotters(id),
  created_at timestamptz not null default now(),
  check (status <> 'expired' or valid_until is not null)
);

create index place_observations_place_status_idx
  on place_observations (place_id, status);
create index place_observations_place_valid_idx
  on place_observations (place_id, valid_until);

create view place_observations_current as
  select * from place_observations
   where status = 'active'
     and (valid_until is null or valid_until > now());
