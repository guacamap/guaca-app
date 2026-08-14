-- ── Honest audit attribution (§7.4 review) ──────────────────────────
-- The L6 second-local confirmation was being recorded as decided_by
-- 'agent'. It is a human decision by a different witness — say so.
alter table verification_runs drop constraint verification_runs_decided_by_check;
alter table verification_runs add constraint verification_runs_decided_by_check
  check (decided_by in ('agent', 'operator', 'second_local'));
