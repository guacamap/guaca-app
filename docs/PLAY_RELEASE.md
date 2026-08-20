# Google Play — closed testing runbook

Package: **live.guaca.app** (permanent — it can never be reused once
uploaded). Artifact: the Expo wrapper in `apps/mobile`, which loads the
product web app at `app.guaca.live`.

## After deploying, before announcing anything

```bash
./infra/smoke.sh https://api.guaca.live https://app.guaca.live https://guaca.live
```

Checks TLS, the API, the three pages Play requires, that the dev sign-in
bypass is closed in production, and that session cookies are Secure. Exits
non-zero, so it can gate the release.

## Two different finish lines — do not confuse them

| | What it needs | Who can install | When |
|---|---|---|---|
| **Closed test** (what the buildathon needs) | An uploaded build + an opt-in link | Anyone you send the link to, **immediately** | Day 0 |
| **Production** (public Play listing) | 12 testers × 14 consecutive days, then Google review | Everyone | ~3 weeks later |

The 12-testers/14-days rule gates **production only**. A closed test is a real
Play install from the real store the day the build lands — judges click the
opt-in link and install. Nothing about the buildathon requires a public
listing.

Working back from **31 August**:

- **Today** — create the Play developer account. Identity verification takes
  2–5 business days and blocks every upload, so this is the true critical
  path, ahead of any code.
- **Today/tomorrow** — deploy the API + web apps (the app is a shell without
  them).
- **~Day 3** — first EAS build uploaded to the closed track; the opt-in link
  starts working. **This is the deliverable for judging.**
- **In parallel** — 12 testers opt in and the 14-day clock runs on its own.
- **~2 weeks after that** — apply for production access; public listing lands
  in early September.

Recruit the 12 from people who actually exist around this project — teammates,
pilot spotters, villa owners. Paid tester farms exist, but Google has been
removing apps that used them, and you have real testers by design.

## The dependency chain

The wrapper is a shell. It shows a real app only if this is live:

```
Play closed test  →  app.guaca.live (Vercel)  →  api.guaca.live (VM)  →  Postgres/MinIO
                                                        └→ inference (Nebius/MiniMax)
```

So the order is: **deploy the API → deploy the web apps → build the AAB →
upload**. A build uploaded before the API exists installs and opens to an
offline screen.

## Account-holder actions (only Rob can do these)

| # | Action | Blocks |
|---|--------|--------|
| 1 | ~~Play Console developer account — $25~~ **paid 2026-08-18**; identity verification runs 2–5 business days in the background | everything |
| 2 | Provision the VM (NoInfra VPS or Nebius), point DNS: `api.`, `staging.api.` → VM; `app.`, `staging.app.`, apex → Vercel | the app working at all |
| 3 | Run `./infra/deploy.sh edge && ./infra/deploy.sh prod` on the VM (see DEPLOY.md) | API |
| 4 | Vercel: project 1 root `apps/web` → guaca.live; project 2 root `apps/app` → app.guaca.live, with the env vars below | web apps |
| 5 | Resend account + verify `guaca.live` domain (SPF/DKIM) → set `RESEND_API_KEY`, `EMAIL_FROM` in `infra/env/prod.env` | real users can log in |
| 6 | Set `REVIEW_EMAIL`, `REVIEW_CODE`, `REVIEW_SPOTTER_PHONE` in `infra/env/prod.env` | Play review sign-in |
| 7 | `eas login` then `eas build -p android --profile production` | the AAB |
| 8 | Recruit **12 testers** and keep the closed test running **14 days** before production is possible (personal accounts only; a closed test link works for judges immediately) | production track |

### Vercel env vars for `apps/app` (the product app)

