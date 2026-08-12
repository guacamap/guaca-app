# GUACA — Demo script (5 minutes)

Target: one area (Puerto Cabello), 10 Spotters, 30–50 verified places,
2–3 villas.

1. **(0:00) The frame.** "Every AI travel planner will confidently answer
   everything today. Some of those restaurants don't exist. Ours refuses —
   and that refusal pays a local."
2. **(0:30) Scan the villa QR** on a real phone. Session opens in the
   guest's language.
3. **(1:00) Ask a covered question.** Instant answer from verified places.
   Tap a pin — a named local's face and name. "This was physically visited
   by Yorman, on this date."
4. **(2:00) Ask an uncovered question.** It refuses, live. Not an error — a
   confident product state: "No one has been there yet. 7 people have asked
   — a Spotter mission opens at 10."
5. **(2:30) Cut to `guaca tail`.** The gap agent aggregates the demand,
   scores it, weights it by the paying property, and commissions one mission
   to one named Spotter — on screen, unprompted.
6. **(3:30) The Spotter's phone** shows the mission arriving, in Spanish.
7. **(4:00) Human oversight.** `guaca queue` → an operator approves/overrides
   a verification. "Autonomy with a hand on the switch."
8. **(4:30) Close.** "Witnessed, not inferred. The AI's own ignorance became
   a local's paycheck."

**The loop, live.** A judge types a question about a zone deliberately left
uncovered; it refuses with a timestamp; a teammate walks to a real place and
submits; the same question answers ~4 minutes later. Show the `loop_events`
timeline with wall-clock deltas.

**Rehearse with the network unplugged at least once.** Have a recorded
fallback video ready, labelled "recorded" — being caught faking is worse
than any technical failure.

**Attack the AI.** Hand the judge the keyboard. Their prompt, the guard log
line (refsOffered → refsRequested → refsAccepted), and an answer containing
only witnessed places. "The model's entire output vocabulary is the integers
1 to 12, and 10 000 randomly-generated hostile outputs produced zero
unwitnessed places. It's a property of the type system, not of the prompt."
