# Google Play — closed testing runbook

Package: **live.guaca.app** (permanent — it can never be reused once
uploaded). Artifact: the Expo wrapper in `apps/mobile`, which loads the
product web app at `app.guaca.live`.

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
| 1 | Play Console developer account — $25 one-time, identity verification can take days | everything |
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

**Screenshots** — generate fresh from the running app at 1080×1920 with
`scratchpad/shot-play.mjs`; the strongest five are map, place sheet with
the verifying local, Guaca answer, the refusal card, spotter profile.
A 1024×500 feature graphic is still **missing** and must be designed.

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
| Users can request deletion? | Yes — in app (Profile → Delete my account) and at `guaca.live/delete-account` |
| Data shared with third parties? | No. Processors only: Mapbox (map tiles), Resend (email), the inference provider (question text and verification photos). |

## Policy notes

- **Privacy policy URL:** `https://guaca.live/privacy` (bilingual, live in `apps/web`).
- **Terms:** `https://guaca.live/terms`.
- **Account deletion URL:** `https://guaca.live/delete-account` — Play
  requires both an in-app path and a public web URL; both exist.
- **User-generated content:** posts and social links are user content, so
  Play expects a moderation mechanism. `place_posts.status` supports
  hiding, but there is **no report button in the app and no operator
  command yet** — see "Remaining work".
- **WebView policy:** Play rejects pure website wrappers. The wrapper adds
  native camera and geolocation permission handling for the verification
  flow, hardware back-navigation, an offline state, and same-origin
  containment. Worth stating in the review notes.

## Review instructions (paste into "App access")

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

## Remaining work before the closed test

1. Feature graphic 1024×500 (designer asset, not code).
2. Content reporting: a "report" action on posts + an operator command to
   hide them (`place_posts.status = 'hidden'` already exists).
3. Verify the real device flow once deployed: camera capture and
   geolocation inside the WebView on a physical Android phone over HTTPS.
