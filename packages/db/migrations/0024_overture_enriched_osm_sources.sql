-- The first Overture import enriched OSM rows in place (public_source =
-- 'overture') but, lacking an overture_id, never recorded itself as a
-- source on them. Those rows are known to two datasets; count it.
insert into place_sources (place_id, source, source_id, name, category, lat, lon, attrs, confidence, refreshed_at)
select id, 'overture', 'legacy:' || id, name, category,
       st_y(location::geometry), st_x(location::geometry),
       jsonb_strip_nulls(jsonb_build_object('phone', public_phone, 'website', public_website, 'address', public_address, 'subcategory', public_subcategory)),
       public_confidence, coalesce(public_refreshed_at, created_at)
  from places p
 where osm_id is not null and public_source = 'overture'
   and not exists (select 1 from place_sources s where s.place_id = p.id and s.source = 'overture')
on conflict (source, source_id) do nothing;

update places p set corroboration = s.n
  from (select place_id, count(distinct source) as n from place_sources group by place_id) s
 where s.place_id = p.id and p.corroboration <> s.n;
