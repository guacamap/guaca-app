# Recording script — Guaca Puerto Cabello demo

A three-role, single-take screen recording on the local instance: traveller,
Spotter, and the Casa Rosada business. Everything below was rehearsed end to
end on 2026-09-06 with a headless browser; the storyboard screenshots from that
rehearsal are referenced per beat. Storyboards live outside the repo in
`/tmp/guaca-browser-pass/rehearsal/` if that session still exists; the beats,
logins, and timings are the durable part.

## Before recording (5 minutes)

1. Restart the app so the presentation build is fresh and stable (the flag is
   read from `apps/app/.env.local`, so a restart keeps it):

   ```sh
   pnpm --filter @guaca/app dev
   ```

   With `NEXT_PUBLIC_PRESENTATION_MODE=true`, the dev bypass buttons and the
   "code is 000000" hints are hidden in both gates. Do a hard reload of any
   already-open tab before rolling.
2. Start the admin panel (needed only for the business segment):

   ```sh
   pnpm --filter @guaca/admin dev
   ```

3. For the operator login to be typeable on camera, run the local API without
   `RESEND_API_KEY` (comment it out in `apps/api/.env`, restart the API): the
   login code then prints in the API terminal as
   `[email] login code for …`. Everything else uses dev codes, so no other
   flow depends on the email sender.
4. Verify the data: `pnpm demo:prepare`, then the map should show 13 profiled
   public places (11 photographed) plus the 8 verified cast venues, every one
   of them a photo pin on the map and a thumbnail in the list, with no `[DEV]`
   names anywhere. Cast-venue photos are cultural illustrations captioned as
   such; Playa Quizandal's photo is of the actual beach.
5. Record the browser window, not the whole screen, if you want to keep the
   terminal with the operator code off-camera. Keep the terminal visible to
   yourself.

Logins used on camera:

| Role | Where | Identity | Code |
| --- | --- | --- | --- |
| Traveller | app 3002, "I'm here to explore" | `viajero@guaca.live` | `003132` (the showcase access code; the screen asks for an access code, never claims an email was sent) |
| Spotter | app 3002, Spotter entry | `rafael@demo.guaca.live` (has the live mission; `yorman@demo.guaca.live` for the confirm flow) | `000000` |
| Business | admin 3003 | `casarosada@demo.guaca.live` | the 6-digit code in the API terminal |

## Segment 1 — Traveller (about 2 minutes)

1. **Entry (EN).** Open `http://localhost:3002`. The Puerto Cabello entry
   shows one traveller action, the Spotter action, language switch, business
   handoff. No dev affordances. (Storyboard: T1)
2. **Sign in.** Choose the traveller path, enter `viajero@guaca.live`,
   request a code, enter `003132`. The gate says "Enter your access code",
   which is the deployed-presentation behaviour itself. (T2)
3. **Map.** Pick Puerto Cabello. Every verified place is now a round photo
   pin; unconfirmed listings stay lighter category dots, so the trust tiers
   read at a glance. Show the unified list: photo thumbnails on every row,
   clean names, "Listed · unconfirmed" markers on public listings. (T3, T3b,
   M1)
4. **Search.** Type `catedral` (no accent) and open Catedral de San José:
   photo, credit with a live CC BY-SA 3.0 licence link, sources and research
   date, tier label. (T4, T4b)
5. **Business voice.** Open Casa Rosada: the business-published post
   (hours this week), contact details, official site link. Say: the business
   publishes; a Spotter verifies; the labels never blur. (T5)
6. **Save.** Heart a place, reload, show it persisted. (T6)
7. **Ask.** Guaca tab, click the suggestion chip **"Plan my day near the
   malecón"** (the chips are tuned phrasings; free-typed two-topic sentences
   like "plan one relaxed day of culture and food" sometimes get a graceful
   refusal instead of a plan, see Fallbacks). The answer names real places
   with honest "listed, unconfirmed" markers; tap a place chip to open its
   profile. (T7)
8. **The honest refusal (optional, strong beat).** Ask "Which beach is best
   this afternoon?" No verified beach exists, so Guaca refuses and offers to
   send a local. Tap **send someone**. Say: every question that cannot be
   answered honestly becomes work for a local. This creates the mission the
   Spotter picks up in segment 2.
9. **Share.** Plan tab shows the itinerary; its public link opens logged out
   in an incognito window. (T8b)

## Segment 2 — Spotter (about 90 seconds)

1. **Sign in.** Back to the entry, choose the Spotter path,
   `rafael@demo.guaca.live`, code `000000`. (S1)
2. **Mission.** The Missions tab shows the beach check commissioned by the
   traveller a moment ago. Accept it. (S2; the mission was commissioned live
   during rehearsal and expires in 48 hours)
3. **Confirm on the ground.** Confirm tab: "Location received. Within walking
   distance." Confirm the place awaiting a second witness. In the rehearsal
   this took Mercadito La Sirena from provisional to verified with two
   witnesses, the two-local rule holding. (S3, S3b)
4. **Earnings.** Points for the confirmation. Say: local knowledge is paid
   work, and nothing becomes a verified pin without two locals. (S4)

## Segment 3 — Business (about 60 seconds)

1. **Sign in.** `http://localhost:3003`, `casarosada@demo.guaca.live`, send
   code, read the code from the API terminal, verify. The sidebar shows
   Equipo Casa Rosada, Operator. (O1, O2)
2. **Oversight.** The oversight map with live counts (verified, awaiting
   second witness, gaps, missions). The waitlist shows the Casa Rosada
   registration, handled. (O2, O-waitlist)
3. **Close the loop.** Back in the traveller app, reload the place the
   Spotter confirmed: the tier changed from unconfirmed to verified because a
   local actually went there during the recording. That is the whole product
   in one take.

## Fallbacks (rehearsed)

- **Model drift on plans.** If a free-typed plan question gets a chatty
  refusal, click a suggestion chip; "Plan my day near the malecón" answered
  3/3 in testing, Spanish "Planifica mi día cerca del malecón" 2/2. The
  refusal itself is presentable: options chips, honest coverage statement.
- **Inference down.** Map, profiles, saves, and the stored itinerary all work
  with no provider. Narrate the browsing path and say planning resumes with
  the provider.
- **Long answers.** Model answers take 20 to 60 seconds locally; keep the
  "Checking with the locals" line on screen, it reads as intentional.
- **Operator code lost.** Request a new code; codes live 10 minutes and work
  once. The panel auto-locks after 30 minutes idle.
- **Showcase lockout.** Five wrong access-code attempts lock both roles for
  15 minutes. The code is `SHOWCASE_ACCESS_CODE` in `apps/api/.env`.

## Honesty lines to keep

- The demo account, cast, posts, and the Casa Rosada operator are simulated
  for this recording; the places, map data, and public information are real
  and sourced per profile.
- Demo-authored hours ride only in business-published posts, labelled as
  business information no Spotter has checked.
- Unconfirmed listings never become pins until two distinct locals confirm,
  which segment 2 demonstrates live.
