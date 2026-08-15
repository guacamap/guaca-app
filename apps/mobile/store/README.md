# Play Store assets

Everything the Play Console listing needs, generated from the running app.

| File | Use | Play requirement |
|---|---|---|
| `listing-icon-512.png` | Store listing icon | 512×512, 32-bit PNG **with alpha** — `apps/mobile/assets/icon.png` is RGB with no alpha and will be rejected, so this copy of the brand icon is the one to upload |
| `feature-graphic.png` | Feature graphic | 1024×500, no alpha ✓ |
| `01-map` … `08-spotter-profile.png` | Phone screenshots | 1080×1920, min 2 / max 8. Upload at least: map, place, guaca, refusal, spotter-profile |
| `feature-graphic.html` | Source for the graphic | edit + re-render (see below) |
| `generate-screenshots.mjs` | Re-render screenshots | see below |

## Regenerating

Screenshots come from the real app, so they must never be mocked up. With
the dev servers running (`pnpm dev`) and seeded data present:

```bash
D=apps/mobile/store node apps/mobile/store/generate-screenshots.mjs
```

Feature graphic:

```bash
node -e "..." # or open feature-graphic.html at 1024x500 and screenshot
```

## Before uploading

The screenshots currently show `[DEV]` suffixes on seeded places. **Re-shoot
against production data** once real verified places exist — a listing showing
"[DEV]" reads as unfinished.
