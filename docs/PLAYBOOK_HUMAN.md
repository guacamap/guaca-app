# Running Guaca humanly — the post-deploy operations playbook

**Who this is for.** The 1–3 people who keep Guaca alive once it's deployed:
the operator who handles missions and money, the community manager who
handles Spotters, the moderator who handles content. At pilot scale these
are likely the same person wearing three hats; the playbook is written so
the hats can be handed off without relearning anything.

**The design bet this builds on.** Guaca's autonomy is deliberately
calibrated, not maximal: the agents commission, verify, and recommend, but
a human approves anything consequential (reward caps, mid-band trust, L6
denials, every steward draft). This playbook is about making that human
layer *sustainable* — a job that fits in someone's week, not a pager that
owns their life.

Research grounding: how [Waze runs a 30,000-volunteer editor
community](https://support.google.com/waze/partners/answer/13704490?hl=en),
how [two-sided marketplaces sequence supply and codify
expansion](https://themarketplaceguide.com/articles/the-two-sided-marketplace-playbook-sequencing-liquidity-and-what-breaks-at-scale/),
and how [trust & safety teams measure moderation
work](https://tspa.org/curriculum/ts-fundamentals/content-moderation-and-operations/metrics-for-content-moderation/).

---

## 1. The three hats (roles, not people yet)

| Hat | Owns | Tools | Time at pilot scale |
|---|---|---|---|
| **Operator** | missions, payouts, gap priorities, the kill switch | `admin.guaca.live`, `guaca` CLI, ops stream | ~15 min/day |
| **Community manager** | Spotter recruitment, onboarding, retention, disputes | WhatsApp/phone, admin People tab, `guaca spotter` | ~2 hr/week per 10 Spotters |
| **Moderator** | reported posts, registration inbox, escalation queue | admin Moderation tab | ~10 min/day |

At pilot, one person wears all three. The moment it hurts (>30 min/day
total), hand off moderation first — it's the most delegable and the least
consequential to get wrong.

---

## 2. The operating rhythm

### Daily (≤15 minutes, coffee-scale)
1. **Open the admin panel.** The twelve overview cards ARE the daily
   checklist. Anything red-shaped (offered missions > 5, escalations > 0,
   reported posts > 3) gets looked at; everything else can wait.
2. **Drain the queues.** Moderation tab: reported posts (hide/keep — 30
   seconds each, the two-report auto-hide already did the triage) and
   verification escalations (approve/reject with a note — the ladder
   already gathered the evidence; you're the judgment call).
3. **Check yesterday's missions.** Any `offered` mission nearing its 48h
   expiry with no acceptance → the community manager pings the Spotter
   (they may be offline; a human nudge is retention work, not nagging).

### Weekly (~1 hour)
1. **Pay the verified missions.** Admin Missions tab → Pay on each
   `verified` mission. The mock provider makes this a no-op today; when
   Reloadly is wired, this becomes the one money-touching moment of the
   week — reconcile against `payouts` (idempotency key = mission_id means
   double-clicking is safe by design).
2. **Steward review.** Run `guaca steward enrich --limit 20` (or the
   panel), then approve/reject drafts as a batch. This is the AI's
   candidate enrichment — approving makes missions sharper, never places
   verified.
3. **Spotter check-in.** WhatsApp the roster. Who's stuck? Who hasn't
   logged in for 10 days? Who deserves a level bump (`level` is your
   trust dial — raise it for consistent quality, and the gap agent will
   prefer them automatically).
4. **Glance at demand.** Admin → Missions & Gaps: are open gaps
   clustering somewhere with no Spotter? That's next week's recruitment
   target, not this week's emergency.

### Monthly (~2 hours)
1. **Zone-by-zone coverage review.** For each zone: verified places vs
   the taxonomy targets (`eat_drink` 12, `beach_water` 8, …). Where a
   category is thin AND demand exists, the map is telling you where to
   point Spotters next.
2. **Audit trail skim.** `select * from operator_actions order by
   created_at desc limit 50` — read your own decisions. Anything you
   can't explain to a stranger is a process bug.
3. **Backup verification.** The backup script prunes at 14 days; monthly,
   restore the latest dump into a scratch database and confirm it boots.
   A backup you've never restored is a rumor.

---

## 3. The Spotter lifecycle (the community manager's bible)

This is where the Waze model applies most directly: Waze's community
managers are [volunteers trained into roles via structured
paths](https://skillshop.exceedlms.com/student/path/1394408-waze-map-editor-suggest-an-edit-moderators),
supported by staff liaisons and office hours. Guaca's version:

**Recruit** (the product does the pointing; you do the asking)
- The gap agent already ranks WHERE demand exists. Recruit Spotters who
  live in those zones — one named person per zone is the product's
  territory-identity commitment, not a nice-to-have.
- Source: the registrations inbox (people who already raised their hand),
  then local referrals from existing Spotters. A referral from a good
  Spotter is worth ten cold recruits.

**Onboard** (the 20-minute ritual)
1. `guaca spotter add` (or admin People tab) → issue login code → deliver
   it in person or by phone. Never by email — the code IS the account.
2. Walk them through ONE mission end-to-end: accept → capture (photos,
   landmark, the "type the name as the sign shows it" rule) → submit →
   "another local confirms" → LIVE. Seeing their name on a pin once is
   the entire retention program in miniature.
3. Explain the money plainly: per-mission, airtime top-up, paid weekly.
   No tiers to climb for payment, only trust (`level`) which changes
   which missions find them.

**Retain** (the actual job)
- **Pay on time, every time.** Marketplace research is unambiguous:
  [payout reliability is the single strongest retention
  lever](https://trolley.com/learning-center/instant-freelancer-payouts-gig-work/)
  for gig workers. The weekly Pay ritual above is non-negotiable.
- **Answer within a day.** A stuck Spotter with a silent operator churns.
  The 48h mission expiry means your responsiveness window is built in.
- **Celebrate verifications.** Every new pin is a human's work made
  permanent. A monthly "N places verified, top zone: X" message to the
  roster costs nothing and is the Waze-office-hours equivalent.

**Retire** (graceful)
- Inactive 30+ days → `guaca spotter` deactivate (their pins keep their
  name — attribution is permanent; erasure unlinks identity, it doesn't
  rewrite history). Tell them the door's open. The zone reopens for
  recruitment.

**Disputes** (rare but real)
- A Spotter disputes a rejection → the community manager reads the
  verification run's checks JSON with them. The ladder's evidence is
  logged; the conversation is about the evidence, not about feelings.
- A L6 DENY from a rival → never auto-resolved, always escalated to the
  operator (already the behavior). Two-locals rules cut both ways: the
  system is built to be argued with, by humans, slowly.

---

## 4. Money, humanly

Today: `MockPayoutProvider` — Pay is a bookkeeping click. When Reloadly
goes live, the weekly ritual changes shape but not substance:

1. **One money moment per week** (the Pay batch), never ad-hoc
   mid-week payments. Exceptions create reconciliation debt.
2. **The caps are the budget.** `GAP_AGENT_MAX_MISSIONS_PER_DAY` (5) and
   `GAP_AGENT_MAX_REWARD_MINOR` (500 = $5) ARE the monthly spend model:
   worst case 5 × $5 × 30 = $750/mo. Tune the knobs, not your willpower.
3. **Reconcile monthly**: payouts table vs Reloadly's statement.
   The mission_id idempotency key makes mismatches findable in minutes.
4. **The Cornell caveat** ([bonus research, Nov
   2025](https://news.cornell.edu/stories/2025/11/platforms-relying-gig-workers-bonuses-can-double-edged-sword)):
   fixed bonuses when workers are plentiful help the platform but can
   hurt worker welfare. Guaca's per-mission payment with trust-based
   mission routing is the fairer shape — resist the urge to add bonus
   gimmicks under growth pressure.

---

## 5. Content moderation, humanly

The system already implements the [tiered model trust & safety teams
recommend](https://www.cato.org/policy-analysis/guide-content-moderation-policymakers):
automated first pass (two-report auto-hide = the rules layer), human
review for edge cases (the Moderation queue). Your part:

- **The 30-second rule**: reported post → read body + author + reports →
  hide or keep. The queue is small by design; if it isn't, the
  auto-hide threshold (`REPORTS_TO_HIDE`) is the dial, not your patience.
- **Hide is reversible** (`guaca posts show`). Bias toward hiding
  fast and restoring on reflection — the cost asymmetry favors the map's
  trust over any single post.
- **The [metrics that
  matter](https://tspa.org/curriculum/ts-fundamentals/content-moderation-and-operations/metrics-for-content-moderation/)**:
  reports-per-day, median time-to-decision, and reversal rate. If
  reversals climb, your instinct is drifting from the guideline — reread
  the rules, don't improvise new ones mid-queue.

---

## 6. What to watch (the honest dashboard)

Weekly, from the admin overview — each metric paired with the human
action it triggers:

| Metric | Healthy | If it drifts |
|---|---|---|
| Questions → refusal rate | falls as zones fill | rising in one zone = commission target |
| Offered missions unaccepted > 36h | ~0 | Spotter stuck → ping (retention) |
| Escalations pending | drained daily | growing = the ladder's thresholds need tuning, not more of your evenings |
| Reported posts pending | < 5 | growing = visit the auto-hide dial |
| Steward drafts pending | < 20 | growing = batch bigger weekly reviews |
| Payout backlog (`verified` unpaid) | 0 by Friday | THE commitment; never let it cross a weekend |
| Zone coverage vs targets | rising, zone by zone | thin + demanded = recruit there |

---

## 7. What NOT to automate yet (and when to flip each)

The research is clear that [automating payouts is the standard lean-team
move](https://tipalti.com/resources/learn/gig-worker-payouts-api/) — but
sequencing matters more than speed at pilot scale. Flip each switch when
its trigger fires, not before:

| Manual today | Automate when | How |
|---|---|---|
| Weekly Pay batch | > 20 missions/week | wire `ReloadlyPayoutProvider` (the seam exists), keep the weekly reconcile |
| Steward enrich run | drafts stay under 20 | scheduler-cron the enrich call; review stays human forever |
| Mission-expiry nudges | > 3 expiries/week | WhatsApp template message on expiry-24h |
| Spotter check-ins | roster > 15 | a monthly digest message, still sent by a human |
| Coverage review | zones > 10 | promote the map-health analysis to the panel |

The invariant underneath all of them: **money, verification overrides,
and steward approvals never leave human hands.** Everything else is
logistics.

---

## 8. Incident response (the short version)

- **API down**: `/healthz` is the truth → `docker compose ps` on the VM →
  `guaca-api` logs. Restart policies already self-heal crashes; if the
  box is down, the deploy workflow re-runs.
- **Bad data live** (a fabricated-looking place): `guaca verify <id>
  --reject` — the pin drops, the audit row records why, the Spotter
  conversation is yours.
- **Gap agent misbehaving**: `GAP_AGENT_ENABLED=false` is the kill
  switch — one env var, restart, breathe. Nothing commissioned while
  off is lost; demand keeps recording in `questions`.
- **The map is wrong somewhere**: that's not an incident, that's a
  mission. The refusal already logged it.

---

*The one-line summary: the system is built so that the humans do
judgment (approve, pay, recruit, decide) and the machines do everything
else. Keep the judgment cheap — batches, weekly rhythms, caps — and the
map stays honest without the team burning out.*
