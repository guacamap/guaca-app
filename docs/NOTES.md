# GUACA — Project notes (living)

## Deadlines (corrected)

- **Submission closes: 30 Aug 2026** (per project owner — the plan's 17 Aug
  is superseded). Live demos + judging 16 Aug still stand; polish-only after
  submission.
- Demo video to be recorded before judging (15 Aug buffer).

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
- Exactly three agents: planner, gap, verification.
- MockPayoutProvider only; payouts keyed by mission_id.
- `verified_needs_two_locals` is never relaxed — no machine-only
  verification, ever.
- Tests run zero-network; the fetch ban in test/setup.ts is deliberate.
