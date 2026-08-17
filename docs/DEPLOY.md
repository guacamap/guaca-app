# Deployment

## Topology

```
Play app (webview) ──┐
Tourist phone ──QR───┼─▶ apps/app (Vercel) ──┐
Spotter phone ───────┘                       ├─▶ apps/api (VM, Docker)
Visitors ────────────▶ apps/web (Vercel) ────┤          │
Operator laptop ─────▶ packages/cli ─────────┘          ▼
                                          Postgres (PostGIS + h3), MinIO
                                                         │
                                                         ▼
                                         INFERENCE_BASE_URL (OpenAI-compatible)
                                         → vLLM / Qwen3-VL-8B on Nebius L40S
                                         → MiniMax-M3 (fallback, one env var)
```

## Environments (§4.3)

| | local | staging | production |
|---|---|---|---|
| web (marketing) | `next dev` :3000 | `staging.guaca.live` — Vercel project 1, branch `main` | `guaca.live` — Vercel project 1, branch `production` |
| app (product) | `next dev` :3002 | `staging.app.guaca.live` — Vercel project 2, branch `main` | `app.guaca.live` — Vercel project 2, branch `production` |
| api | `tsx watch` :3001 | `staging.api.guaca.live` — same VM, compose project `guaca-staging` | `api.guaca.live` — compose project `guaca-prod` |
| data | docker compose | own DB + MinIO bucket on VM | own DB + MinIO bucket on VM |
| inference | FakeInference (tests) or shared endpoint | shared L40S or MiniMax — never a 2nd GPU | L40S, MiniMax failover |
| email codes | always `000000` (dev bypass; also logged) | printed to ops stream | Resend — REQUIRED (bypass is structurally off in production) |
| Mapbox token | `guaca-dev` (unrestricted, .env.local only) | `guaca-web-prod` (staging URL in list) | `guaca-web-prod` (URL-restricted) |

**Promote:** PR → CI green → merge `main` (auto-staging) → rehearse →
`git push origin main:production`. Each tier's deploy runs `pnpm migrate`
on its own DB; migrations are forward-only. Rehearsals never run against
prod — the prod `loop_events` timeline must stay clean for the demo.

## Inference — Qwen3-VL-8B on a Nebius L40S

Provision a **single L40S** (~48 GB). Do NOT provision an H200 — the 8B model
cannot use 141 GB and it costs ~2.9× more. The L40S is the vendor-recommended
single-GPU choice for 8B-class models; this decision is part of the
compute-efficiency pitch.

### Serving command

Verified requirements:

- `vllm>=0.11.0` (Qwen3-VL support landed there)
- `qwen-vl-utils==0.0.14`
- **`--max_model_len` is mandatory.** The model advertises a 256k context;
  without this flag vLLM aborts because the KV cache cannot hold it.

```bash
pip install "vllm>=0.11.0" qwen-vl-utils==0.0.14

vllm serve Qwen/Qwen3-VL-8B-Instruct \
  --dtype bfloat16 \
  --max_model_len 16384 \
  --max-num-batched-tokens 16384 \
  --guided-decoding-backend xgrammar
```

`--guided-decoding-backend xgrammar` is the forward-compatible path;
`extra_body.guided_json` is deprecated. No `--trust-remote-code` needed.

### Verify with one image

```bash
curl http://<l40s-host>:8000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "Qwen/Qwen3-VL-8B-Instruct",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe this place."},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
      ]
    }],
    "max_tokens": 200
  }'
```

### MiniMax-M3 failover (one line)

The fallback is the same OpenAI-compatible client, switched by
`INFERENCE_BASE_URL` alone:

```bash
INFERENCE_BASE_URL=https://api.minimax.io/v1
```

Agents never know which provider is behind the env var. Constrained decoding
is an optimisation, not the guarantee — the anti-hallucination guard (§7.3)
does not depend on provider capability.

## Production compose

The VM runs three compose projects:

- `guaca-edge` — `docker-compose.edge.yml`: one Caddy terminating TLS for
  both tiers, proxying over the external `guaca-edge` docker network.
- `guaca-prod` / `guaca-staging` — the same `docker-compose.prod.yml`
  instantiated twice with different env files (`infra/env/prod.env`,
  `infra/env/staging.env`). Volumes and DBs are namespaced per project;
  Caddy reaches each tier's api by its network alias
  (`guaca-prod-api` / `guaca-staging-api`, set via `EDGE_ALIAS`).

`apps/web` and `apps/app` deploy to Vercel pointing at the API domains.

### VM bring-up (NoInfra or any Ubuntu/Debian box)

