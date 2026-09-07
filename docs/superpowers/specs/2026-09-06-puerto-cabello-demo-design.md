# Guaca — overall design refinement and Puerto Cabello live demo

Status: implementation in progress; preserved specification and handoff.
Date: 2026-09-06.

### Follow-up implementation update

GLM's image-contract reconciliation is implemented and backend preparation now
passes. Licensed photos keep licence metadata; the original venue photos keep
`rights: unverified-demo-only` internally. All photos are preserved. Per the
user's latest instruction, public place sheets omit demo labels and photo-rights
reminders while retaining author/source credits, actual licence links, captions,
and place verification tiers.

`demo:prepare` now also provisions the persistent `viajero@guaca.live` account,
eight saved real places, and a four-stop saved itinerary. The local entry button
opens that account through the existing development authentication flow; no
production authentication bypass was added. The shared-trip page no longer
claims all stops are locally verified. These updates supersede the old photo
conflict and missing-account items recorded below.

An optional deployed presentation access (`SHOWCASE_ACCESS_ENABLED` with a
six-digit `SHOWCASE_ACCESS_CODE`, server-side only, off by default) lets the
deployed instance sign `viajero@guaca.live` into the tourist gate for the
presentation and a read-only Spotter view. It is not a bypass: no universal
code, no roster membership, tourist writes limited to ask/plan/hello/saves/
profile/question-mission, wrong attempts rate-limited across both roles, and
sessions expire the moment the code is rotated or the mechanism is disabled.
It is covered by integration tests and documented in the demo guide.

### Recording preparation (2026-09-06, later the same day)

For a live screen recording the demo was further prepared, rehearsed end to
end with a headless browser, and documented in
[Recording script](../../RECORDING_SCRIPT.md):

