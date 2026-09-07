# Guaca Caribbean Live — deck-aligned demo master plan

Status: proposed implementation plan for review. Planning only; no application changes or database writes.

## Approved recording fidelity

The user confirmed that capabilities may be illustrative for the recording only. The deliverable is a coherent product walkthrough, not a production launch or proof of real commercial operations. Where later sections require live integrations to prove a capability, that requirement applies to production claims—not to an explicitly illustrative recording.

- Recording-scoped mock data and deterministic responses may illustrate AI planning, local conditions, evidence checks, missions, rewards, lodging availability, merchant confirmations, entitlements, and zone licenses.
- Keep normal product copy and clean screens: no persistent demo banner, watermark, or repeated disclaimer. A single introduction or recording-description line can establish the context: “Illustrative product walkthrough using simulated data and transactions.”
- Actions must still have consistent outcomes across roles: the same mission, reservation, balance, and status must connect the tourist, Spotter, and merchant screens. Do not silently switch to unrelated precompleted records.
- Mock satellite/environmental checks may appear as a concept demonstration in this recording context; they do not establish a working live integration. Keep their simulated provenance in scenario metadata and presenter notes.
- Illustrative behavior is restricted to the recording environment. No real bookings, messages, charges, payouts, physical reward fulfillment, fabricated public verification, or production-wide bypasses.
- Recordability and repeatability are the acceptance gates. Production integration readiness is tracked separately and is not a prerequisite for the illustrative cut. A flow still needs rehearsal before being called ready to record.

Reference: `/home/rob/Downloads/Guaca_Caribbean_Live.pdf`, all 10 pages visually reviewed. The PDF contains raster slides rather than extractable text. Page numbers below refer to that file.

This is the authoritative product brief for the recording. It revises the earlier [end-to-end recording plan](2026-09-06-complete-recording-demo.md), whose isolated scenario architecture, permission boundaries, reservation safeguards, and rehearsal requirements remain applicable unless amended here. Impeccable's planning guidance is used to turn the deck into connected task journeys rather than copying slide layouts into app screens.

## 1. What the recording must prove

The core promise is a Caribbean travel map kept useful by local contributions. Booking is an outcome of that trusted information, not the primary identity of the product.

The viewer should see five outcomes:

1. A tourist finds useful, fresh local information and concrete things to do.
2. Guaca builds an editable hour-by-hour day around the tourist's interests.
3. An information gap creates work for a Spotter; evidence and independent confirmation update the map.
4. The Spotter receives a consistent reward and progresses toward a community benefit.
5. A relevant business is discovered, receives a reservation request, and confirms it back to the tourist.

Use Cartagena for the main story and Puerto Cabello for a second populated destination. Limón is explicitly in the deck's expansion vision, but stays “planned” in the recording unless separately populated and tested. A country/city being listed does not imply live local coverage.

## 2. Deck-to-product requirements

| PDF page | Product promise | Required screen/action | Evidence on camera |
| --- | --- | --- | --- |
| 1 | Caribbean in real time | Photo-led entry with three clear roles and destination | The visitor enters the intended city and role without explanation |
| 2 | A map that stays fresh | Map, local conditions, activity discovery, source/freshness labels | A local question receives a changed answer after the contribution loop |
| 3 | Locals confirm pins | Place evidence summary and marker states | Actual scenario witness count and elapsed time, not hardcoded “12 min ago” |
| 4 | Your day, hour by hour | Relax / Adventure / Culture / Food preferences; itinerary timeline | Change an interest, inspect stops, save/share the resulting day |
| 5 | Where to stay, already filtered | Lodging category, map/list, price bands, location/amenities, stay detail | Tourist chooses a relevant stay and starts a reservation request |
| 6 | Micro-missions with rewards | Mission map, brief, reward, deadline, accept/upload/status | New tourist demand becomes assigned work and then verified information |
| 7 | Three roles, one map | Dedicated tourist, Spotter, and merchant experiences | Each role acts on linked records with appropriate permissions |
| 8 | Contribution rewards | Profile, mission history, points, rank, badges, reward catalog | Completing work changes a balance/progress indicator and permits one sandbox redemption |
| 9 | Evidence, not fabrication | Evidence viewer: captured time/location, photo, witness trail, check status | Supported checks shown; unavailable checks are not falsely marked passed |
| 10 | Sustainable business model | Tourist plan entitlement, business zone license/visibility, free Spotter participation | A concise account/license view; no real checkout or payment necessary |

## 3. Decisions the deck changes

### Make lodging a first-class journey