| Variable | Value | If missing |
|---|---|---|
| `API_PROXY_TARGET` | `https://api.guaca.live` | **every API call proxies to localhost and the app is dead** — this is the one that must not be forgotten |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | the URL-restricted `guaca-web-prod` token | no map tiles |
| `NEXT_PUBLIC_LANDING_URL` | `https://guaca.live` | privacy/terms/delete links point at the wrong host |
| `NEXT_PUBLIC_APP_URL` | `https://app.guaca.live` | WhatsApp shares link to the wrong host |
| `NEXT_PUBLIC_QR_BASE_URL` | `https://app.guaca.live` | printed villa QR cards point at the wrong host |
| `NEXT_PUBLIC_OPERATOR_WHATSAPP` | operator number, digits only | the spotter "contact operator" row is hidden (optional) |

The app proxies `/api/*` through Next rewrites, so the browser only ever
talks to `app.guaca.live` — cookies stay same-origin and no CORS applies
to the app. `WEB_ORIGIN` on the API still matters for the marketing site's
delete-account flow.

## Store listing

**App name:** Guaca
**Short description (80):**
`Caribbean places verified in person by locals. No invented recommendations.`

**Full description:**

```
Guaca is a live map of the Caribbean where every place was physically
visited, photographed and confirmed by a named local person.

Ask Guaca anything — where to eat arepas near the malecón, which beach is
best this afternoon, how to plan your day. The answer is built only from
places locals have verified on the ground.

And when nobody has checked yet, Guaca tells you the truth: "no one has
verified places for that yet". Your question then commissions a paid
mission for a local Spotter, who goes, photographs the place, and a second
local confirms it. Days later it is on the map — with their name on it.

• A map where every pin carries the name of the person who stood there
• AI plans and answers grounded only in verified places — it cannot invent
• Save places, build a plan, share it over WhatsApp
• Read what locals say, including their Reels and TikToks
• Spotters earn points for verified missions and climb a monthly ranking

Piloting in Puerto Cabello, Venezuela. Coverage grows where travellers ask.
```

**Category:** Travel & Local · **Content rating:** everyone (UGC present —
declare the moderation mechanism) · **Contains ads:** no · **In-app
purchases:** no.

**Assets** — all in `apps/mobile/store/` (see its README): 1024×500 feature
graphic, eight 1080×1920 phone screenshots, and a 512×512 listing icon **with
alpha** (`apps/mobile/assets/icon.png` is RGB with no alpha and would be
rejected). Re-shoot the screenshots against production data before uploading —
the current set shows `[DEV]` place names.

## Data safety form (answer truthfully — this matches the code)

| Question | Answer |
|---|---|
| Collects personal info? | Yes |
| Email address | Collected, for account management (sign-in codes). Not shared. Required. Deletable. |
| Phone number | Spotters only, collected by the operator off-app for account management. |
| Photos | Collected (spotter verification photos, profile photo). Not shared. |
| Location | Collected — precise, only while verifying a place and to show nearby places. Not shared with third parties for ads. |
| User-generated content | Collected (tips, links, ratings). Displayed publicly in the app. |
| Data encrypted in transit? | Yes (TLS via Caddy) |
| Users can request deletion? | Yes — travellers in app (Profile → Delete my account) and at `guaca.live/delete-account`; spotter accounts are operator-issued and deleted on request to hola@guaca.live (stated in the privacy policy) |
| Approximate location | Also declare it — `ACCESS_COARSE_LOCATION` is in the manifest |
| Data shared with third parties? | No. Processors only: Mapbox (map tiles), Resend (email), the inference provider (question text and verification photos). |

## Policy notes

- **Privacy policy URL:** `https://guaca.live/privacy` (bilingual, live in `apps/web`).
- **Terms:** `https://guaca.live/terms`.
- **Account deletion URL:** `https://guaca.live/delete-account` — Play
  requires both an in-app path and a public web URL; both exist.
- **User-generated content:** posts and social links are user content, so
  Play expects a moderation mechanism. Every post carries a Report control;
  two distinct reporters auto-hide a post, and operators review the queue
  with `guaca posts reported` / `posts hide` / `posts show`.
