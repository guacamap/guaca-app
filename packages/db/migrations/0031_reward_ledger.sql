-- Reward points are not money. The ledger is append-only; redemptions deduct
-- via a negative ledger row plus a receipt. One redemption per catalog item
-- per spotter for the demo catalog.

create table reward_ledger (
  id uuid primary key default gen_random_uuid(),
  spotter_id uuid not null references spotters(id),
  delta int not null,
  reason text not null,
  mission_id uuid references missions(id),
  created_at timestamptz not null default now()
);

create index reward_ledger_spotter_idx
  on reward_ledger (spotter_id, created_at);

create table reward_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_es text not null,
  description_en text not null,
  description_es text not null,
  point_cost int not null check (point_cost > 0),
  kind text not null check (kind in ('cap', 'bottle', 'voucher')),
  created_at timestamptz not null default now()
);

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  spotter_id uuid not null references spotters(id),
  catalog_id uuid not null references reward_catalog(id),
  mission_id uuid references missions(id),
  points_spent int not null check (points_spent > 0),
  receipt_code text not null unique,
  created_at timestamptz not null default now(),
  unique (spotter_id, catalog_id)
);