The first draft assumed a restaurant table. Page 5 makes lodging a better **recommended** reservation story: choose a stay, select nights/guests, request a room, let the property host confirm, and see the stay in the trip. This recommendation needs confirmation before building booking inventory. Do not implement hotel and restaurant inventory simultaneously to avoid making the recording unnecessarily large.

Regardless of booking type, lodging discovery itself is required by the deck. Add a proper lodging taxonomy/filter and icon (`BedDouble` or equivalent), rather than silently categorizing hotels as generic services. Audit shared schemas, imports, API validators, chat retrieval, UI icon mappings, and tests before extending the taxonomy. Existing property QR attribution is not room inventory and must not be repurposed as one without a domain model.

### Put freshness on the fact, not only the place

A venue may be correctly located while its departure schedule, access notice, or opening information is stale. Model time-sensitive observations separately from the enduring place profile. Each observation needs source, observed time, validity/expiry policy, evidence, and status. Labels distinguish public listing, business statement, pending local check, locally confirmed observation, and expired observation.

A simple expiry policy per observation type is enough for the demo; define it in the scenario manifest. Expired facts stop being described as current and may create a new information gap. Update notifications and the itinerary must refer to the changed fact, not claim an entire area is safe or verified.

### Keep the deck's examples distinct from product rules

- Page 3 shows three locals; the inspected backend implements a second-local verification gate. Display the real count. Do not hardcode three or change the trust threshold purely to match a slide. A three-witness scene would require three real scenario actor records and supported confirmation handling.
- Page 6's points/currency example is illustrative, not an established conversion rule. Model reward points and money separately; inspect the current ranking logic, which derives points from mission reward amounts, before presenting different numeric units. Ensure mission card, ledger, profile, and ranking agree.
- Page 8's level title, ranking, missions, and reward quantities are sample UI. Use coherent fixture history and existing level rules, not arbitrary numbers copied from the deck. Do not imply a professional guide qualification through a decorative level name.
- Page 9's satellite/weather anti-spoofing statement is a product ambition until the exact integration is demonstrated. The inspected service has a verification-agent pipeline; audit its actual checks. Show only supported diagnostics. A deterministic mocked environmental result is not proof of a live satellite integration.
- Page 10 proposes subscriptions and zone licensing. Show isolated entitlements and license status without inventing real subscription prices, customers, revenue, or guaranteed business results.

## 4. Tourist experience

Keep the current Map / Guaca / Plan / Profile navigation. Introduce discoverable content within these surfaces rather than adding an overcrowded bottom bar.

**Map / Explore:** photo-backed featured places, consistent category icons, compact public candidates, activities and stays. Filters support the deck's interests and lodging needs. Selected pin, list row, and profile always resolve to one record. Public listings remain visually distinct from locally verified records; reserve checkmarked “verified pins” for the latter. Normal public photos do not become verification evidence.

**Activities:** 8–10 editorial things to do across the two cities, at least six in Cartagena. Each includes source-backed place references, image, EN/ES summary, estimated duration, interest tags, and travel mode. Events such as “tonight at the Malecón” require an explicit schedule/source or isolated scenario event; do not invent a real current event.

**Guaca:** prepared scenarios for planning, lodging discovery, and a local information gap. Return real scenario record IDs, usable place chips, short explanations, and next actions. Unknown live facts produce a useful limitation plus a request for a local check—not a fabricated confident answer.

**Plan:** four selectable interests from page 4, an editable chronological timeline, thumbnail/icon per stop, local times, duration/travel estimates, and source/freshness summary. Add/remove or substitute a stop without leaving stale narrative text. Separate island/boat transfers from walkable city stops. The slide's itinerary is inspiration, not a verified feasible route.

**Stays:** three fictional scenario lodging profiles with distinct price bands and amenities, plus sourced real public lodging records where available. Do not fabricate ratings or availability for real properties. The featured bookable fixture has a full profile and owned merchant account. Filters must be backed by fixture fields rather than changing only the chip appearance.

**Bookings:** pending and confirmed reservations appear in Plan with clear date, guests, venue-local timezone, reference, directions, contact channel, and cancellation. Do not leak private bookings into public trip shares. The profile can show a mock active plan entitlement without performing billing.

## 5. Spotter experience

Use the deck's coral accent and mission icon language while retaining readable app surfaces. A mission marker denotes work, not a verified tourist attraction.

The action-taking actor needs: named fictional profile, appropriate area, photo/avatar, coherent history, several tasks to choose from, and a new mission produced by the tourist request. Provide one main mission, one alternative mission, and a completed-history item. The mission card displays exact brief, place/area, expected evidence, reward units, deadline, and status.

