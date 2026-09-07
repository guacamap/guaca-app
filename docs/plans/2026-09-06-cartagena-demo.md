# Cartagena population, pins, and icons

Status: proposed plan, awaiting confirmation. No population or application changes performed.

## Outcome

Make Cartagena, Colombia a second populated destination in the existing Guaca app. A presenter should be able to select Cartagena, browse photo-backed places, open profiles, save places, ask Guaca, and open a Cartagena itinerary on desktop or mobile. Preserve Puerto Cabello's data, photos, saved trips, and current behavior.

Assumptions: “pints” means map pins; reuse the current Caribbean visual identity and `viajero@guaca.live` account; no new domain or auth bypass; no intrusive demo banners. Public-source and image-credit information remains available. This is a planning brief, not authorization to deploy or populate production.

## 1. Geography and data foundations

- Resolve Cartagena's existing area by slug `cartagena`; keep its stable ID. It already exists in `CARIBBEAN_CITIES` and the reference-geography seeder.
- Correct Cartagena's timezone to `America/Bogota`. The expansion-city insert currently hardcodes `America/Caracas`, so changing only the future insert will not fix existing rows. Add a targeted, idempotent correction for Cartagena.
- Research the actual coverage boundary and visitor-facing center before choosing coordinates. The existing city center is a reference point, not a validated framing for the historic center. Verify that every curated place is within the area and candidate-query bounds.
- Start with Centro Histórico/San Diego, Getsemaní, the Castillo surroundings, and Bocagrande. Include Marbella/La Boquilla only with deliberate coverage and transport handling. Do not use a city-center walking itinerary for islands or distant beaches.
- If neighborhood zones are needed for discovery or mission attribution, namespace IDs such as `cartagena:centro` to avoid collisions with Puerto Cabello's `centro`.
- Keep “public places available” separate from “active Spotter coverage.” Adding listings alone must not turn all Colombia coverage badges into “live.”

## 2. Content scope

Target 16 curated profiles, with an initial acceptance floor of 12 fully researched, photo-backed profiles. A larger OSM backdrop is optional, not a reason to delay the curated set.

Initial research shortlist:

| Group | Places to research | Default icon |
| --- | --- | --- |
| Culture/history | Torre del Reloj, Castillo San Felipe de Barajas, a specific accessible Murallas viewpoint, Plaza Santo Domingo, Teatro Adolfo Mejía | `Landmark` |
| Getsemaní and walking | Plaza de la Trinidad, Parque Centenario | `Landmark` / `Leaf`, according to actual record |
| Markets and food | Las Bóvedas, Portal de los Dulces | `ShoppingBag` / `Utensils` |
| Beaches | Bocagrande, Marbella, La Boquilla | `Waves` |
| Additional venue research | Two named restaurants, one café, one music venue | `Utensils` / `Music2` |

The first 12 are a shortlist, not imported records. Verify exact entities, names, entrances, coordinates, duplicate OSM nodes/ways, and category mapping. Research commercial venues from their own current pages before selecting them; do not invent business names to fill a quota.

Each profile needs: stable source identity, exact coordinates, taxonomy category, original EN/ES summary, EN/ES getting-there text, source URLs, research date, and an image record with credit and established reuse rights. Phone, website, opening hours, prices, and access claims are optional and must not be guessed. Absence of hours must not become “open now.”

Source leads verified during planning:

