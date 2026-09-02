-- What kind of place an area is, in a paragraph, so Guaca knows the town it
-- stands in (a colonial port, an island capital) before anyone types. From
-- Wikipedia's summary (CC BY-SA), kept as background for the concierge and
-- never read out verbatim; the source is recorded for attribution.
alter table areas
  add column about_en text,
  add column about_es text,
  add column about_source text,
  add column about_refreshed_at timestamptz;
