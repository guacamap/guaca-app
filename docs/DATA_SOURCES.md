# GUACA — Data sources, models and tools

| Source | Use | Licence / note |
|---|---|---|
| OpenStreetMap (Overpass API) | Candidate places for the pilot area — imported as `osm_candidate`/`candidate`, NEVER tourist-visible, promoted only by real Spotters | ODbL — attribution required |
| Qwen3-VL-8B-Instruct (vLLM on Nebius L40S) | Schema-only JSON + single-call vision verification | Apache-2.0 weights |
| MiniMax-M3 | Fallback provider — switched by `INFERENCE_BASE_URL` alone | provider terms |
| LangGraph.js / plain-TS runner | Agent orchestration and interrupt() semantics | MIT |
| PostGIS 3.4 + h3 | Geography, distance, cluster keys | GPL/BSD-licensed extensions |
| Mapbox GL JS | Tourist map basemap + rendering (was MapLibre + OSM raster tiles, changed 2026-08-08) | proprietary ToS; token, free tier; URL-restricted |
| Fastify + WebSockets | API and live ops stream | MIT |
| sharp / sharp-phash | Photo hashing (sha256 + 64-bit pHash) | Apache-2.0 |
| Reloadly (planned, NOT wired) | Airtime top-up payouts for Spotters | provider terms; MVP uses MockPayoutProvider |
| Open-Meteo (wired 2026-08-19) | Area weather forecast modulating trend scores and category recommendations — coordinates only, no user data | CC-BY 4.0; free, keyless; `WEATHER_ENABLED` kill switch, degrades to weather-free |

**Attribution.** OpenStreetMap data (Overpass candidates) is
© OpenStreetMap contributors, used under the ODbL. Basemap attribution is
rendered by Mapbox GL (© Mapbox © OpenStreetMap).

**Inference transparency.** Agents never know which provider is behind
`INFERENCE_BASE_URL`; constrained decoding is an optimisation, not the
guarantee — the anti-hallucination guard does not depend on provider
capability.
