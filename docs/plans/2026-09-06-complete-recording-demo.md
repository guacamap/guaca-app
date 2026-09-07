# Guaca: complete, repeatable product recording

Status: proposed end-to-end plan. No app implementation, data reset, or deployment authorized by this document.

Update: the user supplied `Guaca_Caribbean_Live.pdf` after this draft. The authoritative product priorities, deck-to-screen mapping, lodging scope, and recording sequence are now in [the deck-aligned master plan](2026-09-06-deck-aligned-demo-master-plan.md). Retain this document's isolation, permissions, rehearsal, and state-machine guidance where it does not conflict. Restaurant booking remains an optional variant, not the confirmed primary reservation type.

## 1. The experience we are building

A visitor can discover things to do, build a day, ask for local information, watch a Spotter resolve the information gap, and reserve with a business. The merchant receives and confirms the same reservation. The tourist sees the confirmation and has something concrete to do next.

Use the existing Caribbean identity, bilingual copy, photo profiles, category icons, public/verified distinction, and phone-first interfaces. Preserve the user's Puerto Cabello and Cartagena population and photos. Impeccable's planning guidance informs the connected task flow, state coverage, and role-specific interfaces—not a new brand direction.

Working assumptions for confirmation:

- Main narrative: one day in Cartagena. Puerto Cabello remains a populated second destination and regression check, not a distracting mid-story detour.
- Reservation MVP: a restaurant table for two, requested by the tourist and confirmed by the merchant. Hotel-room inventory, tour ticketing, deposits, and real payments are outside this first delivery. If the user chooses another reservation type, revise inventory and forms before building.
- A complete cut is about 6–8 minutes, plus a 90-second highlights cut.
- Natural application copy and no persistent “demo” watermark. State the simulated nature of the cast, availability, and transactions in the recording description or introduction; never narrate mock field evidence, merchant acceptance, or payout as a real-world event.

## 2. Current baseline and actual gaps

| Surface | Existing foundation | Required for the recording |
| --- | --- | --- |
| Entry/auth | Tourist and Spotter gates, presentation-mode controls, scoped showcase access | Separate role sessions; rehearsable merchant login; no credentials visible in footage |
| Destination discovery | Country/city picker, Puerto Cabello data, Cartagena seed files now present, photo profiles, map icons | Validate both city imports; intentional default framing; ensure every narrative stop resolves to a place |
| Tourist | Search, favorites, Guaca, plans, shared trips, profile, updates | Concrete activity choices, predictable scripted queries, reservation request and reservation history |
| Spotter | Missions, acceptance, capture, confirmation, profile/points | Resettable assigned work, prepared evidence, two-actor confirmation, visible return to tourist |
| Business | Business-authored content and an operator-admin recording segment | Actual merchant-scoped workspace, owned venue, availability, reservation inbox and confirmation |
| Property QR | Attribution landing at `/v/[qrToken]` | Optional authentic start at a host property, with the correct destination handoff |
| Operator/admin | Oversight, missions, review, activity, access management | Optional behind-the-scenes segment; never present operator-wide access as merchant access |
| Reservations | No in-app reservation implementation found in inspected application/API/shared code | New domain, API, persistence, permission checks, tourist UI, and merchant UI |

The existing `docs/RECORDING_SCRIPT.md` is useful rehearsal history, not proof that the new reservation journey exists. Keep it untouched until a replacement has been rehearsed.

## 3. Connected story and visible proof

```text
Tourist explores → saves an activity → asks for current local information
                                               ↓
Spotter accepts → submits evidence → second Spotter confirms
                                               ↓
Tourist receives update → requests a table → merchant confirms
                                               ↓
Tourist sees confirmation → opens directions and shares the day
```

Every arrow corresponds to a persisted application event. Do not reveal a pre-seeded completed result when the on-camera action was supposed to produce it.

### Tourist: things to do

Seed 8–10 editorial activity cards across the two cities, with at least six ready for the Cartagena recording. Examples of activity types: historic-center walk, wall/viewpoint stop, Getsemaní art walk, sweets stop, beach visit, and dinner. Treat these as suggested plans, not claims about scheduled events or commercial tour availability.

Each activity has an EN/ES title, short description, cover photo, linked place IDs, category, estimated duration, travel mode, area, and a suggested time window. Mark time/duration as estimates. Only display price, opening times, accessibility, or booking availability when the scenario explicitly supplies them or a real source supports them.