- **WebView policy:** Play rejects pure website wrappers. The wrapper adds
  native camera and geolocation permission handling for the verification
  flow, hardware back-navigation, an offline state, and same-origin
  containment. Worth stating in the review notes.

## Review instructions (paste into "App access")

**The real values live only in `/root/guaca/infra/env/prod.env` on the API
server — never in this repository, which is public.** Anyone holding them can
sign in as the review tourist and the review spotter. Read them with:

```bash
ssh root@<api-server> "grep '^REVIEW_' /root/guaca/infra/env/prod.env"
```


```
Guaca requires an account. Use this test traveller account:

Email: <REVIEW_EMAIL>
Code:  <REVIEW_CODE>   (enter this when asked for the 6-digit code)

Steps: open the app → choose "Tourist" → enter the email above → the app
asks for a 6-digit code → enter the code above → the map opens.

To see the Spotter side: open the app → "Spotter" → phone
<REVIEW_SPOTTER_PHONE> → same code.

Spotter accounts are issued by our operators; there is no public signup,
which is why we supply the credentials above.
```

## App Links (villa QR codes)

`apps/mobile/app.json` declares an `autoVerify` intent filter for
`app.guaca.live/v/*`, so a scanned villa QR opens the app instead of Chrome.
Android only trusts it once `https://app.guaca.live/.well-known/assetlinks.json`
serves the signing-key fingerprint. After the first EAS build:

```bash
eas credentials -p android          # copy the SHA-256 fingerprint
```

Then add `apps/app/public/.well-known/assetlinks.json`:

```json
[{"relation":["delegate_permission/common.handle_all_urls"],
  "target":{"namespace":"android_app","package_name":"live.guaca.app",
            "sha256_cert_fingerprints":["<FINGERPRINT>"]}}]
```

Until that file exists the links simply open in the browser — no breakage.

## Remaining work before the closed test

1. **DNS records — the top blocker (verified 2026-08-20).** `guaca.live`
   resolves and serves (privacy/terms now return 200 — the old 404 note is
   fixed), but **`app.guaca.live` and `api.guaca.live` have no A/CNAME
   records at all** — the product app and the API are unreachable until the
   DNS provider gets the records from the table below. Only the account
   holder can do this.
2. Verify on a physical Android phone over HTTPS: camera capture and
   geolocation inside the WebView (they cannot be tested over plain-HTTP LAN).
3. `assetlinks.json` above, after the first build produces a fingerprint.
4. Re-shoot store screenshots once production has non-`[DEV]` places.

## Known limitations (fine for a closed beta, worth naming)

- **Co-located pins.** Two places at identical coordinates render on top of
  each other and only the upper one is tappable. Seeded demo data does this;
  real verifications will not, but a de-collision offset is still owed.
- **Mission pins sit at the h3 cell centre**, which for the current pilot cell
  falls in the harbour. The cell is the demand area, not the exact spot —
  drawing the cell outline instead of a point would read better.
- **The points store is a catalogue.** Redeem is inert by design and says so;
  redemption needs a fulfilment provider.
- **"Local updates" is device-local demo state**, now labelled a pilot
  preview. It has no API behind it.
- **A question naming another city can still answer locally** when its words
  hit the deterministic lexicon — "where should I eat in Caracas" returns a
  Puerto Cabello place, because "eat" short-circuits before the model sees
  the question. Unrecognised phrasings that name a distant place *are*
  refused. Closing the gap fully means a model call on every question, which
  would give up the zero-inference fast path that serves most answers.
- **Contrast.** Several primary controls sit at ~4.1–4.2:1 against their
  background (white on `--guaca-teal`, coral-dark on white) — just under the
  4.5:1 WCAG AA threshold for normal text. Fixing it means moving brand
  colours, so it is a deliberate deferral, not an oversight.
