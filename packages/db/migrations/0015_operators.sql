-- Operators — named humans with panel access. The shared OPERATOR_TOKEN
-- stays for machine-to-machine (CLI, ops stream), but the panel now
-- authenticates people: email → one-time code → per-operator JWT.
-- Every audit row carries the real email, not just "operator".

create table operators (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text not null,
  role text not null default 'operator' check (role in ('admin', 'operator', 'moderator')),
  active boolean not null default true,
  login_code_hash text,
  login_code_expires_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create index operators_active_idx on operators (email) where active;
