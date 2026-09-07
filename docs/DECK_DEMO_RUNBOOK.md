# Deck-aligned demo runbook

Presenter script for the 7 to 8 minute Caribbean Live cut. The [deck-aligned master plan](plans/2026-09-06-deck-aligned-demo-master-plan.md) is the product spec. Isolation, permission boundaries, reservation state machine, and rehearsal rules come from [the complete recording plan](plans/2026-09-06-complete-recording-demo.md) where the master plan does not amend them.

This file is written from those plans and the tree as it stands on 2026-09-06. Two consecutive start-checkpoint rehearsals ran through `pnpm demo:rehearse` (mission loop, lodging request, merchant confirm, sandbox redeem, reset). A presenter still walks the browser; that camera pass is separate from the automated rehearsal. A beat whose screen is not in the tree yet is marked **Pending build lane**. Do not film that beat as if the product already does it.

The on-camera reservation is a **lodging stay** (Casa del Baluarte), not a restaurant table.

### Approved format: illustrative recording

The user approved illustrative capabilities for this recording only. Use controlled scenario data and deterministic mock integrations as needed; live commercial/provider integrations are not required for the take. Keep the UI clean, without repeated demo reminders. Introduce it once, or state in the description: “Illustrative product walkthrough using simulated data and transactions.”

This approval does not mean a live field visit or a real payment happened. Automated `demo:rehearse` covers the mission loop, lodging request, merchant confirm, and sandbox redeem twice from the start checkpoint. Remaining presenter work is the camera pass. Mock evidence, rewards, availability, and confirmations demonstrate the intended experience, not actual field visits, live satellite validation, payments, or real-world reservations. Keep all consequential external actions disabled. The production-proof limitations below remain accurate but do not block an explicitly illustrative cut.

## 1. Honesty, spoken once

Say these in the recording introduction or description. Do not watermark every screen.

- The tourist, the two Spotters, the merchant, the three stays, the reward catalog, and the ledger history are a simulated cast for this recording.
- Public Cartagena and Puerto Cabello listings, photos, and source credits are real researched records. Cast venues and scenario stays are fictional.
- Redemption is a sandbox receipt. Nothing is shipped. No merchant is obligated.
- There is no real payment, checkout, deposit, or payout. Confirmation means the same reservation record moved from requested to confirmed.
- A country listed as planned is not live local coverage. Limón is in the expansion vision and stays planned.

Do not narrate a simulated upload, a second-local tap, or a ledger write as a real-world field visit or a bank transfer.

## 2. Roadmap lines (P2, keep in presenter notes)

Use these if a viewer asks, or if a control that is not proven appears on camera. Do not leave a misleading active button in the take.

- No satellite or weather anti-spoofing proof. The service runs integrity, freshness, geo-distance, photo-reuse, intra-set diversity, one vision call, and a second local. Show only those. A mocked environmental result is not a live satellite integration.
- No real subscriptions, zone-license checkout, or revenue claim. The tourist `explorer` entitlement and the merchant zone license are fixtures. License status changes described visibility, never a local-verification badge.
- Limón (Costa Rica Caribbean) is planned. Puerto Viejo and San José exist as geography only. A listed city is not live coverage.
- Real commercial inventory, fulfillment, identity-document check-in, and property-management-system integration are outside this recording.

## 3. Ports, sessions, logins

Do not restart or kill the running local services (app 3002, API 3001, landing 3004, admin 3003). Port 3000 belongs to another project. The API is `tsx watch`; do not touch `apps/api/src/index.ts` during a take.

| Surface | URL |
| --- | --- |
| Tourist and Spotter app | `http://localhost:3002` |
| API (codes print here when email is unset) | `http://localhost:3001` |
| Operator admin (optional, not the merchant) | `http://localhost:3003` |
| Landing | `http://localhost:3004` |

Open **four isolated browser profiles** (separate cookie jars). Role cookies on the same origin invalidate each other if you share a profile.