Provide three useful entry choices: “Explore nearby,” “Plan my afternoon,” and “Find dinner.” Let the tourist open an activity, save it, add its places to a plan, and inspect directions. A reservation action appears only for the isolated scenario's participating merchant, not arbitrary real public listings.

### Spotter: work with a clear outcome

The main mission checks a narrow observable fact at a seeded place, such as the presence and readability of an entrance/menu/access sign. Avoid broad claims such as a beach being “safe” or an area being safe at night.

The tourist's request creates the scenario mission; Spotter A sees and accepts it, submits prepared evidence through the real form/API/storage path, then sees “awaiting confirmation.” Spotter B independently confirms in another session. The state machine and distinct-actor constraint remain real. Location, images, and verification-provider results are simulated only inside the isolated scenario.

Show history, the completed mission, and points credited. If showing money, use a sandbox ledger with earned/pending/settled states. Do not claim funds were transferred or trigger a real payout provider.

### Business: reservations, not operator oversight

Create one clearly fictional recording merchant and venue, with original branding and permissioned/appropriately captioned imagery. Do not attach fabricated ownership, inventory, or booking confirmations to a real Cartagena or Puerto Cabello business.

The merchant signs into a dedicated workspace, sees only its venue, reads the same booking request the tourist created, confirms it, and optionally publishes a venue update. The tourist receives that confirmation without manually fabricating a second record. The merchant can neither verify its own place as an independent Spotter nor access operator-wide controls.

## 4. Scenario data and role cast

| Fixture | Minimum content | Recording purpose |
| --- | --- | --- |
| Tourist | Existing presentation identity, language preference, 6–8 saved places, one starter itinerary, empty new-reservation state | Personal, populated arrival without skipping the main actions |
| Spotter A | Separate account, profile photo, local area, completed history, eligibility for new mission | Accept and submit live during the take |
| Spotter B | Different account and identity, same relevant area | Demonstrate independent confirmation |
| Merchant | Separate merchant identity, venue membership, contact profile, table inventory | Confirm incoming reservation |
| Optional operator | Separate administrator identity | Review activity without granting merchant excess privileges |
| Public catalog | Existing curated destinations and photo/icon metadata | Attractive exploration and sourced place profiles |
| Scenario place | One isolated fixture linked to the mission, initially unconfirmed | Visible verification transition without modifying public truth |
| Activities | 8–10 total, at least six in the narrative city | Real choices beyond staring at map pins |
| Merchant slots | Several bookable slots, one unavailable slot, one next-day option | Show useful selection and graceful failure |
| Seed history | A few completed missions, merchant history, and previous activity events | Avoid empty dashboards while keeping today's journey new |

Use stable scenario IDs and a manifest connecting all records. Give every relationship a valid foreign key; the tourist, mission, place, merchant, and reservation must belong to the same scenario and destination. Avoid fake user phone numbers that could contact real people. Mock email/contact adapters accept only scenario identities.

Use a scenario clock anchored to a chosen recording date, with dates derived relative to it. Cartagena uses `America/Bogota`; Puerto Cabello uses `America/Caracas`. Store instants consistently, render in venue-local time, and keep seeded times, expirations, activity, and slots coherent. Do not change the machine clock or mix real timers with frozen scenario expiration checks.

## 5. Reservation MVP: complete state model

Proposed states:

```text
requested → confirmed → completed
    ├────→ declined
    ├────→ expired
    └────→ cancelled
confirmed ───────────→ cancelled
```

Slot selection itself is not a confirmed reservation. Copy must say “Request a table” and “Awaiting confirmation” until the merchant acts.

Tourist flow: venue → date → available time → party size → optional note → review → request → pending status → confirmation/reference → directions/cancel. Require an authenticated account; collect no payment details for this MVP. Reservation history lives with the tourist's plans, not only in a temporary success toast.

Merchant flow: pending inbox → party/date/time/note → confirm or decline with a short reason → persistent status history. Merchant schedule allows disabling a future slot without erasing existing bookings. Show only the minimal customer information needed to serve that reservation.

Proposed domain: merchant accounts and venue memberships; bookable venue settings; availability slots with seat capacity; reservations linked to tourist, merchant venue, slot, and scenario; transition/audit events. If existing identities can safely support merchant memberships, reuse them instead of creating a duplicate account system.

Define pending requests as time-limited capacity holds. Create/confirm/cancel transitions must be transactional, with server-side capacity checks, allowed-state checks, and idempotency keys. Repeated taps create one reservation. Two clients cannot overbook the same capacity. Cancelling, declining, or expiry releases the hold exactly once.

