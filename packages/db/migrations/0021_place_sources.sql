-- Tiered honesty: a place can be known to several open datasets, and how
-- many agree is what separates "corroborated" from "listed once". Each
-- import writes one row per (source, source_id) here and links it to the
-- places row it matched or created; places.corroboration is the count of
-- distinct sources, maintained by the importers. Verified stays what it
-- was: a local stood there. Nothing here changes that tier.
create table place_sources (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  source text not null check (source in ('osm','overture','foursquare','wikidata')),
  source_id text not null,
  name text not null,
  category text,
  lat double precision not null,
  lon double precision not null,
  attrs jsonb not null default '{}',
  confidence real,
  refreshed_at timestamptz not null default now(),
  unique (source, source_id)
);
create index place_sources_place_idx on place_sources (place_id);

alter table places add column corroboration int not null default 0;
alter table places drop constraint places_source_check;
alter table places add constraint places_source_check
  check (source in ('spotter','business','osm_candidate','overture_candidate','foursquare_candidate','wikidata_candidate'));

-- Backfill from what the OSM and Overture imports already left on places.
insert into place_sources (place_id, source, source_id, name, category, lat, lon, attrs, refreshed_at)
select id, 'osm', osm_type || '/' || osm_id, name, category,
       st_y(location::geometry), st_x(location::geometry),
       jsonb_strip_nulls(jsonb_build_object('subcategory', public_subcategory)),
       coalesce(public_refreshed_at, created_at)
  from places where osm_type is not null and osm_id is not null
on conflict (source, source_id) do nothing;

insert into place_sources (place_id, source, source_id, name, category, lat, lon, attrs, confidence, refreshed_at)
select id, 'overture', overture_id, name, category,
       st_y(location::geometry), st_x(location::geometry),
       jsonb_strip_nulls(jsonb_build_object(
         'phone', public_phone, 'website', public_website, 'address', public_address,
         'socials', case when public_socials <> '[]'::jsonb then public_socials end,
         'subcategory', public_subcategory)),
       public_confidence,
       coalesce(public_refreshed_at, created_at)
  from places where overture_id is not null
on conflict (source, source_id) do nothing;

update places p set corroboration = s.n
  from (select place_id, count(distinct source) as n from place_sources group by place_id) s
 where s.place_id = p.id;

create index places_corroboration_idx on places (area_id, corroboration desc);