| Session | Profile | Where | Identity | Code |
| --- | --- | --- | --- | --- |
| Tourist | A | app 3002, “I’m here to explore” | `viajero@guaca.live` (showcase tourist) | `SHOWCASE_ACCESS_CODE` from `apps/api/.env` when `SHOWCASE_ACCESS_ENABLED=true`. The gate asks for an access code and does not claim an email was sent. |
| Spotter A (action) | B | app 3002, “I’m a Spotter” | `lucia@scenario.guaca.live` (Lucía Castañeda) | Local non-production roster code. With the dev email sender this is the documented bypass `000000`. Production and presentation footage must not show the hint. |
| Spotter B (witness) | C | app 3002, “I’m a Spotter” | `andres@scenario.guaca.live` (Andrés Pardo) | Same local roster bypass as Spotter A. Keep this profile signed in and off-camera until Beat 6. |
| Merchant | D | app 3002 `/merchant` | `elena@scenario.guaca.live` (Elena Vargas, Casa del Baluarte) | Merchant login is not the admin panel. Do not film `apps/admin` as the venue inbox. Local non-production code is the same roster bypass `000000`. Keep the value off camera. |
| Optional operator | E | admin 3003 | `casarosada@demo.guaca.live` | One-time code printed in the API terminal when `RESEND_API_KEY` is unset. Requires `OPERATOR_TOKEN`. Oversight only. |

Do **not** sign the showcase email into the Spotter gate for this cut. That session is read-only and is not a witness. Do **not** use `rafael@demo.guaca.live` or `yorman@demo.guaca.live` as the scenario actors; those are the Puerto Cabello demo cast, not the Cartagena recording pair.

`NEXT_PUBLIC_PRESENTATION_MODE=true` hides the “code is 000000” hints. Hard-reload every profile after a flag change. Five wrong `SHOWCASE_ACCESS_CODE` attempts lock both showcase roles for 15 minutes.

Set language to **EN** on the join screen (globe control) before the tourist signs in if the take is English. The showcase tourist row is seeded `es`. Switch later from Profile if needed. Spotter language is the same globe control on the Spotter profile.

## 4. Before the take

1. Confirm the four services above are already up. Do not restart them.
2. Seed, additive only (safe to re-run; it does not overwrite user-edited public rows):

   ```sh
   pnpm demo:prepare
   pnpm seed:scenario
   ```

   `demo:prepare` builds backend packages, migrates, then seeds Puerto Cabello, Cartagena, and `viajero@guaca.live`. `seed:scenario` adds the isolated recording fixtures. It refuses to run when `NODE_ENV=production`.
3. Run `pnpm demo:check` (or the queries in §7). Do not proceed if Cartagena stays, Lucía, Andrés, Elena, the pending Marbella observation, or the three catalog items are missing.
4. Confirm `SHOWCASE_ACCESS_ENABLED=true` and that `SHOWCASE_ACCESS_CODE` / `SESSION_SECRET` are set. Confirm `RESEND_API_KEY` is unset if you need operator codes in the API log.
5. Sign the four profiles in **before** rolling, then leave Spotter B and the merchant off-camera. Never type a secret on camera: paste from a covered notes file, or cut away.
6. Scenario clock for the story: **2026-09-12 14:00 America/Bogota**. Availability, the observation, and the ledger already derive from that date. Do not change the machine clock. A pending isolation lane will own a server-side scenario clock; until then, live `now()` still drives mission expiry and hold timers.
7. Freeze the take: no SQL edits mid-recording, no real outbound mail, no real payment credentials.

```sh
pnpm demo:check
DATABASE_URL=postgres://guaca:guaca@localhost:5432/guaca_recording pnpm demo:reset -- --scenario deck-2026-09-12
pnpm demo:rehearse -- --scenario deck-2026-09-12
```

`demo:check` is read-only and may run against the working `guaca` database. Reset and rehearse refuse `guaca`. They use a dedicated `guaca_recording` database and an isolated recording API on `127.0.0.1:3011`. They never truncate places and never rewrite the working Puerto Cabello or Cartagena rows. `demo:rehearse` prepares that isolated database, runs the mission and stay loop twice, then restores the start checkpoint.

## 5. The 10-beat cut (7 to 8 minutes)

Prepared spoken question (Beat 5), English:

> Are the concrete stairs down to the sand at Playa de Marbella open after the latest swell, and does the water look unusually cloudy?

Spanish:

> ¿Las escaleras de concreto hacia la arena en Playa de Marbella están abiertas después del último oleaje, y el agua se ve inusualmente turbia?

