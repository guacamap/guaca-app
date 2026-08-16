-- Registrations were write-only: rows landed and nobody could work them.
-- The human motion is "read the inbox, call the person, then create their
-- spotter or property account", so the row needs to remember that it was
-- dealt with — otherwise the same posada gets called twice.
alter table registrations add column handled_at timestamptz;
alter table registrations add column operator_note text;
create index registrations_pending_idx on registrations (created_at desc) where handled_at is null;
