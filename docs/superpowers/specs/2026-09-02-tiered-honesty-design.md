# Tiered honesty: Guaca plans without a human in the loop

Date: 2026-09-02. Status: approved direction ("verified first, fall over into 3 or 4 open datasets").

## The rule, restated

Guaca recommends and plans from three tiers, always preferring the higher one and always saying which tier a stop is in:

1. **Verified**: a local stood there (today's only tier).
2. **Corroborated**: the same place appears in two or more independent open datasets with matching name, category and location. Ranked by how many agree.
3. **Listed**: one open dataset only. Used only when nothing better exists nearby and said so.

Missions no longer gate whether a place can be mentioned; they upgrade a stop from tier 2 or 3 to tier 1. The gap agent commissions missions for the tier 2 and 3 stops that plans actually used, so human verification follows real demand.

## Datasets (all openly licensed, none scraped)

| Source | License | Gives us | Status |
| --- | --- | --- | --- |
| OpenStreetMap (Overpass) | ODbL | name, category, `opening_hours`, `cuisine`, `wheelchair`, phone, website | imported; hours and cuisine tags parsed but unused |
| Overture Maps Places | CDLA Permissive 2.0 | name, category, brand, address, phone, website, socials, confidence | imported, 61 areas |
| Foursquare OS Places | Apache 2.0 | name, category, address, phone, website, hours (some), 100M+ POIs, monthly | to import (Parquet from S3 / Hugging Face) |
| Wikidata | CC0 | notable places: description, image, coordinates, inception, heritage status | to import for culture/history and beaches |
| Wikivoyage | CC BY-SA | destination narrative per town: what it is, districts, how to get around | to fetch per area; attributed in the app |

## Data model

- New table `place_sources (place_id, source, source_id, name, category, lat, lon, attrs jsonb, confidence, refreshed_at)`, unique on `(source, source_id)`. Every import writes one row here and links to a `places` row (matched within 120 m by name similarity ≥ 0.6, else inserted).
- `places.corroboration` (int, maintained by the importers) = number of distinct sources.
- `places.tier` is derived, never stored: verified if `verification_status = 'verified'`, corroborated if `corroboration >= 2`, else listed.
- `places.open_hours` filled from OSM `opening_hours` or Foursquare hours, normalised to a weekly schedule.
- Existing `public_*` columns stay; they become the merged best-of across sources.

## The agent

- `findPlannableNear` replaces `findVerifiedNear` in the ask and plan paths, returning tier and corroboration.
- Coverage gating counts tiers separately; the planner is offered verified first, then corroborated, then listed, and its prompt states each stop's tier.
- The guard's catalog includes every offered place, so citing a corroborated place is allowed; citing anything outside the catalog is still refused.
- The rendered itinerary carries a tier line per stop, in plain words: "a local verified this on 12 Aug" / "three open maps agree this exists, nobody from Guaca has been yet" / "listed once, unconfirmed".
- Day context already flows into the planner; hours join it so a stop closed at the planned time is skipped.
- The concierge gets the Wikivoyage narrative for the area it stands in, for flavour only; it still never cites a place.
- After a plan is delivered, the tier 2 and 3 stops it used are recorded as demand, and the gap agent may commission them.

## Phases

1. `place_sources` + corroboration, Foursquare import for the 61 areas, backfill from existing OSM/Overture rows.
2. Tiered retrieval, planner and renderer changes, guard catalog, tests, benchmark rerun.
3. Hours parsing and use in the route.
4. Wikidata for notable places; Wikivoyage narrative for the concierge.
5. Demand recording for used tier 2/3 stops.