That is an access and condition check, not a safety claim.

### Beat 1. Arrival / 0:00–0:30

**Session:** Tourist (profile A).  
**Login:** already in as `viajero@guaca.live`.  
**Deck page:** 1 (Caribbean in real time), 7 (three roles).

On camera:

1. Open `http://localhost:3002`. The join screen shows three actions: explore, Spotter, business handoff, plus EN/ES.
2. If not signed in: “I’m here to explore”, email `viajero@guaca.live`, request a code, enter `SHOWCASE_ACCESS_CODE`. The label is “Enter your access code”.
3. Open the location pill. Colombia is grouped as **planned**. Select **Cartagena**. The map recenters on the walled city. Confirm the pill reads Cartagena, not Puerto Cabello.

Expected: populated Cartagena candidates and photo pins, no `[DEV]` names, no verification checkmarks on public listings.

**Pending build lane:** none for entry itself. The join copy still introduces Puerto Cabello as the starting city; the destination change happens in the picker, which is the honest beat.

### Beat 2. Discover / 0:30–1:15

**Session:** Tourist. **Deck page:** 2.

On camera:

1. Browse the photo map and the discovery list. Public rows read “Listed · unconfirmed”. Locally verified pins (Puerto Cabello cast venues) are not in this city; do not imply Cartagena is locally verified.
2. Open a sourced activity place: **Torre del Reloj**, **Plaza de la Trinidad**, or **Museo del Oro Zenú**. Show the photo (tap for the lightbox), credit, sources, research date, and “Usual transport · approximate” when present.
3. Heart the place. It persists after a reload.
4. Optional: filter the category chips. Stay uses the bed icon.

Expected: one record shared by pin, list row, and profile. Sources visible. No fabricated rating or “open now”.

Film the activities rail on Map (ten seeded cards, at least six in Cartagena). Open a card, then a linked place. Do not invent a scheduled event such as “tonight at the Malecón”.

### Beat 3. Plan / 1:15–2:00

**Session:** Tourist, Plan tab. **Deck page:** 4.

On camera:

1. Open Plan. The showcase account already has two Cartagena trips (seeded, additive):
   - `Un día por la Cartagena amurallada` (`3f9c1a52-7b4d-4e8e-9a2f-5c6d80b41a71`)
   - `Dos días entre la ciudad amurallada y el mar` (`8d2e6b93-c45f-4a17-b8d3-6e9f02a57c82`)
2. Open the one-day wall walk. Inspect stops and local times. Remove or skip one stop if the control is there, without leaving stale narrative text.
3. If you ask Guaca instead, prefer a Culture and Food phrasing grounded in named places. Suggestion chips on this city are still Puerto Cabello-tuned (`Plan my day near the malecón`). A free-typed two-topic sentence can refuse; that refusal is presentable.

Expected: chronological stops, place names that resolve, share control present. Private bookings must not appear on a public share (none exist at start).

Plan has Relax / Adventure / Culture / Food chips plus the seeded Cartagena day. Change an interest, inspect stops, keep private bookings off a public share.

### Beat 4. Find a stay / 2:00–2:45

**Session:** Tourist, Map. **Deck page:** 5.

On camera:

1. Tap the **Stay** category chip (bed icon). Three fictional scenario stays should appear as listed lodging, not as verified pins:
   - Casa Coral Getsemaní (price band 1)
   - Posada del Reloj (price band 2)
   - **Casa del Baluarte** (price band 3, the bookable fixture)
2. Open **Casa del Baluarte**. Show the setting photo (the wall, captioned as setting, not the house), amenities in the fixture profile, getting-there text, and sources. Save it.
3. Say you will request this stay in Beat 8. The stay sheet has nightly price, guests, and **Request a stay**. Do not open a table form.

Expected: lodging taxonomy, distinct bands, public-listing treatment (candidate, witness_count 0). No fabricated availability on a real hotel.

### Beat 5. Missing local information / 2:45–3:15

**Session:** Tourist, Guaca tab. **Deck page:** 2 and 6.

On camera:

1. Ask the prepared Marbella stairs/water question. Guaca should refuse a confident live answer (Cartagena listings are unconfirmed; the observation is a pending local check).
2. Tap **Send a local to check**. Wait until the status is commissioned or already open. The tourist’s question must create the mission Spotter A will see.
3. Do not claim the beach is safe, unsafe, or currently calm.

