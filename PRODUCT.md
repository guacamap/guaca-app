# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user of the landing surface: the traveler.** An international visitor
staying in a Caribbean vacation rental (villa or posada), in an unfamiliar area,
deciding what to do today or tomorrow. They usually arrive by scanning a QR code
at the property rather than by browsing to the site, they are frequently not
Spanish speakers, and they are on a phone on an uneven connection. Their job is
to get a trustworthy answer about a real nearby place — not to browse listings
and not to book anything.

Other confirmed audiences, each with its own surface already in the codebase:

- **Spotters** — hand-curated, *paid* locals, one named person per zone. They
  receive commissioned missions, then pin, photograph and verify places.
  Surface: `/spotter`, an installable Android PWA (`manifest.ts`,
  `start_url: /spotter`, `display: standalone`). Their working language is
  Spanish (seed sets `language: 'es'` on every spotter).
- **Property owners (villas / posadas)** — the payer and the distribution
  channel. They display the QR that brings travelers in. They are represented in
  the schema with a `plan` and a `subscription_minor` amount; locals never pay.
  Surface: `/v/[qrToken]`.
- **Operator** — a human in the loop who inspects gaps, missions, spotters and
  verifications, and can override the agents. Surface: `packages/cli`
  (`gaps`, `missions`, `spotters`, `verify`, `tail`).

## Product Purpose

GUACA is a live map of local knowledge for **the Caribbean**, built so that every
place on it was physically visited by a named local. The region is the product;
individual towns are the unit of coverage, funded and filled one at a time.

The loop, as implemented across `packages/agents` and `packages/db`:

1. A traveler asks a question free.
2. If verified places cover it, the planner answers from those places only.
3. If they do not, the system **refuses** and logs the coverage gap.
4. The gap agent aggregates demand across gaps and commissions exactly one paid
   mission to one Spotter.
5. The Spotter goes, pins, photographs and verifies. They get paid.
6. The answer becomes permanent, free map data.

Success is that a traveler gets an answer about a place that demonstrably
exists, and that the system's own ignorance is what funds a local's work.

## Positioning

**"Witnessed, not inferred."**

The AI never generates a place. It composes, routes, translates and schedules
over human-verified data only — enforced in code by the grounding guard
(`packages/agents/src/guard/assertGrounded.ts`, `lexicalSweep.ts`).

The mechanism a neighboring product cannot truthfully copy is the **refusal**:
competitors answer everything, sometimes with venues that do not exist. GUACA
declines, and converts the decline into a paid commission to a named local. The
refusal is not a limitation to be hidden — it is the proof of the claim, and the
only reason the map can be trusted.

Against Google Maps the difference is landmark-first navigation, no ads, and no
franchises or tourist traps.

## Operating Context

- **Travelers do not install anything.** Web only, reached by QR at the
  property. `/v/[qrToken]` opens a session bound to that property and detects
  Spanish vs English from `navigator.language`.
- **Spotters install a PWA** on Android via Play internal testing; a public
  listing is not available in the current timeframe.
- **The product's scope is the Caribbean**, not a single town. Puerto Cabello is
  where coverage *begins*, not what the product is. Any surface that frames GUACA
  as a Puerto Cabello app has understated it; any surface that implies the
  Caribbean is already covered has overstated it. Both are failures, and the
  second is the worse one, because the product exists to refuse exactly that
  kind of claim.
- **First covered area: Puerto Cabello, Venezuela** — one area, bbox
  `-68.03,10.44 → -67.98,10.52`, centered `-68.0056, 10.4716`. Ten hand-drawn
  walkable zones, one named Spotter each. This is the only area the codebase
  models today: the seed creates a single `areas` row, and the web client
  hardcodes that bbox and centre. Regional scope is a product fact the schema
  already supports (`areas` is a table, not a constant) but the data does not
  yet exercise. Named expansion targets are Colombia and Costa Rica.
- Map rendering is MapLibre GL over raster OpenStreetMap tiles.
- The API is Fastify with a WebSocket live operations stream (`opsStream.ts`);
  the web app reaches it via `NEXT_PUBLIC_API_URL`.
- Inference is provider-agnostic behind an OpenAI-compatible
  `INFERENCE_BASE_URL`.

## Capabilities and Constraints

**Routes (confirmed plan, one move pending).** The landing page takes `/`; the
existing tourist map + ask/refusal chat moves to `/map`. `/v/[qrToken]` and
`/spotter` are unaffected.

```
/              landing            — to build
/map           TouristMap         — to move from (tourist)/page.tsx, unchanged
/v/[qrToken]   villa QR tool      — unchanged
/spotter       Spotter PWA        — unchanged
```

**Languages: bilingual English + Spanish**, on the landing surface as well as in
answers. The taxonomy already carries `labelEs` / `labelEn` for every category;
`AskRequest.language` is a two-letter code.

**Fixed place taxonomy** (`packages/shared/src/taxonomy.ts`), with a gap-agent
target density per category: eat & drink (12), beach & water (8), nature &
walks (6), culture & history (8), markets & shops (8), services (6), nightlife &
music (4), practical. Categories are fixed — new ones are not invented at
runtime.

**Hard product rules, not to be relaxed:**

