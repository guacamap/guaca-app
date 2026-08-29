-- Public information about a place from open datasets (Overture Maps,
-- Foursquare OS Places): phone, website, socials, address. It arrives as a
-- candidate's attributes and stays labelled public until a local confirms
-- it in person (contact_confirmed_at). Overture is a second candidate
-- source next to OSM; nothing here changes what "verified" means.
alter table places drop constraint if exists places_source_check;
alter table places add constraint places_source_check
  check (source in ('spotter', 'business', 'osm_candidate', 'overture_candidate'));

alter table places
  add column public_phone text,
  add column public_website text,
  add column public_socials jsonb not null default '[]'::jsonb,
  add column public_address text,
  add column public_source text check (public_source in ('overture', 'foursquare', 'osm')),
  add column public_confidence numeric,
  add column public_refreshed_at timestamptz,
  add column overture_id text,
  add column contact_confirmed_at timestamptz,
  add column contact_confirmed_by uuid references spotters(id);

create unique index places_overture_idx on places (overture_id) where overture_id is not null;