- Thirteen enriched profiles, eleven photographed (six under a real Creative
  Commons licence, the venue/listing photos marked demo-only with unverified
  rights, per the user's authorization for this recording only).
- The visible `[DEV]` markers are gone from place and Spotter names; the demo
  cast's hidden designation is its `@demo.guaca.live` logins. Nothing was
  deleted, only renamed and designated.
- Demo-authored hours exist only as business-published place posts (Casa
  Rosada, Blue Marine, Da Franco), through the real posts mechanism, never
  rendered as verified facts.
- A Casa Rosada operator account exists through the real operator flow, with
  its waitlist registration handled.
- `NEXT_PUBLIC_PRESENTATION_MODE` in `apps/app/.env.local` hides development
  affordances in both gates while dev logins keep working.
- The rehearsal proved the full loop live: geolocated Spotter confirmation
  took a place from provisional to verified with two witnesses, a traveller
  refusal commissioned a real mission for a named Spotter, and the operator
  panel showed the oversight numbers and the Casa Rosada rows. Plan questions
  are reliable through the tuned suggestion chips; free-typed two-topic plan
  sentences intermittently draw a graceful refusal (model drift, known from
  the planner benchmark), so the recording uses the chips.

## 1. User intent and decisions

Improve the project's overall design and make Puerto Cabello sufficiently
populated for a live demo. Use publicly researched place information and real
photos, with detailed profiles for a few places. Review the project's context,
preserve Claude's work, and restore anything unintentionally removed.

Latest instruction: preserve the photos and this plan in a written specification.
This document records the intended result, completed work, known conflicts, and
remaining verification. It does not assert that the whole demo is finished.

The user authorized public/Google-sourced images for the live demo. That defines
the intended use, not a copyright licence. Preserve original assets and credits;
do not silently delete or substitute them during another cleanup pass.

## 2. Product context and boundaries

Guaca is a Caribbean local-knowledge product with tourist, Spotter, villa, and
operator experiences. The current monorepo contains:

| Surface | Responsibility in this work |
| --- | --- |
| `apps/app` | Primary design work: entry, discovery/map, profiles, chat, saved places, plans, account |
| `apps/web` | Landing-to-demo handoff and consistency with the shared theme |
| `apps/admin` | Preserve operator functionality; build/typecheck shared-style compatibility |
| `apps/api` | Serve public profiles and candidates; preserve authenticated saves and guarded planning |
| `packages/db` | Repeatable real-place import, editorial profile storage, safe existing-data handling |
| `packages/shared` | Typed public-profile contract, distinct from verification evidence |
| `packages/ui` | Shared visual tokens and existing map/brand primitives |
| `packages/agents` | Preserve grounding; fix small demonstrated intent-recognition issues |
| `apps/mobile` | Preserve the wrapper; no native redesign or store submission in this scope |

The newer [tiered-honesty spec](2026-09-02-tiered-honesty-design.md) governs place
claims. A place may be locally verified, corroborated by independent open
datasets, or publicly listed and unconfirmed. Imported listings must not appear
as witnessed pins or acquire fictional Spotters, ratings, or verification dates.

No deployment, push, database reset, real payout, or new business partnership is
included. Preparing a live demo does not authorize representing simulation data
as real coverage.

## 3. Design direction

Refine the current Caribbean teal, ocean, and warm-paper interface. Keep the
existing Guaca identity and illustrated Caribbean entry background. Do not switch
the entire product to the older bone/merlot direction in root `DESIGN.md`.

Principles:

- Clear hierarchy: city → search → place → evidence → next action.
- Opaque, readable surfaces over the map; restrained borders and shadows.
- Real place photos with visible attribution, not decorative stock photos
  presented as venue evidence.
- A strong primary action and readable secondary controls.
- English and Spanish parity, including entry copy and error states.
- Desktop map/list coexistence; mobile browsing without hiding navigation.
- Useful loading, failure, empty-search, and image-fallback states.
- Visible keyboard focus, sufficient contrast, usable touch targets, and no
  horizontal page overflow.

The Impeccable review informed hierarchy, contrast, and surface simplification.
Its type-ramp findings against the stale root design document were treated as
context-dependent, not blanket authorization to rewrite unrelated components.
No hook rules were suppressed.

## 4. Entry and navigation

The entry page introduces Puerto Cabello with one clear traveller action, a
secondary Spotter action, a language switch, returning-user login, and business
handoff. Keep the existing home-screen installation component, including its
iOS guidance. Business access continues to the landing page's `/#businesses`.

The tourist navigation retains Map, Guaca, Plan, and Profile. Active and hover
states must remain readable; a generic ghost-button hover must not turn the
active label white on a pale background.

Development login remains development-only. Do not enable fixed-code bypass in
production to simplify a presentation. A separate demo tourist account may be
created through the existing local login flow to avoid showing historical audit
posts from the existing development account.

## 5. Discovery and place profiles

### Map and list

Use a searchable unified list of verified places and public candidates. Retain
the distinct map representation: verified pins versus unconfirmed dots.

Desktop: approximately 320px discovery panel at the right, with map tools sized
to the remaining space. Mobile: compact bottom drawer that expands to a scrollable
list and collapses when a profile opens. Start the Puerto Cabello map at a useful
city-level zoom; retain broader area fitting for other locations.

Search is case- and accent-insensitive. Category and trend filters remain.
Ordering prefers verification, then independent-source count, editorial profile
availability, and distance. Keep named-Spotter and computed trending information
from the old discovery cards. Do not invent popularity for newly seeded places.

### Place sheet

Show name, location/landmark information, photo with credit, bilingual summary,
explicit demo/public-information label, public contact details when available,
trust tier, source URLs, and research date. Include Google Maps, directions,
save, ask, and existing appropriate actions.

The sheet must scroll within the viewport. A failed image must not break the
profile. A delayed response for a previously selected place must not overwrite
the current selection or reopen a closed sheet.

A public place cited in chat or a plan must resolve to a full place profile,
not disappear because the client only searched its verified-place array.

### Saved places

Support authenticated saves for verified places and eligible public candidates.
Use optimistic feedback with rollback on failure and prevent duplicate pending
toggles. Saving must survive reload. Rejected or otherwise ineligible places
must not remain visible as valid saved recommendations.

## 6. Puerto Cabello dataset

Bundle an actual OpenStreetMap/Overpass snapshot, retrieved on 2026-09-06, so
preparation does not depend on a live Overpass request. Target at least 40 public
places in a clean database, with these eight enriched profiles:

| Place | Editorial content |
| --- | --- |
| Casa Rosada | Boutique hotel/restaurant, waterfront context, official website |
| Da Franco | Italian restaurant, public location/contact information |
| Blue Marine Restaurant | Seafood restaurant, marina context |
| Fortín Solano | Historic fort, location context, access caveat |
| Teatro Municipal de Puerto Cabello | Cultural landmark, programme/access caveat |
| Playa Delfín | Public beach listing, unconfirmed conditions |
| Castillo San Felipe | Historic fortification, public-access caveat |
| Plaza Flores | Public square, walking reference point |

Use original short English/Spanish summaries of the research. Store exact source
links with each profile. Do not manufacture opening hours, prices, live safety
conditions, reviews, or current availability.

Entity identity and coordinates come from the source map data. Public websites,
phones, addresses, and subcategories may fill missing fields but must not
overwrite confirmed local information.

## 7. Preserve both photo sets

All eight files below are to be retained. The original venue photos remain the
intended venue-specific demo assets; the Commons additions are retained as
alternatives, not silently substituted photographs of the venues.

| File | Content / provenance | Intended handling |
| --- | --- | --- |
| `casa-rosada.jpg` | Casa Rosada; Ocean Drive Venezuela / Mis Revistas | Original venue photo; demo use requested, reuse licence unverified |
| `da-franco.webp` | Restaurant food photo; Raymar Velásquez via minube | Original venue-associated photo; demo use requested, reuse licence unverified |
| `blue-marine.jpg` | Blue Marine façade; El Siglo | Original venue photo; demo use requested, reuse licence unverified |
| `fortin-solano.jpg` | Fortín Solano; Periergeia, 2007 | CC BY-SA 4.0 metadata retained |
| `teatro-municipal.jpg` | Municipal Theatre; Jonathan Suarez, 2013 | CC BY-SA 3.0 metadata retained |
| `malecon-atardecer.webp` | Waterfront at sunset; Ana Chreky, 2014 | Claude's Commons addition; setting, not Casa Rosada itself |
| `malecon.webp` | Malecón promenade; Emily Gonzalez, 2010 | Claude's Commons addition; setting, not Da Franco itself |
| `marina-punta-brava.webp` | Marina at night; John Urrecheaga, 2014 | Claude's Commons addition; setting, not Blue Marine itself |

Keep originals locally with source links and attribution in
`apps/app/public/demo/puerto-cabello/ATTRIBUTION.md`. Do not call “Demo use only”
a licence. Before public release, resolve permission for the three original
venue photos or explicitly choose an appropriately licensed alternative. Because
these assets currently sit under `public/`, a deployment would serve them;
release review must cover the assets themselves, not only their UI references.

If a setting photograph is used, show its bilingual caption and accurate alt
text. It must not be labelled as a photograph of the venue. Existing photos do
not prove current conditions or local verification.

### Current integration conflict — resolved 2026-09-06

Concurrent work tightened `PublicPlaceProfileSchema.image.license` to a
redistributable-licence enum with a required licence URL and optional bilingual
caption. The original seed still contained three `Demo use only` values, which
failed the backend TypeScript build.

Resolution chosen: `image` is now a union. A licensed photo carries a real
licence from the enum plus its licence URL. A demo-only photo whose reuse
rights are not established carries `rights: 'unverified-demo-only'` instead of
any licence value, so no label is invented. Both asset sets, credits, and
source URLs are preserved unchanged. The profile UI renders a licence link for
licensed photos, an honest "Demo photo · rights unverified" line for demo-only
photos, and the bilingual caption when a photograph shows the setting rather
than the venue. Rebuilt, reseeded, and verified: the eight stored profiles
parse, the three demo-only photos keep their credits and rights status, and
regression tests reject `Demo use only` as a licence value and a licence
without a URL.

## 8. Data and API implementation

- Add nullable `places.public_profile` JSONB through migration
  `0027_public_place_profiles.sql`; never use it as witness evidence.
- Expose the profile on candidate/detail reads and relevant catalog queries.
- Keep the verified endpoint verified-only.
- Candidate discovery supports eligible open-data sources, validates bounding
  boxes, and returns tier/corroboration information.
- Add `seed:puerto-cabello` and `demo:prepare` commands. Copy the bundled snapshot
  into the built DB package so compiled execution can read it too.
- Seed idempotently by source identity. Re-importing OSM must not create a second
  independent-source vote. Editorial web references are not map corroboration.
- Preserve user records, existing verified places, and confirmed contact data.
- Preserve Claude's latest submission change: a genuine local submission can
  replace an editorial demo profile, including candidates from all supported
  open-data sources. Add/regress tests for that transition.

## 9. Chat and planning

Keep Claude's first-hello implementation, traveller memory, notifications,
grounding guard, trip persistence, and public share flow. The goal is not to
replace the agent with a scripted demo response.

Update tourist-facing copy so a response may honestly include public listings.
Add deterministic recognition for common historical/cultural phrasing and use
consistent accent normalization; “historical places” and “lugares históricos”
must not fail solely because the lexicon misses those words.

Check that answer place IDs become clickable profiles, trip links use the
current/configured app origin, and saved trips can be opened logged out through
their public share URL. Scheduling suggestions are not confirmed venue hours.

Keep map/profile/saved-place browsing as the fallback when inference is down.
Do not substitute canned model output or fake successful verification.

## 10. Preservation and coordination

No blanket checkout, reset, cleanup, or rollback of the dirty worktree.

Already restored during review: entry-page installation component, original
business anchor, optional login callback contract, and discovery's named-Spotter
and trending information. Claude's greeting and memory changes remain present.

Preserve the unrelated user PNG in the repository root and existing database
records. Concurrent edits were observed in the photo schema, row parser,
submission code, DB build packaging, and photo assets. Coordinate file ownership
before further overlapping edits; a prior successful test run does not validate
newly arriving changes.

## 11. Implementation status and remaining work

Implemented in the working tree: entry refinement, shared theme adjustments,
responsive discovery, full public profiles, eight-profile seed, local media,
candidate API changes, save persistence/rollback, profile lookup for public
answer IDs, local share origins, historical-intent fixes, and demo documentation.

Verification completed before the latest concurrent photo changes:

- Shared tests, grounding/guard tests, selected DB/API integration tests passed.
- Eight-profile seed tests covered idempotency, source counts, verified-data
  preservation, saved public places, and image files.
- Desktop/mobile browsing, bilingual entry, original venue profiles, search empty
  state, and favorite reload persistence were exercised in Chromium.
- Tourist app and marketing production builds passed.
- A live public-place ask returned unconfirmed cultural stops; a live trip was
  created and saved. That trip also selected pre-existing `[DEV]` fixtures, so it
  is not proof of an all-real-place presentation.

Remaining, in order:

1. ~~Coordinate the concurrent edits and reconcile photo metadata without
   removing either asset set.~~ Done 2026-09-06: the licence conflict is
   resolved as described in §7; the backend build passes.
2. ~~Rebuild shared → agents → DB → API, then rerun `demo:prepare` against the
   intended demo database and confirm all eight profiles and local images.~~
   Done 2026-09-06: all packages rebuild; the local demo database holds 44
   public candidates in the Puerto Cabello area and eight parsed profiles with
   corrected image metadata; image files all exist under
   `apps/app/public/demo/puerto-cabello/`.
3. ~~Run final DB/API tests, including the local-submission/profile transition;
   check app, web, and admin builds/typechecks against the final shared
   contract.~~ Done 2026-09-06: shared 18, agents 233, DB 10 unit + 79
   integration, API 76 unit + 48 integration tests pass; app, web, and admin
   production builds pass. Mobile has no shared-contract dependency.
4. ~~Complete one final desktop/mobile browser pass~~ Done 2026-09-06 via
   headless Chromium: entry in EN and ES, iOS install guidance (the desktop
   install button waits for `beforeinstallprompt` by design), business link,
   map canvas at city zoom, accent-insensitive search, Casa Rosada profile
   showing the unverified-rights line, Fortín Solano showing its CC BY-SA 4.0
   link, save and reload persistence, no mobile horizontal overflow, a
   logged-out public share page, and no console errors. Automated with the dev
   bypass account; live plan creation through inference was not re-exercised in
   this pass.
5. Use a clean demo account and preferably a separate clean demo database if old
   fictional verification fixtures would distract from the real place profiles.
   Never delete those existing fixtures without explicit agreement. (The `[DEV]`
   fixtures remain visible alongside the real profiles during the pass.)
6. Rehearse the documented presentation, record remaining external dependencies,
   and only then mark the overall demo goal complete.

## 12. Acceptance criteria and handoff

The task is complete when:

- A visitor can enter, browse Puerto Cabello, inspect a sourced/photo-backed
  profile, save it, reload, and find it again on desktop and mobile in EN/ES.
- At least 40 genuine public listings and eight enriched profiles can be seeded
  reproducibly into an empty development database without fictional witnesses.
- All preserved photos are accounted for; shown photos match their captions,
  and licence/usage claims accurately describe what is known.
- Every place keeps an honest tier; no public listing masquerades as verified.
- Existing Claude functionality and the restored entry affordances remain.
- Builds and scoped tests pass on the final combined state; browser checks have
  no blocking runtime errors or broken demo image references.
- Live planning/share behavior is rehearsed, with a disclosed fallback for
  inference and network failures.

Operational commands and the presentation sequence are in
[Puerto Cabello demo guide](../../PUERTO_CABELLO_DEMO.md). The original extended
field-verification script remains in [Demo script](../../DEMO_SCRIPT.md); its
Spotter/villa targets are prerequisites, not results of this public-data seed.

Local rehearsal addresses: app `http://localhost:3002`, API port 3001, landing
`http://localhost:3004` because another project occupies 3000. No service belonging
to that other project should be stopped to make Guaca's default port available.