Expected: an honest limitation, a pending request, and a real `questions` row whose mission the Spotter session can open.

Fallback if the model chats instead of refusing: open Playa de Marbella from the map, use “Tell me about {name}”, then send a local from the refusal. If commissioning returns `no_spotter` or `budget`, stop and reset the scenario; do not pretend.

The place sheet shows observation labels (pending local check, locally confirmed, expired). The seeded row is `SCENARIO_IDS.observation` on Playa de Marbella. Narrate the stored fact, not a safety claim.

### Beat 6. Spotter work / 3:15–4:45

**Sessions:** Spotter A (profile B), then Spotter B (profile C). **Deck pages:** 3, 6, 9.

On camera, Spotter A (`lucia@scenario.guaca.live`):

1. Missions tab. The offered mission is the tourist’s Marbella access check, not a generic beach-safety brief.
2. Accept. Capture uses the real form: location plus three different-angle photos. Use the prepared local fixtures `apps/api/test/fixtures/front.jpg`, `sign.jpg`, `street.jpg` (or the isolation lane’s scenario evidence pack when it lands). Submit.
3. Status must move through the API: accepted → submitted → awaiting second local. Do not linger on a frontend-only success.

On camera, Spotter B (`andres@scenario.guaca.live`):

1. Confirm tab. Confirm only what the second actor can see. Lucía cannot confirm her own submission. Elena cannot confirm as a witness.
2. After confirm, the stored witness count is **two**. Say two. Do not say three to match slide 3.

Inspect supported checks if the evidence viewer is present: integrity, capture freshness, geo distance, reuse, diversity, vision, second local. Do not mark satellite anti-spoofing as passed.

Lucía’s profile reads the reward ledger (450 at the start checkpoint). Ranking uses that same sum. Dispatch prefers Lucía for the Marbella check; if Andrés receives the offer instead, swap the on-camera acceptor and keep the other as witness. Never use the same actor twice. Supported checks are the ones the submit result lists. Do not mark satellite anti-spoofing as passed.

### Beat 7. Rewards / 4:45–5:15

**Session:** Spotter A, Profile tab. **Deck page:** 8.

On camera:

1. Show points, level, rank. Points are points. Do not convert them to currency or narrate a payout.
2. Redeem **Guaca cap** (`guaca-cap`, 200 points) if the sandbox catalog is live. Lucía’s seeded ledger balance is 450, which covers the cap and not the voucher (800). Expect a receipt code, a deducted balance, and no shipment.
3. Insufficient-points state: Andrés starts at 80 and cannot redeem the cap. That is the recovery story if you need it.

The catalog is cap / bottle / voucher. Redeem writes a sandbox receipt and deducts ledger points. `/api/spotter/me`, ranking, and redeem all use `reward_ledger`. Do not narrate a shipment.

### Beat 8. Reserve / 5:15–6:00

**Session:** Tourist. **Deck page:** 5.

On camera:

1. Open Casa del Baluarte. Request a stay: check-in **2026-09-12**, check-out **2026-09-14** (half-open, two nights), guests **2**. Fixture nightly price is 18000 minor units, currency USD, displayed as fixture values, never charged.
2. Unavailable range to avoid: **2026-09-15** and **2026-09-16** (allotment 0). Allotment is 1 room; a concurrent second request for those nights must fail.
3. Submit once. Copy says **Request a stay** and **Awaiting confirmation**, never “Payment successful”. A pending hold lasts **30 minutes** (`hold_expires_at`).
4. The pending reservation appears in Plan with dates, guests, `America/Bogota`, and a reference code.

The showcase tourist may POST `/api/stays/:id/reservations` and `/api/places/:id/observations/request-check`. Do not film the operator admin as a stand-in.

### Beat 9. Merchant / 6:00–6:45

**Session:** Merchant (profile D). **Deck pages:** 7, 10.

On camera:

1. Open `http://localhost:3002/merchant`. Sign in as `elena@scenario.guaca.live`. Workspace sections: Today, Reservations, My place, Visibility. Membership is only Casa del Baluarte.
2. Open the same pending request the tourist just created. Confirm. The record moves requested → confirmed. Inventory stay held. A reference and booking details appear, not a payment success.
3. Glance at the zone license: active, visibility **standard**, label states it is a fixture, not a paid placement. If a row is ever paid, it must read **promoted**. Editing the venue profile does not self-verify the place.

