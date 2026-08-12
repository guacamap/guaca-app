-- ── Registrations ────────────────────────────────────────────────────
-- One inbox for the three ways someone raises a hand: a traveller who
-- wants word when a coast opens, a local introducing themselves as a
-- spotter candidate (spotters stay invited and hand-picked — this is an
-- introduction, never automatic enrolment), and a posada/villa owner
-- asking for the guest QR surface.
create table registrations (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('traveler','spotter','owner')),
  name text not null,
  contact text not null,               -- email or phone, as given
  language text not null default 'en',
  details jsonb not null default '{}', -- role-specific fields, kept verbatim
  created_at timestamptz not null default now()
);
create index registrations_role_idx on registrations (role, created_at desc);
-- A person can refresh their details for one role without duplicate entries.
-- The same contact may still join in more than one role.
create unique index registrations_role_contact_uidx
  on registrations (role, lower(contact));
