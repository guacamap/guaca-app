# GUACA — Data sources, models and tools

| Source | Use | Licence / note |
|---|---|---|
| OpenStreetMap (Overpass API) | Candidate places for the pilot area — imported as `osm_candidate`/`candidate`, NEVER tourist-visible, promoted only by real Spotters | ODbL — attribution required |
| Qwen3-30B-A3B-Instruct (Nebius Token Factory) | Schema-only JSON planning + gap text work | Apache-2.0 weights; verified live 2026-08-19 |
| Qwen2.5-VL-72B-Instruct (Nebius Token Factory) | Single-call L5 vision verification | Apache-2.0 weights; verified live 2026-08-19 |
| MiniMax-M3 (failover, NOT wired) | Blocked: rejects integer-enum json_schema (needs json_object fallback); text-only roster | provider terms |
| LangGraph.js / plain-TS runner | Agent orchestration and interrupt() semantics | MIT |
| PostGIS 3.4 + h3 | Geography, distance, cluster keys | GPL/BSD-licensed extensions |
| Mapbox GL JS | Tourist map basemap + rendering (was MapLibre + OSM raster tiles, changed 2026-08-08) | proprietary ToS; token, free tier; URL-restricted |
| Fastify + WebSockets | API and live ops stream | MIT |
| sharp / sharp-phash | Photo hashing (sha256 + 64-bit pHash) | Apache-2.0 |
| Reloadly (planned, NOT wired) | Airtime top-up payouts for Spotters | provider terms; MVP uses MockPayoutProvider |
| Open-Meteo (wired 2026-08-19; hourly, Marine and Air Quality added 2026-08-29) | Area weather, sea state, UV, sunrise and sunset for trend scores, the planner's day rules and the concierge's "right now" line — coordinates only, no user data | CC-BY 4.0; free for non-commercial use, keyless; subscribe to Standard the month a business pays; `WEATHER_ENABLED` kill switch, degrades to context-free |
| NOAA National Hurricane Center `CurrentStorms.json` (2026-08-29) | Active tropical cyclones; one within 300 km of an area puts Guaca in storm mode (no recommendations, official sources) | US public domain |
| GDACS event list API (2026-08-29) | Floods, earthquakes, tsunami and volcano alerts, same storm mode | Free; acknowledge "Global Disaster Alert and Coordination System, GDACS" |
| Nager.Date (2026-08-29) | Public holidays per country, so Guaca can say businesses may close early | Free, no key |
| DolarAPI `ve.dolarapi.com` (2026-08-29) | Official (BCV) and parallel USD/VES rates, both shown, for Venezuela areas only | Open source, free; fallbacks Cotizave, BCV Today |
| Overture Maps Places (evaluated 2026-08-29; 377 places in the Puerto Cabello box) | Public phone, website and social links for candidate places, shown as public data until a Spotter confirms | CDLA Permissive 2.0 |

**Attribution.** OpenStreetMap data (Overpass candidates) is
© OpenStreetMap contributors, used under the ODbL. Basemap attribution is
rendered by Mapbox GL (© Mapbox © OpenStreetMap).

**Inference transparency.** Agents never know which provider is behind
`INFERENCE_BASE_URL`; constrained decoding is an optimisation, not the
guarantee — the anti-hallucination guard does not depend on provider
capability.
