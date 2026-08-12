# GUACA — Mobile UX brief (paste-ready for AI design tools)

> Paste this whole document into the design tool's chat (Shogo, v0, Figma
> Make…), then ask for one surface at a time. Outputs are concept
> references for our PWA/Expo build — not shippable code.

---

## The product in three sentences

GUACA is a live map of local knowledge for Caribbean travel. Every place
on the map was physically visited by a named local ("Spotter") whose name
and photo appear on the pin — the AI composes answers ONLY from these
human-verified places and **refuses confidently when coverage doesn't
exist**. That refusal creates a paid mission for a Spotter, whose
verification turns the refusal into permanent map data.

**Tagline energy:** "Witnessed, not inferred." · guaca = buried treasure
in Latin American Spanish — hidden local places, surfaced.

## Users & surfaces (one app, role chooser at launch)

1. **Tourist** — a villa/posada guest, 6-day stay, planning from a phone,
   often on weak wifi. Language: their own (ES/EN at minimum).
2. **Spotter** — a hand-picked local with a territory. Works in Spanish,
   on a mid-range Android, on cellular data. Paid per mission in
   airtime/data top-ups.
3. (Operator surface exists but is out of scope for this brief.)

## The UX rules that make GUACA look like nothing else

- **Refusal is a hero state, not an error.** When coverage doesn't exist:
  no red, no sad-face. A confident card: "No one has been there yet.
  7 people have asked — a Spotter mission opens at 10." Optional
  "tell me when it's verified."
- **Every pin carries a human.** Place detail leads with the Spotter's
  photo, name, and "physically visited on <date>". Trust = a face, not
  stars.
- **Landmark-first, address-first never.** "50m past the church, blue
  door" is the primary location line; the address is small and secondary.
- **The map is alive.** New verifications appear with a moment of
  celebration — this map grows because people asked.
- **No gamification.** No points, no leaderboards, no badges. Territory
  identity (one named Spotter per zone) is the status system.
- **Nothing about people.** Reports describe places and conditions (sea
  state, road, power, crowd) — never persons.

## Screens — Tourist

1. **Villa QR landing** — arrives from a QR card in the room. Shows the
   villa's name, a map teaser of verified places nearby, language already
   set. One action: create account (email → 6-digit code → in).
2. **Map home** — full-bleed map, category chips (eat, swim, see, buy,
   fix), pins show category + tiny Spotter avatar. Search/ask bar on top.
3. **Ask** — chat-like: question in, either (a) an itinerary answer
   citing 2–5 places as tappable cards, or (b) the refusal hero state
   with the demand counter. Answers show "every place below was
   physically verified" affordance.
4. **Place sheet** — photo strip, landmark description LARGE, Spotter
   identity block (photo, name, verified date), conditions if fresh,
   directions handoff.
5. **Day plan** — a routed day as a vertical timeline (morning → night),
   each stop a place card; travel times between stops.

## Screens — Spotter (Spanish-first)

1. **Login** — phone + operator-issued code. No self-signup.
2. **Missions** — usually ONE active mission card: what to verify, the
   landmark area, reward as "Bs./data top-up", expiry. History below.
3. **Mission detail → Capture** — checklist flow: arrive (GPS check
   ≤75m), photograph (3+ angles, camera-only), type the place name as
   the sign shows it, quick condition report (chips, not forms).
4. **Submission status** — the verification ladder as human steps:
   "photos received → checks passed → another local confirms → LIVE."
   Celebrate the LIVE moment — their name goes on the pin.
5. **Earnings** — top-up history, plain amounts, no charts needed.

## Look & feel

- Palette direction: sea-glass paper `#F7FAF8`, deep sea ink `#17272B`,
  reef teal `#0D7A72`, mango accent `#D97E00` (used sparingly — refusal
  counters, mission rewards). Dark mode equivalents welcome.
- Feels: sunlit, unhurried, trustworthy. Photography does the talking.
- Type: humanist sans; big friendly numerals for counters/codes.
- Avoid: purple-blue gradient heroes, glassmorphism, stock-travel
  clichés (palm-tree illustrations), dense dashboards, anything that
  reads "crypto app".
- Mobile-first, thumb-reach actions, works on a 360×800 Android; assume
  images may load slowly — design the loading states.

## Ask the tool for (one message each)

1. Tourist: map home + ask + refusal state (the refusal is the money
   shot — treat it as the brand moment).
2. Tourist: place sheet with the Spotter identity block.
3. Spotter: mission detail → capture flow as a checklist.
4. The role chooser / first-launch moment.