Proposed API surface, names to reconcile with repository conventions during implementation:

- Availability by venue/date; create/list/read/cancel a tourist's own reservation.
- Merchant's own reservation inbox; confirm/decline a reservation; adjust own future availability.
- Scoped merchant authentication and membership checks.
- Existing event/polling mechanism if suitable; otherwise bounded polling with refresh/retry. The recording target is a visible cross-role update within three seconds locally.

No public booking enabled for real businesses until ownership, actual inventory, terms, and real operational delivery are separately implemented and approved.

## 6. Make mocks reliable without weakening the real app

Use real frontend components, API endpoints, authorization, database writes, events, and state machines against an isolated demo database and storage prefix/bucket. Mock unstable or consequential integrations behind server-owned adapters:

| Dependency | Recording behavior | Production boundary |
| --- | --- | --- |
| AI | Versioned, reviewed responses for scenario prompts; valid IDs and localized copy; unsupported prompts get a graceful limitation | Do not silently represent replay as live inference; production provider remains unchanged |
| Mission dispatch | Select eligible scenario Spotter and create a real scenario mission | No notification to an actual worker |
| Evidence/location checks | Prepared uploads and deterministic scenario results | No general location or verification bypass; fixtures rejected outside isolated mode |
| Email/SMS/push | Store in local outbox and show in-app notifications | No real recipients or production sender calls |
| Reservations | Isolated merchant inventory with real transactional transitions | No real business inventory/contact |
| Payments | Sandbox ledger/events only | Production credentials inaccessible; real payments disabled |
| Weather/rates | Timestamped scenario context if needed | No assertion of current real conditions |
| Maps/photos | Local profile assets; working map provider with rehearsed error state | Do not remove attribution; no invented image licenses |

Server configuration—not a query parameter or frontend flag—controls adapters. Startup refuses demo adapter mode with an unapproved database/storage target. Production startup refuses test codes, fixture evidence, replay-only provider configuration, and seed/reset handlers. Do not broaden `showcaseAccess.ts` into an unrestricted bypass. Its current read-only Spotter account is for exploration, not the action-taking recording actor.

Use three separate browser profiles or isolated sessions for tourist, Spotter, and merchant; a fourth for the second witness. Existing role-cookie switching can invalidate another role in the same browser context. Do not rely on three tabs sharing one cookie jar.

## 7. Every visible surface must have a purpose

Before recording, make a control inventory: each visible button/link must have a working action, a clear disabled state with reason, or be excluded from the recording surface through an explicit product decision. Never leave dead calls to action.

- Entry: correct role and destination, clean loading/auth errors, no code/secret in footage.
- Map: photo pins plus category fallback, selected marker/list synchronization, public vs verified semantics, meaningful filtering, dense-pin handling, missing-photo fallback.
- Activities: useful choices, detail, save/add-to-plan, no invented scheduled event.
- Chat: concise prompts, bounded response latency, loading/error/retry, grounded place chips, mission request handoff.
- Plans: readable local times, stops, directions, favorites, shared link, reservation status, safe cancellation/deletion.
- Spotter: loading/empty/assigned/accepted/submitted/awaiting/verified/rejected states, upload progress, permission errors, completed history and points.
- Merchant: today view, request inbox, booking details, confirmation/decline, availability, venue/profile, optional business update.
- Profile: working language/session controls, saved preferences and useful history.
- QR/shared pages: work logged out where intended; reveal no private reservation data in a publicly shared itinerary.
- Operator: oversight and audit only; no accidental dangerous actions during footage.
- Mobile: 320px and standard phone widths, landscape, keyboard, safe areas, sticky controls, scroll restoration, 44px task targets. Desktop gets readable framing, not stretched phone cards.

## 8. Implementation order and completion gates

