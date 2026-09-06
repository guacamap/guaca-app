-- A sourced editorial profile is not a witness or another open dataset.
-- Keep it separate from corroboration, contact confirmation and verification.
alter table places add column public_profile jsonb;
