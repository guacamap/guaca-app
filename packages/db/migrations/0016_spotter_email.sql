-- Spotters sign in with an email and a one-time code, exactly like tourists
-- and operators. The phone stays as the contact number; it is no longer the
-- login. The email is the roster's allowlist key: an address not on the
-- roster cannot request a code.
alter table spotters add column email text;
alter table spotters add column login_code_expires_at timestamptz;
alter table spotters add constraint spotters_email_lower check (email is null or email = lower(email));
create unique index spotters_email_uidx on spotters (email) where email is not null;