1. **Inventory and scenario contract.** Confirm reservation type/city; document existing endpoints, data relationships, adapter seams, and control inventory. Freeze the recording cast and storyline.
2. **Isolation and lifecycle tools.** Dedicated database/storage, demo-mode guards, clock, mock outbox/providers, scenario IDs. Proposed commands: `demo:seed`, `demo:check`, `demo:reset --scenario <id>`, `demo:rehearse`; these do not exist merely because they are listed here.
3. **Population and activity layer.** Validate both city seeds and media, introduce activity schema/content, seeded history, merchant fixture and availability. Idempotent normal seed never overwrites user-edited records.
4. **Reservation backend and merchant authorization.** Migrations, memberships, inventory, transitions, concurrency, idempotency, private event delivery, and tests before UI wiring.
5. **Tourist completion.** Activity browsing, place-to-booking CTA, request form, pending/confirmed states, plans integration and notifications. Wire real persistence first.
6. **Merchant completion.** Venue-scoped workspace, inbox, confirm/decline, slot management, audit trail. No operator-token shortcut.
7. **Spotter-to-tourist loop.** Deterministic dispatch, evidence fixture input, two-session confirmation, points and tourist updates. Never auto-complete the mission when the tourist clicks request.
8. **Whole-app UX pass.** EN/ES, phone/desktop, empty/error/busy/success states, source labels, icons, photos and all visible actions. No cosmetic-only success screens.
9. **Automated rehearsal and recording runbook.** Run the complete journey, reset, repeat successfully, then record a production build. Commit/deploy only when separately requested.

Each phase has a gate: the next phase cannot compensate for missing permissions, data consistency, or state transitions with hardcoded frontend success.

## 9. Recording storyboard

| Beat | Screen and action | Proof on camera |
| --- | --- | --- |
| 0:00–0:30 | Tourist opens destination/optional host QR | Populated Cartagena, clear next actions |
| 0:30–1:20 | Browse activity, open place/photo, save, add to day | Things to do, real linked records, persistence |
| 1:20–2:00 | Ask the prepared local-information question; request a check | Honest information gap becomes a pending request |
| 2:00–3:00 | Spotter A accepts and submits prepared evidence | Mission changes status through actual user actions |
| 3:00–3:30 | Spotter B confirms | Distinct second actor; record and points update |
| 3:30–4:00 | Tourist receives result and opens updated place | Cross-role information loop closes |
| 4:00–5:00 | Tourist requests dinner for two | Available slots, review, pending reservation/reference |
| 5:00–5:45 | Merchant opens inbox and confirms | Same request, venue-scoped account, confirmation |
| 5:45–6:30 | Tourist opens confirmed reservation, directions, shared day | Concrete outcome and next action |
| Optional | Operator activity or second destination | Breadth without replacing the core story |

Use natural pacing, not artificial long typing/waiting animations. Target deterministic scenario responses within two seconds locally. Keep the second witness session ready off-camera. A pre-recording reset is allowed; an undisclosed manual database edit halfway through the take is not part of the product journey.

## 10. Rehearsal, reset, and acceptance

Prepare a fixture manifest, relationship validation, image check, account/permission check, time/slot check, provider-mode check, storage check, and endpoint health check. Never print tokens/codes in the recording window. No reseeding with broad deletes on the user's current working database.

Reset is destructive and must refuse unknown targets. Scope it to the isolated scenario and enumerated fixture IDs, invalidate pending requests/events, restore the start checkpoint, and retain public source data. Normal seed is additive; reset is explicit. Freeze the build and scenario version for the take; pause only isolated background jobs that would create nondeterministic state.

Required automated acceptance:

- Tourist → mission → Spotter A → evidence → Spotter B → tourist update passes twice from reset.
- Tourist → reservation → merchant confirmation → tourist confirmation passes twice from reset; reload each role to prove persistence.
- Duplicate submit, concurrent last-slot requests, decline, expiry, cancellation, unauthorized merchant, other tourist's reservation, and merchant-as-verifier negative tests pass.
- Scenario actor A cannot count as both witnesses. Real provider credentials and external messages are never used by rehearsal.
- Shared trip is usable logged out but excludes private booking/customer information.
- Day/time/city IDs remain correct; no stale Puerto Cabello state leaks into Cartagena.
- Broken image, offline response, failed upload, geolocation denial, full slot, expired session, and unavailable AI have usable recovery paths.
- Browser checks cover portrait, landscape, desktop, EN/ES, no page errors/overflow, and keyboard focus. Real-device keyboard/camera checks are explicitly separate from browser emulation.
- Build, typechecks, integration tests, seed idempotency, reset isolation, and public-data regression checks pass.

Deliverables: scenario manifest; isolated seed/reset/check tooling; tourist activity/reservation flow; action-taking Spotter cast and confirmation flow; merchant workspace; deterministic adapters; tests; role-by-role storyboard; start/end screenshots; and a presenter checklist with secrets kept out of version control.

Success means a presenter can follow the runbook from a clean checkpoint without SQL, terminal repair, provider luck, real outbound transactions, or empty/dead screens. It does not mean the mock merchant, availability, field visits, or payments are real commercial operations.