- Reports describe places and conditions, **never people**.
- Money flows only through the `PayoutProvider` seam. `MockPayoutProvider` is
  the only wired implementation; `ReloadlyPayoutProvider` is an explicitly
  unwired documented skeleton that throws if called.
- No token and no chain.
- The AI never generates a place.

**Not built, and must not be implied as built:** there is no checkout,
subscription purchase, or payment flow anywhere in the codebase. Properties
carry a `plan` (`paid` / `free`) and a `subscription_minor` amount that the gap
agent reads as a demand signal for scoring — that is the extent of monetization
in code. Real payouts are mocked.

**Styling constraint for anything new:** `apps/web` has no styling system at
all — no Tailwind, no CSS file of any kind, no token layer, a bare
`next.config.mjs`. All five existing surfaces (`(tourist)/page.tsx`,
`villa-landing.tsx`, `spotter/page.tsx`, `capture.tsx`, `earnings.tsx`) are
styled with inline `styled-jsx` blocks using ad-hoc hex values. A landing page
requires establishing that layer; the choice belongs to the visual-world step,
not here.

**Offline behavior exists:** a service worker (`app/sw.ts`) caches the shell for
`/` and `/spotter` stale-while-revalidate and never caches `/api/`. Moving the
map off `/` means the cached shell list needs revisiting.

**Delivery constraint:** the working deadline for a shippable version is
2026-08-17.

## Brand Commitments

- **Name:** GUACA.
- **Voice / line already in use in production code:** "witnessed, not inferred"
  — present in `layout.tsx` metadata, the tourist topbar, and the villa header
  as "Local knowledge, witnessed not inferred." Treat this as the load-bearing
  claim of the product, not as decoration.
- **Territory identity is a product commitment:** one named Spotter per zone,
  name and photo attached to the pins they verified. The named human is the
  proof, so the identity system must be able to carry a person's name and face.
- **The guacamaya is the mark.** GUACA is short for *guacamaya*, so the scarlet
  macaw is the name made visible rather than decoration. Drawn in the bird's own
  red / gold / blue, and it is the only place colour enters the product's
  surfaces — the page itself stays bone, ink, and the reserved merlot.
- **Retired:** the earlier logo's tagline "AI VERIFIED DATA" must not be reused.
  It states the opposite of how the product works: the AI verifies nothing,
  named locals do, and the AI's job is to refuse where they have not been.
- The scaffold `#1d5cb0` that shipped in `manifest.ts` has been replaced with
  bone and ink. It was never a chosen colour.

## Evidence on Hand

**No real content exists yet.** Confirmed with the user 2026-08-07. Everything
currently in the database comes from `packages/db/src/seed/index.ts`, and the
landing page must not present any of it as real:

- **Spotter names are fictional** — "Yorman Salazar", "María Fernanda",
  "Carlos Pirela" and seven more, with placeholder phone numbers
  `+58 412 000 000X`. No real Spotter is onboarded. **No named person, face, or
  `verified by …` attribution may appear on the page as if real.**
- **Property names are fictional** — "Posada La Marina", "Villa Quizandal",
  "Casa del Puerto". No villa or posada partner is signed. No partner may be
  named or logo'd.
- **No verified places and no Spotter photographs exist.** Verified counts,
  "N places mapped" statistics, and verification dates cannot be shown.
- **Zone names are real Puerto Cabello geography** and may be named honestly:
  Malecón, Casco Histórico, Playa Quizandal, Borburata, Patanemo, Isla Larga,
  Centro, El Trompillo, San Esteban, La Guaricha.

**Hero photograph on hand:**
`images/pexels-katherine-zambrano-realza-3587791-31024563.jpg`, 5184×3456.
Caribbean coastline at eye level — driftwood, litter, informal structures, real
haze. Pexels-licensed (commercial use permitted, attribution not required),
photographed by Katherine Zambrano Realza. **It is stock, not a Spotter capture,
so it must never carry a verification caption or a Spotter's name.** It may set
mood and may be described honestly by location type.

Nothing else — no testimonials, press, case studies, benchmarks, user counts, or
partner logos. None of these may be invented to fill a section.

## Product Principles

1. **The refusal is the product.** Wherever coverage runs out, say so plainly
   and show what it triggered. Never paper over a gap, in the app or in the
   marketing of it.
2. **Every claim on a surface must be literally true today.** The page argues
   that records are not fabricated; a fabricated record anywhere on it destroys
   the argument. When real proof does not exist yet, show the mechanism instead
   of faking the record.
3. **Name the human.** Attribution to a specific local is the differentiator and
   the payment justification — once real Spotters exist, they are the proof, not
   an illustration.
4. **The traveler pays nothing and installs nothing.** Any friction added
   between a scanned QR and an answer is a regression.
5. **Places, never people.** The product describes the world, not the humans
   in it.

## Accessibility & Inclusion

- **Bilingual EN/ES is a requirement, not an enhancement** — travelers read
  English, Spotters and local partners read Spanish.
- **Mobile-first and bandwidth-constrained.** The dominant arrival is a phone
  scanning a QR in Venezuela; a service worker already exists to keep the shell
  usable on a weak connection. Large hero imagery must be budgeted against this.
- No further product-specific accessibility standard has been established.
