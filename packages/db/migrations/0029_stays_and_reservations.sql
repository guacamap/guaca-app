-- Lodging stays: one room type per stay, per-night allotment, half-open dates
-- [check_in, check_out). Occupancy is enforced transactionally in application
-- code AND by SQL: reserved_count cannot exceed allotment, and
-- (stay_id, night_date, slot) on reservation_nights cannot collide.

create table stays (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references places(id) on delete cascade,
  merchant_id uuid,
  room_type_en text not null,
  room_type_es text not null,
  amenities text[] not null default '{}',
  currency char(3) not null default 'USD',
  nightly_price_minor int not null check (nightly_price_minor >= 0),
  guests_max int not null check (guests_max >= 1),
  timezone text not null default 'America/Bogota',
  created_at timestamptz not null default now()
);

create table stay_inventory (
  stay_id uuid not null references stays(id) on delete cascade,
  night_date date not null,
  allotment int not null check (allotment >= 0),
  reserved_count int not null default 0
    check (reserved_count >= 0 and reserved_count <= allotment),
  primary key (stay_id, night_date)
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references stays(id),
  merchant_id uuid not null,
  tourist_id uuid not null references tourists(id),
  check_in date not null,
  check_out date not null,
  guests int not null check (guests >= 1),
  nightly_price_minor int not null check (nightly_price_minor >= 0),
  currency char(3) not null default 'USD',
  status text not null check (status in (
    'requested', 'confirmed', 'declined', 'expired', 'cancelled', 'completed'
  )),
  reference_code text not null unique,
  hold_expires_at timestamptz,
  note text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (status <> 'requested' or hold_expires_at is not null)
);

create unique index reservations_active_tourist_stay_dates
  on reservations (stay_id, tourist_id, check_in, check_out)
  where status in ('requested', 'confirmed');

create unique index reservations_idempotency
  on reservations (stay_id, tourist_id, idempotency_key)
  where idempotency_key is not null;

create index reservations_stay_status_idx on reservations (stay_id, status);
create index reservations_tourist_idx on reservations (tourist_id, created_at desc);
create index reservations_merchant_idx on reservations (merchant_id, status);

-- One row per occupied night. slot is 1..allotment; the unique key makes
-- double-booking the last room impossible even if reserved_count races.
create table reservation_nights (
  reservation_id uuid not null references reservations(id) on delete cascade,
  stay_id uuid not null references stays(id),
  night_date date not null,
  slot int not null check (slot >= 1),
  primary key (reservation_id, night_date),
  unique (stay_id, night_date, slot)
);

create index reservation_nights_stay_night_idx
  on reservation_nights (stay_id, night_date);
