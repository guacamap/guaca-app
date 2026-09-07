-- Venue-scoped merchant accounts. A membership grants access only to the
-- owned stay. merchant_actions is the audit trail (confirm, decline, edits).

create table merchant_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  language char(2) not null default 'es',
  login_code_hash text,
  login_code_expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (email = lower(email))
);

alter table stays
  add constraint stays_merchant_id_fkey
  foreign key (merchant_id) references merchant_accounts(id);

alter table reservations
  add constraint reservations_merchant_id_fkey
  foreign key (merchant_id) references merchant_accounts(id);

create table merchant_memberships (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchant_accounts(id) on delete cascade,
  stay_id uuid not null references stays(id) on delete cascade,
  place_id uuid not null references places(id),
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (merchant_id, stay_id)
);

create index merchant_memberships_stay_idx on merchant_memberships (stay_id);

create table merchant_actions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchant_accounts(id),
  stay_id uuid references stays(id),
  reservation_id uuid references reservations(id),
  kind text not null check (kind in (
    'confirm_reservation', 'decline_reservation', 'adjust_inventory',
    'edit_profile', 'publish_update', 'inspect_license'
  )),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index merchant_actions_merchant_idx
  on merchant_actions (merchant_id, created_at desc);

create table merchant_zone_licenses (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchant_accounts(id) on delete cascade,
  stay_id uuid not null references stays(id),
  area_id uuid not null references areas(id),
  status text not null check (status in ('active', 'expired', 'revoked')),
  visibility text not null check (visibility in ('standard', 'promoted')),
  label_en text not null,
  label_es text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index merchant_zone_licenses_one_active
  on merchant_zone_licenses (merchant_id, stay_id)
  where status = 'active';
