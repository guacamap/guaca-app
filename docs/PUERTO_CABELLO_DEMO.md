# Puerto Cabello live demo

Implementation status, photo-preservation decisions, and remaining checks are
recorded in the [design and demo spec](superpowers/specs/2026-09-06-puerto-cabello-demo-design.md).
The photo-schema mismatch is resolved: original photos retain internal rights
metadata without presentation-only reminders in the place UI. Credits remain.

The demo uses real public listings, original bilingual summaries, credited local
photos, and Guaca's existing trust tiers. It does not fabricate reviews, opening
hours, local witnesses, partnerships, or verification dates.

## Prepare

Requires Node 24+, pnpm 11+, Docker, and the project's local environment settings.

```sh
pnpm install --frozen-lockfile
docker compose up -d
pnpm demo:prepare
```

`demo:prepare` builds the backend packages, runs migrations, and imports the
bundled Puerto Cabello OpenStreetMap snapshot. No live Overpass call is needed.
The eight enriched profiles are Casa Rosada, Da Franco, Blue Marine Restaurant,
Fortín Solano, Teatro Municipal de Puerto Cabello, Playa Delfín, Castillo San
Felipe, and Plaza Flores. Other public map listings fill out discovery.

Preparation also creates `viajero@guaca.live` with eight saved places and one
four-stop itinerary referencing real Puerto Cabello listings. It does not create
reviews, ratings, or local verifications. The account and trip persist in Postgres;
re-running preserves the account's language, login state, and existing trip link.
To prepare just the account after seeding places, run `pnpm seed:demo-account`.

Re-running is safe: existing records, local verifications, and confirmed contact
details are preserved; the same OSM source never counts twice. Preparation does
not erase old `[DEV]` fixtures. If your database contains those, identify them as
fictional during the presentation, or prepare a separate empty development
database using `DATABASE_URL`. Never present them as real local verifications.

Start these in separate terminals:

```sh
WEATHER_ENABLED=false GAP_AGENT_ENABLED=false TRAVELLER_TICK_ENABLED=false pnpm --filter @guaca/api dev
pnpm --filter @guaca/app dev
pnpm --filter @guaca/web dev
```

The app is at `http://localhost:3002`; the landing page defaults to port 3000.
If another project occupies 3000, leave it running and use:

```sh
pnpm --filter @guaca/web exec next dev -p 3004
```

That is the landing port used during this implementation's local rehearsal.
The API is at 3001. Frontend `/api/*` requests proxy to it. A public Mapbox token
is needed for map tiles; the place list, profile data, and local photos do not
depend on Google image servers at presentation time. Tile loading still requires
network access. AI plans need the configured inference provider.

The scheduler flags prevent background commissioning or messages during this
UI/data rehearsal. They are not a substitute for rehearsing the live Spotter loop.
Weather and safety feeds are disabled in this controlled demo; do not use it as
real-time travel advice.

## Sign in and present

1. Open the app, choose **I'm here to explore**, then **Explore Puerto Cabello**.
   This signs into `viajero@guaca.live`. You can also enter that email and request
   a code, then use `000000` locally.
   Fixed codes work only with the development email sender outside production.
2. Decline location permission to stay in Puerto Cabello, or select Puerto Cabello
   from the area picker. On mobile, expand **Browse places / Explorar lugares**.
3. Search **Casa Rosada** or **Blue Marine**. Open the profile, show its public
   information, photo credit, source links, and “listed / unconfirmed” status.
4. Save a place with the heart. Open **Plan → Saved places**, then reload to show
   it persists. Directions and the Google Maps link lead to public maps; they
   are not claims of checked opening hours.
   The account already includes a saved itinerary through the Municipal Theatre,
   Plaza Flores, Da Franco, and Fortín Solano. Its public share link works without
   signing in and shows each stop's actual verification tier.
5. Ask **“museums and history nearby”**. The answer must identify its public stops
   as unconfirmed. A named place in an answer can open its full profile.
6. Try **“Plan one relaxed day of culture and food in Puerto Cabello”** in Plan.
   When inference is available, the trip saves to the account and its share link
   opens without signing in. Times and travel durations are suggestions, not
   confirmed venue hours. Do not represent a failed provider call as coverage.
7. Switch to Spanish and repeat the discovery/profile flow on a phone.

The free-text planner is live, not a prerecorded response. Keep the browsing and
saved-place sequence as the reliable fallback if the provider or venue Wi-Fi
fails. Do not promise live payments or actual local verification from this seed.

## Provenance and media

The map snapshot was retrieved from OpenStreetMap via Overpass on 2026-09-06.
Coordinates and identities come from the source entities; see
`packages/db/src/seed/data/puerto-cabello.osm`. Map data is © OpenStreetMap
contributors, available under the [ODbL](https://www.openstreetmap.org/copyright).

The exact per-profile research URLs, photo sources, author credits, and licence
metadata live beside the seed in `packages/db/src/seed/puertoCabello.ts` and are
shown in the place sheet. Photos are kept in `apps/app/public/demo/puerto-cabello`.
The profile's editorial references do not increase its independent open-map
corroboration count. A dated public photo is not proof of current conditions.

## Design and preservation notes

This is a refinement of the current Caribbean teal/sand interface, not a switch
to the older bone/merlot design described in root DESIGN.md. It adds an opaque,
readable discovery panel, consistent profile hierarchy, responsive mobile drawer,
accessible navigation contrast, visible source labels, and bilingual entry copy.
Impeccable's off-ramp flags against that older document are contextually
intentional here; no blanket rule suppression was added.

Existing tourist/Spotter entry paths, login, home-screen installation, business
handoff, Guaca's first greeting and memory, trip sharing, verification controls,
and admin flows remain. The old verified-only discovery cards were replaced by
the searchable mixed-tier list; named-Spotter and trending information is retained.
No database reset, file deletion, deployment, or push is part of preparation.

The copy-only review preserved existing type sizes and layout. Design-hook
type-ramp warnings against the older DESIGN.md are outside this pass, not new
typography decisions; no suppression was added. The shared-trip heading/footer
were corrected because the old claim that every stop was locally verified was
inaccurate for public listings.

## Latest verification

The GLM follow-up plus account changes passed backend preparation, the tourist
production build, app/web/admin typechecks, 18 shared tests, 11 selected database
tests, and 8 place API tests. Chromium checks passed desktop/mobile login,
profile images and source credits, removal of presentation-only demo text,
eight saved places, save/reload persistence, the four-stop stored itinerary,
logged-out sharing with accurate place tiers, and the landing handoff. No page
errors or API 5xx responses were recorded in that browser pass.
