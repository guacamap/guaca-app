-- What the AI did, call by call, and how it scores on a fixed eval set.
-- questions and verification_runs already keep the OUTCOMES (answered,
-- refusal_reason, ladder decision); these two tables keep what sat under
-- them: which model, how long, what it cost, and whether the call failed
-- before the guard ever saw a response.

create table ai_calls (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  purpose text not null,                     -- the request's purpose: planner.plan, verification.vision, ...
  kind text not null check (kind in ('json','vision')),
  model text not null,
  ok boolean not null,
  error_kind text check (error_kind in ('schema','timeout','http','budget','other')),
  error_message text,
  latency_ms integer not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0
);
create index ai_calls_ts_idx on ai_calls (ts desc);
create index ai_calls_purpose_ts_idx on ai_calls (purpose, ts desc);

create table ai_benchmarks (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  model text not null,
  eval_set text not null,                    -- name + version of the prompt set
  rows_source text not null,                 -- 'verified:<area slug>' or 'fixture'
  prompts integer not null,
  passes integer not null,                   -- outcome matched the case's expectation
  plans integer not null,
  refusals integer not null,
  schema_errors integer not null,
  errors integer not null,
  avg_ms integer not null,
  p95_ms integer not null,
  tokens_in integer not null,
  tokens_out integer not null,
  triggered_by text not null,                -- operator email, 'cli', or 'import'
  results jsonb not null                     -- per-prompt detail
);
create index ai_benchmarks_ts_idx on ai_benchmarks (ts desc);
