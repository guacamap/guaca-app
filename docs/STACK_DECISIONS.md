# GUACA — Stack decisions

Why each layer was chosen, what else exists, and when an alternative would
win. Status: **settled** (do not relitigate without new facts) ·
**decided 2026-08-08** (this session) · **OPEN** (decision pending).

| # | Layer | Choice | Status |
|---|---|---|---|
| 1 | Web framework | Next.js 15 + React 19 | settled |
| 2 | Map | Mapbox GL JS | decided 2026-08-08 |
| 3 | API | Fastify 5 | settled |
| 4 | Language & workspace | TypeScript · Node 22 · pnpm | settled |
| 5 | Contract | zod + `packages/shared` | settled |
| 6 | Database | Postgres 16 + PostGIS 3.4, raw SQL | settled |
| 7 | Queues & checkpoints | Postgres tables (Redis unwired) | **OPEN** |
| 8 | Object storage | MinIO | settled |
| 9 | Inference | vLLM + Qwen3-VL-8B on L40S | settled |
| 10 | Agent orchestration | plain-TS graph runner | settled |
| 11 | Auth | hand-rolled jose JWT + one-time codes | settled |
| 12 | Email delivery | Resend vs SMTP | **OPEN** |
| 13 | Testing | vitest + fast-check + FakeInference | settled |
| 14 | Operator CLI | commander | settled |
| 15 | Deploy | Vercel (web) · VM + Compose + Caddy (api) | settled |
| 16 | Payouts | Reloadly behind `PayoutProvider` | settled (mock) |

---

## 1. Web framework — Next.js 15 + React 19

**Why**

- One app, three surfaces: route groups `(tourist)` / `(spotter)` /
  `/v/[qrToken]` share components and the `@guaca/shared` contract.
- SSR paints the villa QR landing fast on mid-range Androids over weak
  villa wifi — the first thing a judge's phone sees.
- React is the transfer path to the post-hackathon Expo app; Expo Router
  mirrors the App Router mental model.
- Used as **frontend only** — the API deliberately does not live in Next
  (no server actions, no route-handler API), which is what made tourist
  accounts and the RN plan cheap.
- *2026-08-12:* the landing-page PR arrived as a Vite SPA (Shogo export
  default, not an argued choice); ported back into Next 15 same day —
  §1 reaffirmed. The experience currently mounts client-only
  (`src/app/page.tsx`); route-level splitting lands with the §4.1 build.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| SvelteKit | Smaller bundles, less boilerplate | No React Native path; smaller ecosystem for a deadline. Wins on a web-only product. |
| React Router 7 (Remix) | Same React, leaner framework | No advantage here; weaker codegen/tooling affinity. |
| Vite SPA | Simplest mental model | Loses SSR first-paint on the QR landing and file routing for three surfaces. |
| Astro | Content-site performance | Wrong shape — GUACA is an app, not a content site. |

## 2. Map — Mapbox GL JS *(decided 2026-08-08)*

**Why**

- Replaced MapLibre + raw `tile.openstreetmap.org` raster — which the OSM
  tile-usage policy disallows in production and which looked flat on stage.
- One vendor across web and future RN (`@rnmapbox/maps`), same styles both
  platforms.
- Free tier (50k web loads/mo) is ~2 orders of magnitude above pilot
  traffic; Static Images covers villa QR print cards later.
- Token strategy in plan §4.2: `guaca-dev` unrestricted local-only;
  `guaca-web-prod` URL-restricted to `app.guaca.live` + staging.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| MapLibre + MapTiler/OpenFreeMap | Open source, no vendor terms | Needs a separate tile provider anyway. Wins if Mapbox pricing ever bites — the GL APIs are siblings, so the swap stays thin. |
| Google Maps SDK | Best global POI data | POI data is *our* product; address-first UX is the thesis we argue against; costlier per load. |
| Leaflet | Simplicity | Raster-era, no vector styling; dated on stage. |

## 3. API — Fastify 5