`apps/admin` is operator oversight (`casarosada@demo.guaca.live`) and must not be presented as merchant access.

### Beat 10. Return / 6:45–7:30

**Session:** Tourist. **Deck pages:** 2, 5, 7.

On camera:

1. Reload Map or Updates. The Marbella observation should now read locally confirmed, with stored time and two-witness count, not a hardcoded “12 min ago”.
2. Open the confirmed stay: reference, nights, guests, timezone, contact channel. Use the place **directions** control (lat/lon Google Maps dir URL). Do **not** use the public-profile “View on Google Maps” search link; that helper still suffixes “Puerto Cabello, Venezuela” and would leak the wrong city.
3. Share the Cartagena day from Plan. Open `/t/{shareSlug}` logged out in a fifth window. The public share must omit the reservation and any customer fields.
4. Optional extended cut: switch the picker to Puerto Cabello and show the already-populated waterfront. Then switch back. Clear the Cartagena thread if the chat still shows the other city (the client clears `guaca:thread` when `guaca:thread-area` disagrees).

Reload Plan to show the confirmed stay. Existing pieces you can also film: Updates inbox, lat/lon directions, logged-out trip share, Puerto Cabello switch.

## 6. Scenario manifest

Clock: `SCENARIO_CLOCK` = `2026-09-12T14:00:00-05:00`, timezone `America/Bogota`. Puerto Cabello listings stay on `America/Caracas`.

### People

| Role | Email | Fixture ID | Notes |
| --- | --- | --- | --- |
| Showcase tourist | `viajero@guaca.live` | assigned at seed (tourists.email unique) | Presentation account. Saved Puerto Cabello places plus seven Cartagena favorites. |
| Spotter A | `lucia@scenario.guaca.live` | `00000000-0000-4000-8000-00000000ac01` | Lucía Castañeda, Cartagena, Getsemaní. Ledger 450. |
| Spotter B | `andres@scenario.guaca.live` | `00000000-0000-4000-8000-00000000ac02` | Andrés Pardo, Cartagena, walled city. Ledger 80. |
| Merchant | `elena@scenario.guaca.live` | `00000000-0000-4000-8000-00000000ad01` | Elena Vargas. |
| Membership | owner of Casa del Baluarte | `00000000-0000-4000-8000-00000000ad02` | |
| Zone license | active, visibility standard | `00000000-0000-4000-8000-00000000ad03` | Ends 2026-12-12. Not promoted. |
| Optional operator | `casarosada@demo.guaca.live` | operators row from demo-account seed | Admin only. |

Tourist entitlement: plan_code `explorer`, status `active`, source `scenario_fixture`, same clock window as the license.

### Stays (Cartagena, category `lodging`, verification `candidate`, witness_count 0)

| Name | Place ID | Stay ID | Band | Nightly (minor, USD) | Guests | Allotment | Merchant |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Casa Coral Getsemaní | `...aa01` | `...ab01` | 1 | 4500 | 2 | 2 | no |
| Posada del Reloj | `...aa02` | `...ab02` | 2 | 9000 | 3 | 2 | no |
| Casa del Baluarte | `...aa03` | `...ab03` | 3 | 18000 | 4 | 1 | Elena |

Full UUIDs: prefix `00000000-0000-4000-8000-00000000`. Inventory nights `2026-09-12` .. `2026-09-25` inclusive. Casa del Baluarte allotment is 0 on `2026-09-15` and `2026-09-16`. Recording stay: `[2026-09-12, 2026-09-14)`. Hold TTL in tests: 30 minutes. States: requested → confirmed → completed, with declined / expired / cancelled.

### Observation

| Field | Value |
| --- | --- |
| ID | `00000000-0000-4000-8000-00000000ae01` |
| Place | Playa de Marbella, OSM node `10278478997` |
| Kind | `access` |
| Source | `pending_local_check` |
| Status at start | `active` |
| Observed | scenario clock |
| Valid until | `2026-09-14T23:59:00-05:00` |
| Expiry policy | `place_observations_current` drops rows with `status <> 'active'` or `valid_until <= now()`. Expired facts must not read as current. |

