-- The first Overture import never stored overture_id (the id sits on the
-- GeoJSON feature, not in properties), so 0021's backfill found nothing.
-- Those rows are still one open source each; count them as such, keyed by
-- our own id until a re-import attaches the real one.
insert into place_sources (place_id, source, source_id, name, category, lat, lon, attrs, confidence, refreshed_at)
select id, 'overture', 'legacy:' || id, name, category,
       st_y(location::geometry), st_x(location::geometry),
       jsonb_strip_nulls(jsonb_build_object(
         'phone', public_phone, 'website', public_website, 'address', public_address,
         'socials', case when public_socials <> '[]'::jsonb then public_socials end,
         'subcategory', public_subcategory)),
       public_confidence,
       coalesce(public_refreshed_at, created_at)
  from places p
 where source = 'overture_candidate' and overture_id is null
   and not exists (select 1 from place_sources s where s.place_id = p.id and s.source = 'overture')
on conflict (source, source_id) do nothing;

update places p set corroboration = s.n
  from (select place_id, count(distinct source) as n from place_sources group by place_id) s
 where s.place_id = p.id and p.corroboration <> s.n;