**Why**

- A client-agnostic REST + WebSocket surface serving web, CLI, and the
  future RN app identically — the single decision that kept every later
  pivot cheap.
- First-class WebSockets (`@fastify/websocket`) power the live ops stream
  (`guaca tail`) — a rubric-relevant demo surface.
- Fast, small, schema-validation-friendly; agents run in-process next to
  Postgres on the same VM.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| Next API routes / server actions | One deploy | Couples API to the web app; Vercel functions can't hold WebSockets or long agent runs; breaks CLI/RN symmetry. |
| Express | Familiarity | Slower, weaker TS/schema story, legacy middleware model. |
| Hono | Edge-portable, tiny | Wins if the API ever moves to workers/edge; WS + long-lived processes fit the VM better today. |
| NestJS | Structure for big teams | Ceremony for a two-person team. |
| tRPC | End-to-end types, no codegen | REST is needed anyway (CLI, curl, judges); the zod contract already provides the types. |

## 4. Language & workspace — TypeScript · Node 22 · pnpm

**Why**

- One language everywhere means the zod contract is compile-checked from
  DB row to UI prop — the guard's structural claim depends on this.
- Node 22: boring, current, no runtime surprises mid-hackathon.
- pnpm workspaces: strict resolution catches phantom deps monorepos breed;
  `workspace:*` links the contract atomically.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| Bun | Speed, built-in TS | Ecosystem edge cases are a risk with no payoff at this scale. Revisit for the API post-pilot if CPU-bound. |
| Deno | Security model | Ecosystem friction for zero product gain. |
| Go/Rust API | Performance ceiling | Splits the language, killing the shared-contract property the guard leans on. |

## 5. Contract — zod + `packages/shared`

**Why**

- Schemas, taxonomy, and log-line types in one workspace package — THE
  contract every app imports.
- The planner's `.strict()` output schema with **no free string field** is
  the anti-hallucination mechanism itself — structural, not prompt-based.
- Runtime validation at the API boundary and on DB row parse; types
  inferred with zero codegen.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| TypeBox | Faster validation, JSON-Schema-native (Fastify synergy) | zod's ecosystem + fast-check integration won. Revisit only if validation shows up in profiles. |
| valibot | Smaller client bundle | Not the bottleneck. |
| OpenAPI/protobuf codegen | Multi-language teams | A codegen step slows a two-person loop for nothing. |

## 6. Database — Postgres 16 + PostGIS 3.4, raw SQL, no ORM

**Why**

- `geography` types, `ST_Distance`, and h3 cluster keys are load-bearing:
  the L2 geo check and gap clustering are SQL, not app code.
- Recorded decision (§4 table): ORMs create real friction with PostGIS
  types; raw migrations + typed query functions + zod row parsers are
  boring and predictable for an agent executor working fast.
- One database holds places, missions, and `loop_events` — the auditable
  timeline the demo stands on.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| Drizzle | Typed SQL DX | PostGIS support is still custom-type territory. Revisit when schema churn slows — and wrap, don't replace. |
| Prisma | Polished DX | `geography` effectively unsupported; engine weight. |
| Supabase | Managed PG + auth + storage in one | Data sovereignty, compose-local dev, and our auth is ~50 lines. Viable later as *hosting* for plain Postgres. |
| SQLite + SpatiaLite | Single-file simplicity | Concurrent writers and the prod story end it. |

## 7. Queues & checkpoints — Postgres tables · Redis provisioned but unwired — **OPEN**

**Current truth (verified 2026-08-08):** `docker-compose.yml` runs
`redis:7-alpine`, but **no package depends on a Redis client** — the loop
thread, operator queue, and missions are all Postgres tables.

**Why Postgres-first is right**

- Checkpoints must be durable and auditable (interrupt/resume, idempotency
  keys) — that is DB-row work, not cache work.
- `SKIP LOCKED` queues are ample at pilot scale; one fewer moving part.