### Rewards

| Item | ID | Slug | Cost | Kind |
| --- | --- | --- | --- | --- |
| Guaca cap | `...af01` | `guaca-cap` | 200 | cap |
| Guaca bottle | `...af02` | `guaca-bottle` | 350 | bottle |
| Local experience voucher | `...af03` | `local-experience-voucher` | 800 | voucher |

Ledger (start checkpoint):

| ID | Spotter | Delta | Reason | At |
| --- | --- | --- | --- | --- |
| `...b101` | Lucía | 150 | completed_local_check | 2026-08-28 |
| `...b102` | Lucía | 180 | completed_photo_mission | 2026-09-02 |
| `...b103` | Lucía | 120 | completed_local_check | 2026-09-08 |
| `...b104` | Andrés | 80 | completed_local_check | 2026-09-05 |

No redemption rows at start. One redemption per catalog item per Spotter (`unique (spotter_id, catalog_id)`).

### Activities (10)

Cartagena (7): `...b001` walled morning, `...b002` Getsemaní, `...b003` Portal de los Dulces, `...b004` Castillo, `...b005` Museo del Oro Zenú, `...b006` Bocagrande, `...b007` wall sunset.

Puerto Cabello (3): `...b008` malecón sunset, `...b009` Fortín Solano, `...b00a` Playa Delfín.

### Areas and tourist trips (reused, not overwritten)

| Record | ID |
| --- | --- |
| Puerto Cabello area | `00000000-0000-4000-8000-00000000000a` |
| Cartagena area | slug `cartagena` (UUID derived from `area:cartagena`; resolve with `select id from areas where slug = 'cartagena'`) |
| Puerto Cabello starter trip | `e23cbabb-80a4-4aa8-85bc-f95594f10c70` |
| Cartagena wall day | `3f9c1a52-7b4d-4e8e-9a2f-5c6d80b41a71` |
| Cartagena two-day | `8d2e6b93-c45f-4a17-b8d3-6e9f02a57c82` |

Cartagena favorites on `viajero@guaca.live` (OSM ids): Puerta del Reloj `955128419`, Castillo `49551791`, Las Murallas `63525986`, Plaza de la Trinidad `5434244523`, Las Bóvedas `887632863`, Bocagrande `25446658`, Celele `9159612217`.

Host QR (optional authentic start, P1): `http://localhost:3002/v/qr-marina` (Posada La Marina, Puerto Cabello). Not the lodging inventory.

Mission IDs and reservation IDs are **created during the take**, not seeded. At the start checkpoint there must be no open scenario mission and no reservation on Casa del Baluarte.

## 7. Seed, check, reset

### Sequence

```sh
pnpm demo:prepare
pnpm seed:scenario
```

Both are additive and idempotent. A second `seed:scenario` inserts 0 new stays, activities, observations, spotters, ledger rows.

Read-only checks (local Docker database; do not write):

```sh
docker exec guaca-app-postgres-1 psql -U guaca -d guaca -tA -c "
select 'stays', count(*) from stays s join places p on p.id = s.place_id
 where s.id in (
   '00000000-0000-4000-8000-00000000ab01',
   '00000000-0000-4000-8000-00000000ab02',
   '00000000-0000-4000-8000-00000000ab03')
union all
select 'activities', count(*) from activities
union all
select 'spotters', count(*) from spotters where id in (
   '00000000-0000-4000-8000-00000000ac01',
   '00000000-0000-4000-8000-00000000ac02')
union all
select 'lucia_pts', coalesce(sum(delta),0)::text from reward_ledger
 where spotter_id = '00000000-0000-4000-8000-00000000ac01'
union all
select 'andres_pts', coalesce(sum(delta),0)::text from reward_ledger
 where spotter_id = '00000000-0000-4000-8000-00000000ac02'
union all
select 'catalog', count(*) from reward_catalog
union all
select 'obs_pending', count(*) from place_observations
 where id = '00000000-0000-4000-8000-00000000ae01'
   and source_kind = 'pending_local_check' and status = 'active'
union all
select 'open_missions', count(*) from missions m
 join spotters s on s.id = m.spotter_id
 where s.email like '%@scenario.guaca.live'
   and m.status in ('offered','accepted','submitted')
union all
select 'reservations', count(*) from reservations
 where stay_id = '00000000-0000-4000-8000-00000000ab03'
union all
select 'redemptions', count(*) from redemptions
 where spotter_id in (
   '00000000-0000-4000-8000-00000000ac01',
   '00000000-0000-4000-8000-00000000ac02');
"
```