```bash
# 1. docker + compose plugin
curl -fsSL https://get.docker.com | sh

# 2. code + secrets
git clone <repo> guaca && cd guaca
cp infra/env/edge.env.example    infra/env/edge.env      # domains + ACME email
cp infra/env/prod.env.example    infra/env/prod.env      # fill: openssl rand -hex 32
cp infra/env/staging.env.example infra/env/staging.env   # DIFFERENT secrets than prod

# 3. DNS first (Caddy needs it to issue certs):
#    api.guaca.live + staging.api.guaca.live → A record → VM IP

# 4. bring up
./infra/deploy.sh edge
./infra/deploy.sh prod
SEED=1 ./infra/deploy.sh staging   # staging gets demo data; prod stays clean
```

Migrations run automatically at the end of each tier deploy
(`packages/db/dist/migrate-cli.js`, forward-only), followed by the
reference geography seed (idempotent — the pilot area and its zones, which
the loop needs). `SEED=1` additionally installs the **demo** spotters and
villas, so use it on staging only.

### Verify from a phone

After deploying, scan the QR with a phone **on cellular data** (not the
laptop's WiFi): PWA camera + geolocation require HTTPS, and cellular proves
the public URLs resolve. If no domain is available, use `sslip.io` with Caddy
for automatic TLS:

```
Caddyfile: api.<ip>.sslip.io
```

**Auth caveat:** `sslip.io` is fine for testing the API alone, but cookie
auth (spotter + tourist) requires web and API to be **same-site** — one
registrable domain with `app.` and `api.` subdomains. A `vercel.app` web +
`sslip.io` API is cross-site, and Safari/iOS blocks cross-site cookies.
The project domain is **`guaca.live`** (chosen 2026-08-08): `app.` /
`api.` / `staging.app.` / `staging.api.`, apex redirects to `app.`.

## Operating production

The operator CLI ships inside the API image, so day-to-day oversight runs
on the VM against the production database:

```bash
cd guaca
dc() { docker compose -p guaca-prod --env-file infra/env/prod.env -f docker-compose.prod.yml "$@"; }

dc exec -e OPERATOR_TOKEN=$OPERATOR_TOKEN api node packages/cli/dist/index.js audit --narrative
dc exec -e OPERATOR_TOKEN=$OPERATOR_TOKEN api node packages/cli/dist/index.js spotter add "María Fernanda" "+58 412 ..."
dc exec -e OPERATOR_TOKEN=$OPERATOR_TOKEN api node packages/cli/dist/index.js commission --approve <gapId>
dc exec -e OPERATOR_TOKEN=$OPERATOR_TOKEN api node packages/cli/dist/index.js posts reported
dc exec -e OPERATOR_TOKEN=$OPERATOR_TOKEN api node packages/cli/dist/index.js registrations list
```

A fresh production database has the pilot area and zones but **no spotters
and no villas** — those are real people and businesses, added once they have
agreed. One at a time with `spotter add` / `property add`, or in bulk from a
spreadsheet (the waitlist form exports one):

```bash
guaca spotter  import roster.csv  --area <areaId>            # preview
guaca spotter  import roster.csv  --area <areaId> --apply    # write
guaca property import villas.csv  --area <areaId> --apply
```

Import is preview-first and skips duplicates by phone (spotters) or name
(properties) — these rows are real people, and a mistyped phone is a Spotter
who can never log in.

## Backups

The irreplaceable thing here is the verification record — who stood where,
which photos proved it, which second local confirmed. Places can be
re-imported from OpenStreetMap; a spotter's paid work cannot be redone.

```bash
./infra/backup.sh prod        # database dump + photo objects, one timestamp
```

Keeps 14 days by default (`BACKUP_KEEP_DAYS`). Nightly via cron on the VM:

```
15 4 * * *  cd /root/guaca && ./infra/backup.sh prod >> /var/log/guaca-backup.log 2>&1
```

**Restore is printed by the script itself** and has been exercised: on a test
stack the entire schema was dropped and the dump brought back all 27 tables,
the reference geography and the migration history. A backup nobody has
restored is not a backup — re-run that drill after any schema change.

Copy the `backups/` directory off the VM regularly; a backup on the same disk
does not survive the failure it exists for.

## Redeploy

`./infra/deploy.sh prod` (or `staging`) — pulls bases, rebuilds the api
image, `up -d`, migrates, prints health. `./infra/deploy.sh edge` only when
the Caddyfile or domains change. See T2.5 for the CI hook.

## Local dev with real inference

Copy `apps/api/.env.example` to `apps/api/.env` and fill `INFERENCE_*`;
`pnpm dev` picks it up via node's `--env-file-if-exists`. The CLI reads the
same vars from the shell: `set -a; . apps/api/.env; set +a`.