**The open decision (make at §4.1 implementation):** account rate limits +
email-code throttling need a counter. Either (a) finally wire Redis
(`INCR`/`EX` is its natural job), or (b) a PG counter table / in-memory
counter — legitimate while there is exactly one API instance — and
**remove Redis from compose**. Recommendation: **(b)** — an honest
fewer-moving-parts story; re-add Redis the day a second API instance
exists.

## 8. Object storage — MinIO

**Why**

- S3-compatible inside compose: photos stay in-territory — Caribbean data
  sovereignty is a stated compliance line, not a nicety.
- Zero egress cost; same API as any S3, so migration is env vars.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| Cloudflare R2 | Managed, zero egress | Wins when VM disk/durability becomes a burden — S3-compatible, config-only migration. |
| AWS S3 | The default | Egress cost + jurisdiction. |
| Vercel Blob | Zero setup | Couples storage to the web platform; photos belong to the API side. |
| Postgres `bytea` | One store | Bloats backups; PG is not a CDN. |

## 9. Inference — vLLM + Qwen3-VL-8B on Nebius L40S · MiniMax-M3 fallback

**Why**

- One 8B multimodal model covers both jobs: schema-only JSON planning
  (integer refs) and the single-call L5 vision verification.
- Self-hosted vLLM: flat cost, data stays in-region, xgrammar guided
  decoding.
- L40S is right-sized — the 8B model cannot fill an H200's 141 GB, and the
  L40S is ~2.9× cheaper. Compute efficiency is a scored criterion; this
  choice is part of the pitch.
- `INFERENCE_BASE_URL` makes the provider swappable in one env var; the
  guard does **not** depend on provider capability — constrained decoding
  is an optimisation, `assertGrounded` is the guarantee. `FakeInference`
  keeps CI deterministic and free.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| Frontier APIs (Claude/GPT/Gemini) | Reasoning quality | The planner's output vocabulary is integers — quality headroom is wasted; per-token cost, data leaves region. The MiniMax slot proves any OpenAI-compatible API can A/B in later. |
| Other open VLMs (Pixtral, InternVL, Llama vision) | Maybe better vision-per-GB | Qwen3-VL-8B won the spike; revisit quarterly — the swap is a model name. |
| Serverless GPU (Modal/Replicate) | Scale-to-zero economics | Cold starts vs a live demo. Genuinely reconsider post-demo when idle hours dominate the bill. |

## 10. Agent orchestration — plain-TS graph runner *(no framework)*

**Current truth (verified 2026-08-08):** `packages/agents` has **no
LangGraph dependency** — deps are `sharp`, `sharp-phash`, `zod`, and the
shared contract. The `runtime/` runner implements `interrupt()`/resume;
resume re-runs only the interrupting node (vision is paid exactly once);
writes past interrupts are idempotency-keyed.

**Why**

- The plan's spike-first rule did its job: the needed semantics are a few
  hundred lines; a framework's surface area wasn't earning its keep.
- HITL interrupts (second local, operator queue, reward cap) map to
  DB-checkpointed nodes; debugging is a stack trace, not a graph
  inspector.
- dependency-cruiser enforces the architecture (`render ↛ inference`) as a
  build failure.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| LangGraph.js | Checkpointing + studio tooling | Opaque state, moving versions. Reconsider if graphs become many-node and dynamic. |
| Mastra / AI SDK agents | Batteries included | Model-coupled abstractions; `INFERENCE_BASE_URL` already does the decoupling. |
| XState | Mature statechart semantics | Viable — but the hand-rolled runner *is* a tiny statechart without the mental-model tax. |

## 11. Auth — hand-rolled jose JWT + one-time codes

**Why**

- Both flows are odd on purpose: spotter codes are **operator-issued**
  (curation is the product — self-signup was rejected with evidence), and
  tourist auth is an email one-time code (§4.1). No vendor models these
  cheaply.
- `jose` does signing/verify only; the whole surface is ~50 lines,
  DI-tested (`SpotterAuthDb` interface).
