# GUACA Operations

The operator CLI is the human hand on the autonomy switch. Every command
authenticates with `OPERATOR_TOKEN` and supports `--json`.

## Commands

| Command | Purpose |
|---|---|
| `guaca tail [--agent gap] [--event refused]` | Live pretty-printed structured log stream. |
| `guaca queue` | Verification escalations awaiting a human. |
| `guaca verify <id> --approve\|--reject --reason "…"` | Operator verification decision — audited. |
| `guaca gaps` | Ranked open gaps with score breakdown. |
| `guaca commission <gapId> [--spotter] [--reward] [--approve]` | Operator mission commission. |
| `guaca missions [--status]` | List missions, newest first. |
| `guaca override <missionId> --cancel --reason "…"` | Cancel a mission — audited. |
| `guaca pay <missionId>` | Payout through the mock provider (idempotency key = mission_id). |
| `guaca spotter add <name> <phone>` / `list` / `code <id>` | Operator-issued spotter accounts and one-time login codes. |

## When a human must intervene

- **Reward cap exceeded** — the gap agent pauses (`needs_approval`) when the
  reward is over `GAP_AGENT_MAX_REWARD_MINOR`; `guaca commission --approve`
  resolves it.
- **Verification mid-band** — trust between 0.55 and 0.80 escalates to the
  operator queue; `guaca verify` decides.
- **L2 INCONCLUSIVE + low vision confidence** — never guess; escalate.
- **L6 second-local DENY** — escalate, never auto-reject (rivalry and honest
  error both exist).
- **Autonomy reversal window** — auto-approved missions enter a 30-minute
  window during which `guaca override --cancel` can stop dispatch.

## Escalation policy

1. The agent escalates, never guesses (the fusion rules are deterministic).
2. The operator queue is drained by `guaca queue` — oldest first.
3. Every decision writes an `operator_actions` audit row with before/after
   state. An unaudited state change is a defect.
4. The operator overrides the PROCESS, never the two-witness rule: approving
   a verification run does not bypass `verified_needs_two_locals`.

## Setup

```bash
export OPERATOR_TOKEN=$(openssl rand -hex 32)   # keep it secret
export DATABASE_URL=postgres://guaca:guaca@localhost:5432/guaca
guaca tail
```
