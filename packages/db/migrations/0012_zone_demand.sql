-- Zone demand — the persisted people-count that mission generation leans on.
--
-- "How many people have asked in this zone recently" was computable from
-- questions + zones geometry all along, but it lived nowhere: every surface
-- that wanted it had to re-derive it, and nothing could show a tourist or
-- an operator a number that matched what the gap agent scored. This table
-- is the scheduler's per-cycle snapshot: people = distinct anonymous
-- sessions asking in the zone (the system's honest definition of a person
-- — accounts hold an email, demand holds sessions), over a rolling 30
-- days. Raw question text never lands here; only counts.

create table zone_demand (
  zone_id text primary key references zones(id) on delete cascade,
  area_id uuid not null references areas(id) on delete cascade,
  people_count int not null default 0,
  ask_count int not null default 0,
  open_gaps int not null default 0,
  last_asked_at timestamptz,
  computed_at timestamptz not null default now()
);

create index zone_demand_people_idx on zone_demand (people_count desc);
