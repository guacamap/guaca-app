# GUACA — Compliance & Responsible AI

**Data minimisation and anonymity.** Tourist sessions are anonymous: no
account, no profile, no personal data captured — a session is a property
reference and a language. Questions are stored as demand signals, not as
attributable behaviour. Spotters are named on pins by design (territory
identity is the product), with explicit consent covering their name, photo
and verified contributions, and a right to erasure: removing a spotter
unlinks their identity from pins. Photos are minimised to what verification
needs — geolocation and a perceptual hash — and are never republished
outside the map.

**Reports describe places and conditions, never people.** No schema field,
prompt, or UI captures a claim about a person. Condition reports (sea state,
road condition, power, water, crowd level) are the only "live" data form.

**Human oversight by design.** Every consequential state change is audited in
`operator_actions`; the operator CLI can override any agent decision; a
second local human confirms every place; the gap agent pauses for approval
above a reward cap. Autonomy is calibrated, not maximal.

**Model risk.** The AI never generates a place — the planner's output schema
contains integers and enums only, the guard re-reads the database at render
time, and the renderer reads names from database rows exclusively. 10 000
property-tested hostile outputs produced zero unwitnessed places. The vision
model's only free-text output (signage OCR) is used solely to corroborate the
Spotter-typed name and is never written to the place name.

**Data sovereignty.** Pilot data lives in Venezuela and is served from a
Caribbean-friendly deployment; the plan treats Caribbean data sovereignty as
a first-class constraint — data is not shipped to jurisdictions without
consent.

**Bias.** Curation bias is acknowledged: spots reflect what curated Spotters
choose to verify. Mitigation is territory rotation — missions are spread
across zones and spotters with fairness corrections — and coverage gaps are
surfaced as refusals rather than guesses.

**Honest limitations.** Browser capture has no EXIF; geolocation is
client-attested and corroborated by pHash, vision, and a second local. This
limitation is stated plainly rather than hidden.

**Legal positioning.** GDPR/CCPA-aware (minimisation, erasure, consent);
under the EU AI Act this is a limited-risk system with transparency
obligations and human oversight by design. Licensed Apache-2.0 so the
knowledge commons stays open.
