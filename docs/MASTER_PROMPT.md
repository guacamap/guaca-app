# GUACA — Master context prompt

> Paste this entire document into any AI tool (Shogo, Claude, v0, Figma
> Make…), then replace the final **YOUR TASK** line with what you want.
> Everything above the task line is stable project truth as of 2026-08-08.

---

You are working on **GUACA** — read all context below before answering.

## What GUACA is

GUACA is a live map of local knowledge for Caribbean travel. Every place
on the map was physically visited by a named local ("Spotter") whose name
and photo appear on the pin. The AI plans trips ONLY from these
human-verified places — it is structurally incapable of inventing a place.
When coverage doesn't exist it refuses confidently, and that refusal is a
demand signal precise enough to pay a local to resolve it.

**Tagline:** "Witnessed, not inferred." · *guaca* = buried treasure in
Latin American Spanish — hidden local places, surfaced. · Domain:
**guaca.live** ("a live map").

## The problem

AI trip planners confidently recommend restaurants that do not exist (the
market leader generates venues with an LLM; some are documented
fabrications). Google Maps is address-first, which fails across the
Caribbean where worthwhile places have no address — they have a landmark:
"50m past the church, the blue door." Trust in travel AI is broken
exactly where travel is most local.

## The core loop (the product IS this loop)

1. Tourist installs the PWA, creates an account (email one-time code),
   asks anything — free, unlimited.
2. If verified coverage exists → an answer composed only from verified
   places, in the guest's language.
3. If not → a confident refusal + a logged gap: "No one has been there
   yet. 7 people have asked — a Spotter mission opens at 10."
4. The gap agent aggregates demand, weights it by paying properties, and
   commissions ONE paid mission to ONE named Spotter.
5. The Spotter photographs and verifies on-site; a second local confirms.
6. The answer becomes permanent map data, free to every future asker.
   "The AI's own ignorance became a local's paycheck."

## The invariant (never violate, never soften)

**The AI never generates a place.** Mechanism: pure SQL retrieval over
verified rows → catalog assigns integer refs 1..N → the model's output
schema is strict JSON whose only vocabulary is those integers + enums (no
string field can name a place) → a 10-step grounding guard → a database
re-read at render time → the renderer prints names from DB rows only.
10,000 property-tested hostile outputs produced zero unwitnessed places.
Refusal is a first-class product state, never an error.

## Three agents, no more

- **Planner** — intent from a lexicon first; refusal decided from the
  coverage index BEFORE retrieval (zero tokens on the common failure
  path); a deterministic fast path answers ~60% of single-topic "now"
  questions with zero inference; otherwise the model composes with
  integer refs only.
- **Gap agent** — clusters refused questions (area × category × h3),
  scores demand, applies hard gates, picks the zone's Spotter, writes the
  brief in the Spotter's language, pays out idempotently. Missions above
  a reward cap pause for operator approval.
- **Verification** — a cost ladder: L0 integrity → L1 freshness → L2 GPS
  distance (≤75m) → L3 perceptual-hash reuse → L4 photo diversity → L5
  ONE multimodal vision call (all photos in one request) → L6 second
  local confirms → L7 operator escalation. Cheap checks kill bad
  submissions before any paid inference; fusion is deterministic — no
  model in the accept/reject decision.

## Business model

- **Tourists** subscribe $4.99–9.99 at the planning moment, against the
  account created at first QR scan. Asks are free and unlimited.
- **Villas & posadas** are the distribution channel AND the payer — QR
  cards in rooms; no front desk, no F&B revenue to protect; their Airbnb
  rating depends on good local recommendations. Accounts created from a
  villa's QR are attributed to that property.
- **Spotters** are paid per mission in airtime/data top-ups (Reloadly:
  one API across the Caribbean, no bank account needed, reads as a gift
  not a wage). Locals never pay anything.
- Coverage is funded once per area and resold to every property and
  tourist in it.
- **Pilot:** Puerto Cabello, Venezuela — 10–20 hand-picked Spotters, 2–3
  villas, 30–50 verified places. Expansion: Colombia, Costa Rica.

## Hard product rules

- Reports describe **places and conditions, never people**.
- **Refusal is a hero state** — confident, warm, with the demand counter.
- **Landmark-first**; addresses are secondary and de-emphasised.
- **Territory identity**: one named Spotter per zone; their face and name
  on every pin they verified. This is the status system.
- **No gamification** — no points, badges, leaderboards (rejected with
  evidence). **No open Spotter signup** — operators issue accounts;
  curation is the product. **No crypto** — no token, no chain.
- Also rejected, never re-propose: tourist-funded per-question bounties,
  winner-takes-all payouts, consumer trip planner as the business, tour
  marketplace.

## Users & surfaces (one app, role chooser at first launch)

