-- "Tell me when it's verified" opt-ins become a durable record instead of a
-- row that vanishes when the mail fires: pending watches (notified_at null)
-- power the tourist's "waiting on" list, fulfilled ones power their impact
-- count. Questions themselves stay anonymous — the link lives only here,
-- and still cascades away with the account.
alter table question_notifications add column notified_at timestamptz;
create index question_notifications_pending_idx
  on question_notifications (tourist_id) where notified_at is null;
