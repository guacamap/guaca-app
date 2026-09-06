# GUACA

A live map of local knowledge for the Caribbean, starting in Puerto Cabello.

**Witnessed, not inferred.** The AI never generates a place. It plans from a
grounded catalog with explicit confidence tiers: locally verified, corroborated
by independent open datasets, or publicly listed and unconfirmed. Public listings
are not local verifications. See the [tiered-honesty spec](docs/superpowers/specs/2026-09-02-tiered-honesty-design.md).

For the live demo, use the [Puerto Cabello demo guide](docs/PUERTO_CABELLO_DEMO.md).
It includes repeatable data preparation, profile sources, and a short walkthrough.

---

## The loop

1. A traveller asks a question, free.
2. If the catalog covers it, the planner answers **from those places only**, stating each place's tier.
3. If they do not, the system **refuses** and records the coverage gap.
4. The gap agent aggregates demand across gaps and commissions exactly one paid
   mission to one Spotter.
5. The Spotter goes, pins, photographs and verifies. They get paid.
6. The answer becomes permanent, free map data.

The refusal is the product, not a limitation to be hidden. It is the only reason
the map can be trusted, and it is what turns the system's own ignorance into a
local's paycheck.

## Layout

```
.
├── apps/
│   ├── web/            Next.js 15 · marketing landing + legal pages (guaca.live)
│   ├── app/            Next.js 15 PWA · map, trips, villa QR, Spotter (app.guaca.live)
│   ├── mobile/         Expo WebView wrapper → Play closed testing
│   ├── admin/          Next.js admin panel (admin.guaca.live) — token-gated
│   └── api/            Fastify + WebSockets · port 3001
├── packages/
│   ├── agents/         gap · verification · planner · trends, plus the grounding guard
│   ├── db/             Postgres + PostGIS · migrations, seed, queries
│   ├── shared/         zod schemas, place taxonomy, trip contract
│   ├── ui/             shared map + brand components (Mapbox GL)
│   └── cli/            operator override CLI (human in the loop)
├── docker-compose.yml  postgres+postgis · minio
├── PRODUCT.md          durable product truth — read before changing behaviour
└── DESIGN.md           the visual system, recorded from the built result
```

`packages/shared` is the contract between client and server. Do not split it.

## Running it

Requires Node 24+, pnpm 11+, and Docker.

```bash
pnpm install
docker compose up -d          # postgres+postgis, minio
pnpm demo:prepare             # build backend packages, migrate, seed public Puerto Cabello profiles
pnpm dev                      # every workspace in parallel
```

Then:

| Surface | URL | Who it is for |
| --- | --- | --- |
| Landing | `http://localhost:3000` | travellers deciding whether to trust this |
| Map | `http://localhost:3002/map` | travellers asking about where they are |
| Villa QR view | `http://localhost:3002/v/qr-marina` | requires optional fictional villa seed |
| Spotter PWA | `http://localhost:3002/spotter` | paid locals running missions (Spanish) |
| Admin | `http://localhost:3003` | token-gated operations |
| API | `http://localhost:3001` | — |

The map asks the browser for your location and centres there. Outside covered
ground it says so plainly and offers a way to the area where coverage has
started; if you decline the permission it falls back to that area.

### Environment

The API reads:

```
DATABASE_URL          postgres://guaca:guaca@localhost:5432/guaca
SESSION_SECRET        any non-empty string in development
WEB_ORIGIN            http://localhost:3000
API_PORT              3001
```

The web app reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001`).

Inference is provider-agnostic behind an OpenAI-compatible `INFERENCE_BASE_URL`,
with `INFERENCE_API_KEY` and `INFERENCE_MODEL`. Never expose credentials under
`ANTHROPIC_*` names. The gap agent is tuned with `GAP_AGENT_ENABLED`,
`GAP_AGENT_DRY_RUN`, `GAP_AGENT_INTERVAL_MS`, `GAP_AGENT_MIN_SCORE`,
`GAP_AGENT_MAX_MISSIONS_PER_DAY` and `GAP_AGENT_MAX_REWARD_MINOR`.

## Tests

```bash
pnpm test              # everything
pnpm test:unit         # no services required
pnpm test:integration  # needs docker compose up
```

## What the seed contains, and what it does not

`pnpm seed` creates reference geography only. `pnpm seed:puerto-cabello` also
imports the bundled OpenStreetMap snapshot and enriches eight real public place
profiles in English and Spanish. It creates no people, reviews, or verifications.
It can be rerun without duplicating places or inflating independent-source counts.

The optional `pnpm --filter @guaca/db seed --demo` adds ten fictional Spotters and
three fictional properties with placeholder phone numbers. They are simulation
fixtures, not evidence of coverage. Existing records are preserved by demo preparation.

Nothing in this repository may present seeded records as real. No named person,
no partner name, no verification date, and no count of verified places belongs
on a public surface until a Spotter has actually filed one. `PRODUCT.md` holds
the full list of what must not be invented.

## Rules that are not up for negotiation

- **The AI never generates a place.** Enforced in code by the grounding guard in
  `packages/agents/src/guard/`.
- **Reports describe places and conditions, never people.**
- **Money flows only through the `PayoutProvider` seam.** `MockPayoutProvider`
  is the only wired implementation; `ReloadlyPayoutProvider` is a documented
  skeleton that throws if called.
- **No token and no chain.**
- **Travellers pay nothing and install nothing.** They arrive by QR at a
  property; any friction added between the scan and an answer is a regression.

## Documentation

- **`PRODUCT.md`** — users, purpose, positioning, capabilities, constraints, and
  the evidence prohibitions. Read it before changing what the product claims.
- **`DESIGN.md`** — the visual system as built: palette, type, components, and
  the rules that govern them.
- **`docs/PLAYBOOK_HUMAN.md`** — running it after deploy: rhythms, the
  Spotter lifecycle, money, moderation, incidents.

## Licence

See `LICENSE`.