- [Torre del Reloj — Colombia Travel](https://colombia.travel/es/cartagena/visita-la-puerta-y-la-torre-del-reloj).
- [Colonial Cartagena — Colombia Travel](https://colombia.travel/es/cartagena/cartagena-colonial): Torre, Portal de los Dulces, and Castillo.
- [Murallas — Colombia Travel](https://colombia.travel/es/cartagena/las-murallas-de-cartagena).
- [Plaza Santo Domingo — Colombia Travel](https://colombia.travel/es/cartagena/la-plaza-de-santo-domingo).
- [Teatro Adolfo Mejía — Colombia Travel](https://colombia.travel/es/cartagena/teatro-adolfo-mejia).
- [Las Bóvedas — Colombia Travel](https://colombia.travel/es/cartagena/conoce-las-bovedas).
- [Beaches — Colombia Travel](https://colombia.travel/es/cartagena/playas-de-marbella-y-la-boquilla).
- [2026 visitor map](https://atuladocartagena.com/wp-content/uploads/2026/01/ES_CityMapCTG.pdf): further location research for Plaza de la Trinidad and Parque Centenario; inspect it during implementation before extracting coordinates or details.

## 3. Photos, pins, and icons

- Save optimized local assets under `apps/app/public/demo/cartagena/`, with an `ATTRIBUTION.md` manifest. Prefer licensed Wikimedia photos, permissioned venue images, or user-owned images. Google can locate sources; a Google Images result is not a reuse license. Do not hotlink search thumbnails or relabel Puerto Cabello photos as Cartagena.
- Reuse `PublicPlaceProfileSchema`, `PublicPlaceProfile`, and the existing photo viewer. `/demo/cartagena/*.jpg` and `.webp` already fit the schema.
- Extend the shared map presentation so curated **public listings** can have photo-backed markers without being promoted to verified records. Today tourist photo pins are constructed from verified places while unverified candidates use the dots layer; this requires a real rendering change, not just attaching image URLs in the seed.
- Give listed markers an explicit public-listing treatment without a checkmark, witness avatar, rating, or trending badge. Preserve the green check only for actual verified records. A photo describes a place; it is not verification evidence.
- Keep ordinary background candidates as small dots. Exclude featured-marker IDs from the dots layer to prevent duplicate representations and competing click targets.
- Use one category-to-icon mapping for filters, list fallbacks, and map markers. Reuse `PLACE_ICONS` and the existing map `iconSvg` interface through a trusted icon adapter; do not insert scraped SVG/HTML.
- Selected markers get an outline and matching list state. At low zoom, limit/cluster featured markers; at street zoom, reveal the curated set. Preserve readable labels and at least 44px interactive targets. Missing photos fall back to category icons.

## 4. Account and itineraries

- Add 6–8 Cartagena favorites to the existing presentation account without replacing Puerto Cabello favorites.
- Add two independently identified trips: a historic-center day and a two-day city/beach itinerary. Resolve every stop to a real Cartagena record; validate local start times and transport separation before using them in the presentation.
- Keep profiles realistic without fabricating reviews, visits, activity, or partnerships. Optional simulated Spotter missions belong in an explicitly isolated fixture workflow, not public listing verification.
- Add a proposed `/map?area=cartagena` entry path with clear precedence over previously saved city selection; preserve the normal Puerto Cabello default when no explicit city is requested.
- On city change, clear stale selected-place/answer state, load the right catalog and map bounds, and verify that Guaca retrieval and itinerary creation use Cartagena rather than pilot coordinates. Keep saved data account-wide, with understandable city context where records mix.

## 5. Implementation sequence

1. Geography correction and source/coordinate research.
2. Checked-in source snapshot and `packages/db/src/seed/cartagena.ts`, following the Puerto Cabello importer/profile pattern. Transactional writes, stable IDs, source deduplication, dry-run summary, and no broad name-based updates or deletes.
3. `seed-cartagena-cli.ts` plus package command, with an explicit target/environment check. Keep real public catalog import separate from local-only account fixtures.
4. Local photo assets, credits manifest, and schema validation.
5. Public photo-marker rendering, shared category icons, city entry, and stale-state handling.
6. Additive account favorites/trips with stable fixture IDs and no overwrite of edited existing trips.
7. Integration tests, mobile/desktop walkthrough, and recording instructions. Review the diff before any commit or deployment.

## Acceptance criteria

- At least 12 researched Cartagena profiles, each with a working photo, source, correct category, and valid coordinates.
- Each featured place has exactly one selectable marker; pin/list/profile resolve to the same record. Public markers never show local verification merely because they have a photo.
- Country/city switching and direct entry survive reload; no Puerto Cabello answer, distance, place selection, or map center leaks into a Cartagena session.
- Favorites persist; both trips open and share with correct place IDs and local times. No first stop silently becomes an overnight visit.
- Seed reruns add no duplicates and preserve existing user edits. Before/after checks confirm Puerto Cabello record IDs, photos, favorites, and trips are unchanged.
- Check EN/ES, 320px phone, standard phone, landscape, and desktop. Include slow loading, empty category, missing image, failed fetch, dense pins, and list/detail return behavior.
- Build/typecheck and targeted DB/schema/map tests pass. No deployment until separately requested.

Recommended first delivery: the 12-place catalog, distinctive public photo pins, and one saved itinerary. Follow with the additional commercial venues and second itinerary after the first complete journey is verified.