Start checkpoint expects: stays 3, activities 10, spotters 2, lucia_pts 450, andres_pts 80, catalog 3, obs_pending 1, open_missions 0, reservations 0, redemptions 0.

Wrong-city check (Cartagena stays must sit in the Cartagena area, never Puerto Cabello):

```sh
docker exec guaca-app-postgres-1 psql -U guaca -d guaca -tA -c "
select p.name, a.slug, p.verification_status, p.witness_count
  from places p join areas a on a.id = p.area_id
 where p.id in (
   '00000000-0000-4000-8000-00000000aa01',
   '00000000-0000-4000-8000-00000000aa02',
   '00000000-0000-4000-8000-00000000aa03');
"
```

Expect slug `cartagena`, status `candidate`, witness_count 0.

Closed inventory nights:

```sh
docker exec guaca-app-postgres-1 psql -U guaca -d guaca -tA -c "
select night_date, allotment from stay_inventory
 where stay_id = '00000000-0000-4000-8000-00000000ab03'
   and night_date in ('2026-09-12','2026-09-15','2026-09-16')
 order by night_date;
"
```

Expect 2 / 0 / 0.

### Reset

```sh
DATABASE_URL=postgres://guaca:guaca@localhost:5432/guaca_recording pnpm demo:reset -- --scenario deck-2026-09-12
pnpm demo:check
```

Reset is destructive, refuses the working `guaca` database, and:

- Refuses production, unknown scenario ids, and anything outside the enumerated fixture IDs in §6.
- Leaves Puerto Cabello and Cartagena public catalogs, photos, and `viajero@guaca.live` favorites/trips untouched.
- Deletes scenario missions, reservations, reservation_nights, redemptions, and leftover observation evidence created during the take.
- Restores the pending Marbella observation, ledger totals 450 / 80, inventory reserved_count 0, no hold.
- Never `truncate` places.

Do not hand-write deletes against the working database. If a rehearsal dirties the scenario, run `demo:reset` with the known scenario id, not a broad reset of `guaca`.

## 8. Fallbacks per beat

### Provider down (Beats 2, 3, 5)

Map, profiles, saves, and the two seeded Cartagena trips work with inference off. Narrate browsing and the stored day. Say planning resumes when the provider is back. Local answers often take 20 to 60 seconds; keep “Checking with the locals” on screen. If a free-typed plan refuses, use a named-place question or open a seeded trip. Do not switch to a fabricated itinerary.

### Upload failure (Beat 6)

Retry is the product. Reasons the UI already knows: too few photos, stale capture, too far from the pin, photo reuse, no diversity, vision unavailable (operator escalation), storage unavailable, mission not open, location denied. Location denied falls back to the pilot centre, which is Puerto Cabello: **stop**, turn location on, and confirm the capture is in Cartagena before submitting. A rejected submission may retry; a needs_second_local result must not be re-run to shop for a better verdict.

### Wrong-city leakage (Beats 1, 2, 10)

How to notice:

- Location pill still says Puerto Cabello.
- Pins include Arepera La Guacamaya, Casa Rosada, or the malecón cast.
- Chat still talks about arepas on the malecón after you switched city (thread was not cleared).
- Public-profile Maps search opens “{name}, Puerto Cabello, Venezuela”.
- Spotter confirm list is empty because the browser geolocation is still the Venezuelan pilot centre.

How to reset: reselect Cartagena in the picker (this clears `guaca:thread` when `guaca:thread-area` differs). Hard-reload the tourist profile. For Spotter B, enable location or (in rehearsal only) confirm near Marbella coordinates, never the Puerto Cabello fallback. Use lat/lon directions, not the hardcoded search link. If public Cartagena rows vanished, re-run `pnpm seed:cartagena` (additive) then `pnpm seed:scenario`. Do not seed a different city on top of the take.

### Booking hold expiry (Beat 8, 9)

