#!/usr/bin/env bash
# GUACA redeploy — run on the VM: builds the api image and brings the stack
# up. `pnpm deploy` locally first if you need to ship changes.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> pulling base images"
docker compose -f docker-compose.prod.yml pull

echo "==> building api image"
docker compose -f docker-compose.prod.yml build api

echo "==> starting stack"
docker compose -f docker-compose.prod.yml up -d

echo "==> applying migrations"
docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/migrate-cli.js || true

echo "==> seeding (idempotent)"
docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/seed-cli.js || true

echo "==> done. health:"
docker compose -f docker-compose.prod.yml ps
