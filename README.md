# GUACA

A live map of local knowledge for the Caribbean, built so that every place on it
was physically visited by a named local.

**Witnessed, not inferred.** The AI never generates a place. It composes,
routes, translates and schedules over human-verified data only — and where no
local has been, it refuses to answer and pays someone to go.

---

## The loop

1. A traveller asks a question, free.
2. If verified places cover it, the planner answers **from those places only**.
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
│   ├── web/            Next.js 15 · landing, map, villa QR view, Spotter PWA
│   └── api/            Fastify + WebSockets · port 3001
├── packages/
│   ├── agents/         gap · verification · planner, plus the grounding guard
│   ├── db/             Postgres + PostGIS · migrations, seed, queries
│   ├── shared/         zod schemas, place taxonomy — the API contract
│   └── cli/            operator override CLI (human in the loop)
├── docker-compose.yml  postgres+postgis · redis · minio
├── PRODUCT.md          durable product truth — read before changing behaviour
└── DESIGN.md           the visual system, recorded from the built result
```

`packages/shared` is the contract between client and server. Do not split it.

## Running it

Requires Node 24+, pnpm 11+, and Docker.

```bash
nvm use && corepack pnpm@11.13.0 install --frozen-lockfile
docker compose up -d          # postgres+postgis, redis, minio
pnpm migrate                  # schema
pnpm seed                     # the pilot area, its zones and Spotters
pnpm dev                      # every workspace in parallel
```

Then:

| Surface | URL | Who it is for |
| --- | --- | --- |
| Landing | `http://localhost:3000` | travellers deciding whether to trust this |
| Map | `http://localhost:3000/map` | travellers asking about where they are |
| Villa QR view | `http://localhost:3000/v/qr-marina` | guests who scanned a property's code |
| Spotter PWA | `http://localhost:3000/spotter` | paid locals running missions (Spanish) |
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

`pnpm seed` creates one area (Puerto Cabello), ten hand-drawn walkable zones,
ten Spotters, and three properties.

**Every one of those Spotters and properties is fictional**, with placeholder
phone numbers. There are no verified places and no Spotter photographs. Only the
area, zone and town names are real geography.

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

## Licence

See `LICENSE`.