Main flow: accept → capture/upload prepared evidence → submit → verification checks → awaiting second local → second actor confirms → completed → reward credited → tourist/map updated. Errors include upload failure, duplicate evidence, location denied, rejected submission, expired mission, and retry. No frontend success state may skip the actual state transition.

Profile includes mission history, points ledger, current level/progress, rank derived from scenario activity, and earned badges. Reward catalog contains a small set of coherent rewards inspired by page 8, such as a cap, bottle, or local-experience voucher. Demonstrate one sandbox redemption with sufficient balance, balance deduction, immutable ledger event, and a receipt; no shipment or real merchant obligation. Insufficient points is a clear disabled/recovery state.

Use a second isolated Spotter session for confirmation. A merchant or the submitting Spotter cannot count as an independent witness. The read-only showcase account must remain read-only; use a dedicated action-taking scenario account.

## 6. Merchant and lodging experience

Build an actual venue-scoped merchant workspace, not a renamed operator panel. Suggested sections: Today, Reservations, My place, Visibility. A merchant membership grants access only to its owned fixture venue and its requests.

The merchant can edit scenario profile/amenities, publish a business-sourced update, manage future availability, confirm/decline requests, and inspect its zone license. Editing a business claim never self-verifies it. License status affects clearly described business visibility, not local-verification badges or supposedly unbiased recommendations. If a placement is paid, identify it as promoted rather than concealing that distinction.

Lodging booking model, if approved:

- One room type and a small per-night allotment are sufficient; use two example date ranges plus one unavailable range.
- Tourist selects check-in/check-out and guests; server validates local dates, occupancy, inventory across every night, and any scenario price breakdown. Use fixture values only, with no real charge.
- A pending request holds inventory for a defined period. Merchant confirmation converts the hold to a confirmed reservation. Decline, expiry, and cancellation release inventory once.
- Use half-open stay dates `[check-in, check-out)` so the checkout night is not consumed. Check all nights transactionally; idempotent submission prevents duplicate bookings and concurrent requests cannot overbook the final room.
- Persist requested → confirmed → completed, with declined/expired/cancelled branches and authorized actor checks. This replaces the restaurant seat-slot capacity model from the earlier draft if lodging is selected.
- Confirmation includes a reference and booking details, not “payment successful.” Actual check-in, identity-document handling, payment collection, and property-management-system integration are outside the recording MVP.

If restaurant reservations are selected instead, retain the earlier party-size/slot model and show lodging as discovery-only. Do not show a lodging Reserve button that leads to a table form.

## 7. Visual direction from the deck

Preserve the existing photographs and Guaca identity. Use ocean/teal for tourist discovery, coral for Spotter work, navy for merchant information, and warm off-white for task surfaces. Carry the deck's recognizable category icons, photo thumbnails, itinerary sequence, and freshness labels into working components.

Avoid copying presentation artifacts: giant headlines, glowing card edges, full-background imagery behind dense forms, oversized statistics, or phone mockup frames inside the app. On mobile, prioritize one obvious action per state, 44px controls, safe-area spacing, readable text, scrollable evidence, keyboard-aware booking forms, and stable return to map/list. On desktop, use space for map/list and inbox/detail, not oversized phone cards.

Use reviewed category icons for food, beach, culture, walking, lodging, transport, music, and missions. Do not embed raw scraped HTML/SVG into markers. Missing photos fall back gracefully to icons; preserve photographer attribution and accurate illustrative captions.

## 8. Data and implementation packages

### P0 — mandatory complete recording

1. **Scenario infrastructure:** isolated database/storage, server-owned scenario adapters, clock, stable IDs, role sessions, safe seed/check/reset. Never change the user's current population with a broad reset.
2. **Trust and freshness:** explicit observation records, evidence/check statuses, expiry, witness counts, category/marker semantics, and events returning to tourist. Reuse existing persistence where it expresses these concepts correctly.
3. **Tourist activity/itinerary completion:** 8–10 activities, preference selection, photo timeline, supported source labels, responsive browsing, saved/shared day.
4. **Lodging discovery:** three coherent fixture stays, category/filter/schema coverage, source-backed public listings, full profiles, valid city/area references.
5. **Reservation and merchant vertical slice:** choose lodging or tables first; build authorization, inventory/state machine, API, merchant inbox, tourist status, and cross-role delivery together.
6. **Spotter contribution loop:** mission creation from the recorded question, evidence upload, distinct confirmation, profile and reward ledger. Two scenario actors, no production verification bypass.
7. **Recording integration:** automatic/polled state updates, negative-state coverage, complete storyboard, repeatability tests, fresh production build.

