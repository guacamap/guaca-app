# Isolated recording setup

The local recording uses the real app routes and database transitions with fictional scenario actors. It does not contact businesses or collect payments. Keep it separate from the deployed app and the working `guaca` database.

## Current local instance

- App: http://localhost:3012/map?area=cartagena
- Merchant: http://localhost:3012/merchant
- Spotter: http://localhost:3012/spotter
- API: 127.0.0.1:3011
- Database: `guaca_recording_codex_20260906`

The API and app must remain running. Their launch commands, from the repository root, are:

```sh
DATABASE_URL=postgres://guaca:guaca@localhost:5432/guaca_recording_codex_20260906 RECORDING_AI_ENABLED=true pnpm --filter @guaca/api recording
```

In another terminal:

```sh
pnpm --filter @guaca/app recording:build
pnpm --filter @guaca/app recording:start
```

The recording build uses its own `.next-recording-build` directory and proxies API requests to port 3011. An explicitly configured `API_PROXY_TARGET` overrides that default; do not point it at a working or deployed API.

Local email sign-in uses `000000`. Tourist: `viajero@guaca.live`; merchant: `elena@scenario.guaca.live`. This is the isolated development email transport, not the deployed access code.

Spotter also accepts `viajero@guaca.live` with `000000`, displaying Alejandro Ríos and the same portrait. The recording server idempotently registers this separate Puerto Cabello Spotter account at startup, only after checking the isolated database name. Tourist and Spotter sessions/permissions stay separate; Lucía and Andrés remain available for the Cartagena two-witness scenario. Existing balances and mission history are not overwritten by startup.

On the recording Spotter map only (`GET /api/recording/runtime` 200), Guaca sits in the same top bar as the tourist ask. It briefs hours, access, evidence and second-local work from the live mission list. It does not plan a tourist day. If the model is down, a grounded fallback still names Casa Rosada breakfast, witness pins, and nearby checks. The ordinary app on :3002 does not show this bar.

Puerto Cabello Spotter map (start checkpoint after `seed:scenario` / `demo:reset`):

- 4 available missions (clock / camera / beach / access icons): Casa Rosada breakfast hours, Casa Rosada entrance, Playa Delfín access, Fortín Solano access.
- 1 accepted mission already on Alejandro: Picua hours.
- 2 awaiting a second local, owned by Yorman and Rafael so Alejandro cannot confirm his own work: Blue Marine entrance, La Cueva del Mar hours.
- 3 completed checks on Alejandro’s ledger (360 pts): Catedral, Teatro Municipal, Iglesia del Rosario, each with a photo and timestamp.
- 4 unverified public listings without a mission: Castillo San Felipe, Monumento a Bolívar, Da Franco, Plaza Flores.

Filters on the map: Available, My missions, Needs a witness, Completed. Pins use those icons plus a status label, not colour alone. Open a pin for reward, task, and the next action.

Connected take: tourist asks about breakfast in Puerto Cabello → send someone attaches to Alejandro’s Casa Rosada breakfast mission → he accepts and submits evidence → a second Spotter confirms → the tourist sees the update and points land on the ledger. A second mission on the same stay photographs the street entrance and reception.

The recording tourist is presented as fictional traveller Alejandro Ríos, from Valencia, with a bilingual travel bio and a generated portrait at `apps/app/public/demo/people/alejandro-rios.png`. The profile is supplied only by the recording server for this email; ordinary API instances and other accounts retain their own identity. Portrait provenance and the generation prompt are in `apps/app/public/demo/people/ATTRIBUTION.md`.

Chat refinement: ordinary place questions now return suggestions rather than arbitrary timed itineraries. Combined food/beach requests retain both categories; breakfast menus, hours and current beach conditions are not invented. Explicit itinerary requests retain the planner. The exact English beach-and-breakfast request passed through the live model and browser. Profile portrait loading and layout passed at 390px and 1440px. Agent suite: 239 tests passed; ask/profile integration: 7 tests passed. Impeccable clarification guidance informed the response hierarchy while preserving grounded place names and verification tiers.

`RECORDING_AI_ENABLED=true` enables organic text responses through the existing model provider. Only text `INFERENCE_*` configuration is read from `apps/api/.env` (explicit environment values take precedence); the working database URL and other service credentials are not imported. Prompts and relevant recording context are sent to that provider and may incur normal model usage charges. Retrieval and AI call logs use only the isolated recording database. Vision remains disabled. Omit the flag for offline-inference rehearsals. Restarting the API invalidates login sessions; sign in again with the local code.

## Prepare a fresh instance

Create a new Postgres database with PostGIS support, named `guaca_recording` or `guaca_recording_<lowercase_suffix>`. Set `DATABASE_URL` to that database in each terminal, then run:

```sh
pnpm demo:prepare
pnpm --filter @guaca/db seed:scenario
pnpm demo:check
```

Preparation writes data: verify the database target first. The recording server and reset operation refuse non-recording database names. The seed preparation itself is not a production safety boundary.

## Repeat the take

With the isolated API running and `DATABASE_URL` set to its database:

```sh
pnpm demo:reset --scenario deck-2026-09-12
pnpm demo:check
GUACA_API_URL=http://127.0.0.1:3011 pnpm demo:rehearse --scenario deck-2026-09-12
```

Reset removes scenario transactions and restores the starting balances and pending observation. It is intentionally destructive within the disposable scenario. Do not store valuable work in this database.

Booking take: open Cartagena → Stays → Casa del Baluarte → request September 12–14, 2026. In a separate browser profile, sign in as Elena → Reservations → Confirm stay. The tourist confirmation updates automatically, with the same reservation reference.

## Verified September 6, 2026

- Two API rehearsal passes: tourist observation request, Spotter evidence, second witness, observation state update, lodging request/merchant confirmation, reward redemption; checkpoint restored afterward.
- Mobile Chromium, 390×844: tourist booking → merchant inbox → confirmation → tourist polling. Passed against both the development UI and the production recording build, the latter through its actual API rewrite (no browser request interception).
- No page errors or horizontal document overflow in that booking journey. Merchant name and nested reservation response handling were corrected during rehearsal.
- Production recording build and focused database/runtime guard tests passed.

## Remaining boundaries

Text inference is opt-in; vision, external context, email delivery, background dispatch, and external object storage remain disabled. Uploads are memory-only and disappear on restart. Organic chat depends on provider availability and is not a deterministic replay; the booking success is not evidence that the entire deck is operational. The Spotter lifecycle was exercised through API calls, not an on-device camera journey. Real mobile devices, deployed hosting, real-world verification, and payments were not tested.

Impeccable hardening guided the merchant response-adapter fix. The detector's inherited metadata-size warnings reflect the older DESIGN.md ramp, not newly introduced styling. They remain unsuppressed and unchanged in this functional patch; this is not a full accessibility audit.