**Tourist** (guest language, weak villa wifi):
villa QR landing → email-code account → full-bleed map with category
chips + Spotter-avatar pins → ask (answer cards or refusal hero) → place
sheet (photos, landmark line LARGE, Spotter identity block, fresh
conditions) → routed day plan as a timeline.

**Spotter** (Spanish-first, mid-range Android, cellular):
phone + operator-issued code login → usually ONE active mission card
(what, where-ish, reward as top-up, expiry) → arrive (GPS ≤75m) →
photograph (3+ angles, camera-only) → type the name as the sign shows →
condition chips → submission status as human steps ("photos received →
checks passed → another local confirms → LIVE", celebrate LIVE — their
name goes on the pin) → earnings list.

**Operator** — a CLI (`guaca queue/verify/gaps/missions/tail`) + live ops
stream; human oversight of every consequential agent decision.

## Look & feel

Sea-glass paper `#F7FAF8`, deep sea ink `#17272B`, reef teal `#0D7A72`,
mango `#D97E00` for refusal counters and rewards. Sunlit, unhurried,
trustworthy; photography does the talking; humanist sans, big friendly
numerals for counters and codes. Mobile-first, thumb-reach, 360×800
baseline, designed loading states for slow images. Avoid: purple-blue
gradient heroes, glassmorphism, palm-tree clichés, dashboard density,
anything that reads "crypto app". Bilingual ES/EN everywhere.

## Architecture & stack (decided, with reasons — do not relitigate)

- **Monorepo** (pnpm, Node 22, TypeScript everywhere): `apps/web`
  (Next.js 15 + React 19 installable PWA — role chooser, Mapbox GL JS),
  `apps/api` (Fastify 5, REST + WebSockets, client-agnostic — never Next
  server actions), `packages/shared` (zod schemas = THE contract),
  `packages/db` (Postgres 16 + PostGIS 3.4, raw SQL, no ORM),
  `packages/agents` (plain-TS graph runner with interrupt()/resume — no
  framework), `packages/cli`.
- **Auth**: hand-rolled jose JWTs. Spotter: phone + operator code.
  Tourist: email one-time code. Cookie on web + `Authorization: Bearer`
  (future React Native app needs no server change).
- **Inference**: vLLM + Qwen3-VL-8B on one Nebius L40S (right-sized;
  ~2.9× cheaper than an H200 the model can't fill), MiniMax-M3 fallback
  behind one env var, FakeInference in tests. Compute efficiency is part
  of the pitch.
- **Storage**: MinIO (photos stay in-territory), Redis currently
  provisioned but unwired (Postgres does queues/checkpoints; open
  decision leans "drop Redis").
- **Domains/tiers**: `app.guaca.live` (prod web, Vercel) ·
  `api.guaca.live` (VM, Docker Compose + Caddy) · `staging.app.` /
  `staging.api.` (staging tier) · local via docker compose. Trunk-based:
  `main` = staging, fast-forward `production` to ship.
- **Mobile**: installable PWA now (store listings physically impossible
  before judging); Expo React Native app post-hackathon in the same
  monorepo (`@rnmapbox/maps`, same API, same contract).

## Compliance stances

A tourist account holds an email and a language — nothing else; questions
are detachable from identity on erasure. Spotters appear by explicit
consent with right to erasure. Photos are minimised to what verification
needs. Reports never describe people. Caribbean data sovereignty is
first-class. Honest limitation stated plainly: browser capture has no
EXIF, so geolocation is client-attested and corroborated (pHash, vision,
second local). Human oversight on every consequential state change.
Apache-2.0.

## The demo (Aug 16–17, Future Caribbean Buildathon)

Live on stage: scan a villa QR → create an account in ~15s → ask a
covered question (answer with a named Spotter's face) → ask an uncovered
one (confident refusal, demand counter) → the gap agent commissions a
mission on-screen → a teammate walks to a real place and submits → the
same question answers minutes later, shown on the loop-events timeline
with wall-clock deltas. Judges are invited to attack the AI with their
own prompts. Never fake a live moment; recorded fallbacks are labelled
"recorded".

## Current status (2026-08-08)

Built: agents (planner fast path, guard, verification ladder, gap agent),
DB layer, API + ops stream, CLI, tourist map + spotter PWA skeletons,
deploy configs. In progress: Mapbox swap, tourist accounts + role
chooser, domain/tier wiring. Open: Redis (drop vs wire), email provider
(Resend recommended). Deadline: submission Aug 17, midnight AST.

---

**YOUR TASK:** {replace this — e.g. "Design the tourist map home, ask
flow, and refusal state as mobile screens" · "Write the 3-minute pitch
narration" · "Critique the onboarding flow" · "Generate the place-sheet
component"}. Honor every rule above — especially: refusal is a hero
state, never invent a place even in sample data (use the pilot's real
shape: malecón food stands, Playa Quizandal, Isla Larga boat rides), no
gamification, Spanish-first for Spotter surfaces.