### P1 — deck completeness, required before calling it a full deck demo

8. **Rewards:** coherent ranking/badges, one working sandbox redemption and receipt.
9. **Business model:** tourist entitlement view; merchant zone license view and properly distinguished promoted visibility; no real billing, earnings, or revenue claims.
10. **Secondary journeys:** host QR attribution, Puerto Cabello switch, logged-out shared plan, merchant-authored update, and operator audit view.

### P2 — explicitly not proven by this recording

Real commercial inventory/payments, fulfillment, real subscription checkout, live satellite anti-spoofing not already integrated, Limón's local coverage, and autonomous live claims from unverified sources. Keep roadmap boundaries in the presenter notes; do not leave misleading active UI controls.

Repository implementation targets: shared schema/taxonomy/icon modules; DB migrations and isolated scenario seeds; API planner/context/mission/verification seams; new merchant/reservation/ledger modules; app tourist/Spotter surfaces and merchant entry/workspace; mobile styles; integration and browser tests. `apps/admin` remains operator oversight rather than merchant authorization. The existing Cartagena seed and icon work must be inspected and reused, not regenerated or overwritten.

## 9. Recording data and story

Prepare one tourist, two Spotters, one merchant, and an optional operator in separate sessions. Include the current city catalogs/photos; 8–10 activities; three fixture stays; two coherent itineraries; an initially unconfirmed scenario observation; eligible mission actors; seeded histories; available/unavailable booking inventory; reward catalog; one tourist entitlement; one merchant zone license.

Use a coherent scenario date in the correct city timezone. Dates, freshness, mission deadlines, availability, bookings, and ledger events all derive from the same clock. Fixture metadata stays internal; recording introduction/description explains the simulated cast and transactions without cluttering every app screen with a demo watermark.

Revised 7–8 minute main cut:

1. **Arrival / 30s:** destination and three roles; tourist enters Cartagena.
2. **Discover / 45s:** photo map, an activity, source and freshness, save.
3. **Plan / 45s:** Culture/Food preference and hour-by-hour day; inspect and adjust one stop.
4. **Find a stay / 45s:** filter lodging, inspect the selected fixture property, save it.
5. **Missing local information / 30s:** ask the prepared question, see limitation, request a check.
6. **Spotter work / 90s:** accept, submit evidence, second actor confirms, inspect supported checks.
7. **Rewards / 30s:** balance/progress changes; redeem one sandbox reward.
8. **Reserve / 45s:** tourist requests the approved reservation type with clear pending status.
9. **Merchant / 45s:** venue-scoped inbox confirms; brief visibility/license view.
10. **Return / 45s:** tourist receives updated fact and reservation confirmation, opens directions and shares the day. Optional Puerto Cabello glance in the extended cut.

This is a product walkthrough, not evidence that a real local traveled to a location during screen capture. Do not narrate simulated uploads, confirmations, or ledger events as real-world verification or payment.

## 10. Definition of done

- Each deck page maps to an implemented, demonstrated capability or an explicit roadmap boundary; no unsupported scientific/commercial claim is marked complete.
- Two consecutive rehearsals from the start checkpoint complete without SQL repairs, provider luck, manual status edits, real outbound messages, or payments.
- Tourist action creates the exact mission the Spotter sees; evidence and independent confirmation update the exact observation/record the tourist sees.
- Reservation request, inventory hold, merchant acceptance, and tourist confirmation share one persisted record. Duplicate taps, concurrent last-room/slot requests, expiry and cancellation are tested.
- Points, reward currency, ledger totals, levels, ranking and redemption are internally consistent. No duplicated reward on retry.
- Verification count and freshness come from stored evidence/events. Public data and paid placement never masquerade as local verification.
- No stale city IDs, incorrect local times, impossible overlapping itinerary stops, broken images, dead actions, or exposed private booking data in public shares.
- All three roles have useful loading, empty, busy, success, error and recovery states; phone portrait/landscape, keyboard, EN/ES and desktop checks pass.
- Typecheck/build, schema/DB/API tests, permission tests, demo-mode isolation, seed idempotency/reset safety, and browser rehearsals pass. Real-device checks are reported separately.
- Deliver a scenario manifest, durable seed/reset/check/rehearsal commands, finalized runbook, role/session instructions without committed secrets, and start/end storyboard captures.

First approval needed: **Should the on-camera reservation be a lodging stay (recommended from page 5), or a restaurant table while lodging remains discovery-only?** All other work should preserve the deck's main loop and the user's existing data.
