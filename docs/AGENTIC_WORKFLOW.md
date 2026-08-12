# GUACA — Agentic workflows

## Planner agent

```mermaid
flowchart LR
    Q[Tourist question] --> I[Intent extraction — lexicon]
    I --> C{Coverage >= min?}
    C -- no --> R[Refusal — zero tokens + gap logged]
    C -- yes --> F{Single-topic now?}
    F -- yes --> D[Deterministic fast path — zero inference]
    F -- no --> M[Model — refEnum only]
    M --> G[assertGrounded]
    G -- violation --> R
    G -- pass --> E[renderItinerary — DB rows only]
    E --> A[Answer in guest's language]
```

## Gap agent

```mermaid
flowchart LR
    X[Refused questions] --> CL[Cluster — area, category, h3_8]
    CL --> SC[scoreGap — D·R·C·S·F]
    SC --> HG{Hard gates q≥3 s≥2 capacity>0}
    HG -- pass --> FL{Score >= floor}
    FL -- pass --> SP[Spotter selection — zone owner first]
    SP --> BR[Brief in spotter's language]
    BR --> CM{Guards}
    CM -- reward > cap --> OP[interrupt — guaca commission --approve]
    CM -- pass --> M[One mission, one spotter, one payment]
    M --> P[Payout — idempotency key = mission_id]
```

## Verification agent — the check ladder

```mermaid
flowchart TB
    SUB[Spotter submission] --> L0[L0 integrity — ~0]
    L0 --> L1[L1 freshness — ~1ms]
    L1 --> L2[L2 geo distance — ~1ms]
    L2 --> L3[L3 pHash reuse — ~10ms]
    L3 --> L4[L4 intra-diversity — ~0]
    L4 --> L5[L5 vision — ONE multimodal call]
    L5 --> F[Deterministic fusion]
    F -- rejected --> R[REJECT — zero vision paid on cheap rung failures]
    F -- accept --> L6[L6 second local — HITL interrupt]
    L6 -- confirm --> V[verified + witness_count = 2]
    F -- mid-band / inconclusive --> L7[L7 operator escalation — guaca queue]
```

**HITL points are marked by `interrupt()`:**
- `requestSecondLocal` interrupts for a *different* spotter's confirmation.
- `visionVerify` is a SEPARATE node — resume re-runs only the interrupting
  node, so the interrupt/resume cycle pays for vision exactly once.
- Every write past an interrupt is idempotency-keyed.

## Check-ladder cost table

| # | Check | Cost | Threshold |
|---|---|---|---|
| L0 | Integrity | ~0 | any fail → hard |
| L1 | Freshness | ~1ms | >24h outside → hard |
| L2 | Geo distance | ~1ms | ≤75m PASS · 75–250m WEAK · >250m hard · absent INCONCLUSIVE |
| L3 | pHash | ~10ms | Hamming ≤6 → PHOTO_REUSE · 7–12 WEAK · >12 PASS |
| L4 | Diversity | ~0 | min pairwise <10 → NO_DIVERSITY |
| L5 | Vision | paid | structured verdict, all photos in one call |
| L6 | Second local | human | CONFIRM / DENY / TIMEOUT(72h) |
| L7 | Operator | human | APPROVE / REJECT / REQUEST_MORE |

Fusion is deterministic — no model in the decision.
