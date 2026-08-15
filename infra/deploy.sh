#!/usr/bin/env bash
# GUACA deploy — run on the VM.
#   ./infra/deploy.sh edge      # shared Caddy (once; re-run on Caddyfile changes)
#   ./infra/deploy.sh prod      # app stack, project guaca-prod
#   ./infra/deploy.sh staging   # app stack, project guaca-staging
# Each tier reads infra/env/<tier>.env (copy from the .example next to it).
# Seeding demo data is opt-in: SEED=1 ./infra/deploy.sh staging
set -euo pipefail

cd "$(dirname "$0")/.."

TIER="${1:-prod}"

docker network inspect guaca-edge >/dev/null 2>&1 || docker network create guaca-edge

if [[ "$TIER" == "edge" ]]; then
  ENV_FILE="infra/env/edge.env"
  [[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE — copy ${ENV_FILE}.example and fill it"; exit 1; }
  # --force-recreate: the Caddyfile is a bind mount, so its contents are not
  # part of the compose config hash — a plain `up -d` would keep the old
  # container (and Caddy only reads config at startup).
  docker compose -p guaca-edge --env-file "$ENV_FILE" -f docker-compose.edge.yml up -d --force-recreate
  docker compose -p guaca-edge -f docker-compose.edge.yml ps
  exit 0
fi

if [[ "$TIER" != "prod" && "$TIER" != "staging" ]]; then
  echo "usage: infra/deploy.sh [edge|prod|staging]"
  exit 1
fi

ENV_FILE="infra/env/${TIER}.env"
[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE — copy ${ENV_FILE}.example and fill it"; exit 1; }

dc() { docker compose -p "guaca-${TIER}" --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"; }

echo "==> [$TIER] pulling base images"
dc pull postgres redis minio

echo "==> [$TIER] building api image"
dc build api

echo "==> [$TIER] starting stack"
dc up -d

echo "==> [$TIER] applying migrations"
dc exec -T api node packages/db/dist/migrate-cli.js

if [[ "${SEED:-0}" == "1" ]]; then
  echo "==> [$TIER] seeding demo data (SEED=1)"
  dc exec -T api node packages/db/dist/seed-cli.js
fi

echo "==> [$TIER] health"
dc ps