- Cookie (web) + `Authorization: Bearer` (RN, servers) through one verify
  hook. No OAuth apps to configure before Aug 16.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| Clerk / Auth0 | Social login in an hour | Vendor, cost, data residency — and still wouldn't model operator-issued codes. Wins the day social login is demanded. |
| Auth.js | Free, self-hosted | OAuth-shaped; fights custom code flows. |
| Supabase Auth | Bundled with PG | Couples auth to their hosting. |

## 12. Email delivery — **OPEN** (Resend vs SMTP)

The one §4.1 dependency still undecided. Dev + staging print the code to
the ops stream; prod needs a real sender.

| Option | What it buys | Cost |
|---|---|---|
| **Resend (recommended)** | Best DX, good deliverability, 3k emails/mo free | free tier covers pilot |
| Postmark | Gold-standard transactional deliverability | ~$15/mo |
| AWS SES | Cheapest at scale | setup ceremony + reputation warm-up |
| Raw SMTP relay | Most portable | deliverability is on you |

Behind a ~20-line `EmailSender` interface this is a non-decision — pick
Resend, swap freely later.

## 13. Testing — vitest + fast-check + FakeInference + dependency-cruiser

**Why**

- vitest: ESM-native TS, fast, unit/integration split per package, CI runs
  against a postgis service container.
- fast-check property tests are the guard's *evidence*: 10 000 hostile
  outputs, zero unwitnessed places — the claim quoted on stage.
- `FakeInference` keeps CI deterministic, free, offline.
- dependency-cruiser turns architecture violations into build failures,
  not review comments.

**Alternatives:** Jest (ESM pain, slower, no gain) · `node:test` (no
watch/coverage ecosystem) · Playwright e2e — genuinely worth **adding**
post-hackathon for the three client flows; skipped now for time only.

## 14. Operator CLI — commander

The operator surface (`queue` / `verify` / `gaps` / `missions` / `tail`)
is a rubric criterion (human oversight). `commander` is boring and
complete; the CLI speaks to Postgres through `@guaca/db` and to the live
ops stream over the operator WebSocket. Alternatives (oclif, yargs, ink)
add framework or polish where none is needed — a non-decision.

## 15. Deploy — Vercel (web) · VM + Compose + Caddy (api)

**Why the split is deliberate**

- Vercel: previews power the §4.3 tier cycle (branch → staging domain),
  zero-config Next, judges' phones hit edge CDN.
- VM: WebSockets + long-running agent processes + compose-colocated
  Postgres/MinIO + data sovereignty. Caddy gives auto-TLS vhosts in two
  lines (`api.` + `staging.api.` on `guaca.live`).
- Stateless edge for the web, one stateful box for everything else.

**Alternatives**

| Option | What it buys | Why it lost — and when it wins |
|---|---|---|
| All-Vercel | One platform | Functions can't hold WebSockets or agent loops. |
| Fly / Railway / Render | Managed containers | Another vendor + sovereignty questions vs one cheap VM. Wins when VM ops burden outweighs ~$20/mo. |
| Kubernetes | — | No. |
| nginx / traefik | Familiarity / dynamic config | Caddy's auto-TLS wins at this size. |

## 16. Payouts — Reloadly behind `PayoutProvider` *(mock now)*

Airtime/data top-ups: no bank account needed, one API across the
Caribbean, reads as a gift rather than a wage (not money transmission).
The interface-first design means the demo runs `MockPayoutProvider` and no
financial compliance surface exists until pilot money is real.
Alternatives — cash/manual (pilot-viable), per-country mobile money
(fragmented), crypto (**rejected by product rule**: no token, no chain).

---

*Cross-references: plan §4 + §4.1–4.3 (`docs/plans/2026-08-05-guaca-mvp.md`),
ARCHITECTURE.md, DEPLOY.md, DATA_SOURCES.md. Verified against
`package.json` dependency reality on 2026-08-08.*
