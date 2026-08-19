# GUACA — Project notes (living)

## Deadlines (corrected)

- **Submission closes: end of August 2026** — the whole of August is
  building time (per project owner 2026-08-19; the plan's 17 Aug is
  superseded).
- **Judging starts in September 2026** — the plan's 16 Aug live-demo date
  is also superseded.
- Demo video to be recorded before judging starts in September.

## Open decisions / blockers

- **T5.2 scoring discrepancy** — plan §7.5 table says 219/42/143, the
  verbatim formula yields 288/55/187. Implemented verbatim; tests pinned to
  verbatim values. NEEDS a decision on which is authoritative.
- **Live infra (not run from the dev box):**
  - vLLM / Qwen3-VL-8B on Nebius L40S (`--max_model_len 16384` mandatory).
  - Phone-on-cellular verification of the deployed QR (HTTPS).
  - Push a branch so CI runs green on GitHub Actions.
- **Physical tasks:** Spotter recruitment (target 10+), villa partnerships,
  domain / sslip.io decision, Reloadly carrier check for Venezuela.

## Guard rails (never violate)

- The AI never generates a place — assertGrounded is the only construction
  site; dependency-cruiser forbids render → inference as a build failure.
- Exactly three agents: planner, gap, verification. The **trend engine**
  (2026-08-19) is NOT a fourth agent: a deterministic scoring module in the
  gap-scoring tradition — pure functions over recorded behaviour, zero
  inference, versioned (`TREND_VERSION`). It ranks verified places and
  modulates gap scoring; it cannot introduce a place or commission
  anything by itself.
- Missions stay **demand-first** (owner decision 2026-08-19): the wider
  funnel (refusals, re-check doubts, category momentum from real asks,
  stale-place refresh hints) all start from recorded demand. No
  speculative commissioning toward density targets; the daily cap and
  reward cap stay.
- Raw engagement counts never reach tourist surfaces — badges only
  ("trending" / "asked about" / "fresh"), each a literally-true statement.
- MockPayoutProvider only; payouts keyed by mission_id.
- `verified_needs_two_locals` is never relaxed — no machine-only
  verification, ever.
- Tests run zero-network; the fetch ban in test/setup.ts is deliberate
  (the weather provider's fetch is injected and faked in tests).
