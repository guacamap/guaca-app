# GUACA — Project overview

**Problem.** AI trip planners confidently recommend restaurants that do not
exist. Google Maps is address-first, which fails across the Caribbean where
many worthwhile places have no address — they have a landmark. The market
leader generates venues with an LLM, and its venues are documented as
sometimes non-existent.

**Solution.** A live map of local knowledge for Caribbean travel where every
place is physically visited by a named local whose name and photo appear on
the pin. The AI composes, routes, translates and schedules over
human-verified data only — it is structurally incapable of inventing a
place. When coverage does not exist, it refuses, and that refusal is a
demand signal precise enough to pay someone to resolve it.

**The core loop.** Tourist installs the PWA, creates an account (email
one-time code), and asks (free, unlimited) → answers from verified
places if coverage exists → otherwise a confident refusal + a logged gap →
the gap agent commissions ONE paid mission to ONE named Spotter → the
Spotter photographs and verifies → the answer becomes permanent map data,
free to every future asker.

**Business model.** Tourists subscribe $4.99–9.99 at the planning moment,
against the account created at first scan.
Villas and posadas are the distribution channel and the payer — no front
desk and no F&B revenue to protect, and their Airbnb rating depends on good
local recommendations. Coverage is funded once per area and resold to every
property and tourist in it. Spotters are paid in airtime/data top-ups
(Reloadly: one API covers the Caribbean, needs no bank account, reads as a
gift rather than a wage). Territory identity: one named Spotter per zone,
name and photo on every pin — not global leaderboards.

**Go to market.** Pilot Puerto Cabello with 10–20 hand-curated Spotters and
2–3 villas. The demo closes the loop live: a judge types a question about an
uncovered zone, it refuses with a timestamp, a teammate walks to a real
place and submits, and the same question answers minutes later — shown on
the loop_events timeline with wall-clock deltas.
