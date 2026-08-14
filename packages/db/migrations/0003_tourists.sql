-- ── Tourists (§4.1) ─────────────────────────────────────────────────
-- Email-code accounts. An account holds an email and a language, nothing
-- else (COMPLIANCE.md): no name, no profile. Attribution ties the account
-- to the villa whose QR created it — business-model data, nullable.
create table tourists (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  language text not null default 'en',
  attributed_property_id uuid references properties(id),
  login_code_hash text,                 -- sha256 of the current one-time code
  login_code_expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index tourists_property_idx on tourists (attributed_property_id)
  where attributed_property_id is not null;
