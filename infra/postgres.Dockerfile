# GUACA Postgres: PostGIS + h3.
#
# The schema needs BOTH: PostGIS for geography/distance and h3 for the
# clustering cells (h3_lat_lng_to_cell in 0001_schema.sql, and the inverse
# on the spotter map). postgis/postgis ships PostGIS only, so a fresh
# database from that image fails on the first migration — which is exactly
# what happened when the production stack was first brought up.
FROM postgis/postgis:16-3.4
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-h3 \
 && rm -rf /var/lib/apt/lists/*