A requested stay holds inventory for 30 minutes. If you pause between tourist request and merchant confirm, the hold can expire, inventory releases once, and the tourist sees expired (not confirmed). Recovery: reset the scenario reservation (isolation lane) and request again. Do not confirm an expired row. Duplicate taps must not create a second hold (idempotency key). Last-room overlap on 2026-09-12/13 must fail for a second tourist.

### Wrong language

Join-screen globe sets EN/ES before login. Tourist Profile has EN/ES and PATCHes `/api/tourist/me`. Spotter Profile has the same toggle. If the tourist is still in Spanish, switch on camera (it is a product control) or cut, switch, resume. Suggestion chips differ by language; do not mix a Spanish chip with an English narration. Seeded trip titles are Spanish; that is acceptable in an English take if you say they are the guest’s saved day.

### Showcase lockout / expired session

Five bad access-code tries lock 15 minutes. Wait, or rotate `SHOWCASE_ACCESS_CODE` (this expires existing showcase sessions). A 401 on a Spotter fetch reloads the gate; sign in again off-camera. Codes last 10 minutes and work once, except the local roster bypass.

### Merchant or operator confusion

If you find yourself on port 3003, you are in operator oversight. Stop. The merchant is Elena on `/merchant`. Casa Rosada is not Casa del Baluarte.

### Two-witness and points rules (non-negotiable on camera)

- Display the stored witness count. The gate is two distinct locals.
- Points and money stay separate. Mission `reward_minor` is points in the Spotter UI (`N pts`). Do not read it as cash.
- Public listings never wear a local-verification badge. Promoted placement (none at start; license visibility is `standard`) must say promoted.

## 9. Two consecutive rehearsals (definition of done)

Print this checklist. Both passes start from the §7 checkpoint. No SQL repairs, no provider luck, no manual status edits, no real outbound messages, no payments.

**Pass 1**

- [ ] `pnpm demo:prepare` and `pnpm seed:scenario` (or `pnpm demo:reset -- --scenario deck-2026-09-12`) leave `pnpm demo:check` at the start checkpoint.
- [ ] Four profiles signed in. Language EN (or ES for the Spanish take). Cartagena selected. Presentation mode on.
- [ ] Tourist discovers a sourced place, saves it, opens the wall-day trip, inspects Casa del Baluarte.
- [ ] Prepared Marbella question refuses honestly. Send-local creates **one** mission. Spotter A sees that same mission.
- [ ] Spotter A submit runs the real ladder. Spotter B is the second witness. Tourist sees the updated fact on the same place id. Witness count is two.
- [ ] Lucía’s points move with the completed work. Catalog, ledger, and rank agree. One cap redemption writes one receipt and does not double on retry.
- [ ] Tourist requests `[2026-09-12, 2026-09-14)` for 2 guests. One reservation id. Merchant confirms that id. Tourist sees confirmed. Duplicate tap does not double-book.
- [ ] Logged-out `/t/{slug}` works and hides the booking.
- [ ] Negative paths rehearsed once off-camera: upload failure, location denied, unavailable nights 15–16 Sep, hold expiry, wrong-city pill, EN/ES toggle, expired session.

**Pass 2**

- [ ] Reset to the same checkpoint. Repeat Pass 1 with no leftover mission, hold, or redemption from Pass 1.
- [ ] Reload each role after the critical writes (mission offered, reservation requested, reservation confirmed, observation confirmed) to prove persistence.
- [ ] Phone portrait, one landscape spot-check, desktop map/list, 44px primary actions, keyboard on the stay form. Real-device camera is a separate report.

Automated proof: `pnpm demo:rehearse -- --scenario deck-2026-09-12` must complete two passes and restore the checkpoint. Stop if either pass needs a manual database edit. The product journey is what the camera can repeat.

## 10. What this recording does not prove

It is a product walkthrough of a Caribbean map kept useful by local contributions, with lodging request as an outcome. It is not evidence that a real local walked to Marbella during capture, that a room was paid for, or that Limón has coverage.

Related rehearsal history for the Puerto Cabello-only cut remains in [RECORDING_SCRIPT.md](RECORDING_SCRIPT.md). Do not follow that script’s restaurant-free, Casa Rosada-operator close for this deck take.
