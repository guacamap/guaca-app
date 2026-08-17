#!/usr/bin/env bash
# GUACA backup — run on the VM, by cron or by hand.
#
#   ./infra/backup.sh prod        # dump prod
#   ./infra/backup.sh staging     # dump staging
#
# What is actually irreplaceable here is the VERIFICATION RECORD: who stood
# where, which photos proved it, and which second local confirmed. Places can
# be re-imported from OpenStreetMap; a spotter's paid work cannot be redone.
# So this dumps the database AND mirrors the photo objects, together, with a
# matching timestamp so a restore is coherent.
set -euo pipefail

cd "$(dirname "$0")/.."

TIER="${1:-prod}"
ENV_FILE="infra/env/${TIER}.env"
[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE"; exit 1; }
# Read values WITHOUT sourcing: env files legitimately contain characters a
# shell would interpret (EMAIL_FROM="Guaca <login@guaca.live>" redirects).
envget() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1 | sed 's/^"//;s/"$//'; }
POSTGRES_USER="$(envget POSTGRES_USER)"; POSTGRES_USER="${POSTGRES_USER:-guaca}"
S3_ACCESS_KEY="$(envget S3_ACCESS_KEY)"
S3_SECRET_KEY="$(envget S3_SECRET_KEY)"
S3_BUCKET="$(envget S3_BUCKET)"; S3_BUCKET="${S3_BUCKET:-guaca-photos}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="backups/${TIER}/${STAMP}"
mkdir -p "$OUT"

dc() { docker compose -p "${COMPOSE_PROJECT:-guaca-${TIER}}" --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"; }

echo "==> [$TIER] dumping database"
# --clean --if-exists so the dump restores onto a non-empty database too.
dc exec -T postgres pg_dump -U "${POSTGRES_USER:-guaca}" -d guaca --clean --if-exists \
  | gzip -9 > "${OUT}/guaca.sql.gz"

echo "==> [$TIER] mirroring photo objects"
# mc lives inside the MinIO image; mirror to a tar we control rather than
# depending on the volume surviving.
dc exec -T minio sh -c "
  mc alias set local http://localhost:9000 '${S3_ACCESS_KEY}' '${S3_SECRET_KEY}' >/dev/null 2>&1 &&
  mc mirror --quiet --overwrite local/'${S3_BUCKET:-guaca-photos}' /tmp/backup >/dev/null 2>&1 || true
  tar -C /tmp -cf - backup 2>/dev/null" > "${OUT}/photos.tar" || echo "   (no photos yet)"

echo "==> [$TIER] pruning backups older than ${BACKUP_KEEP_DAYS} days"
find "backups/${TIER}" -mindepth 1 -maxdepth 1 -type d -mtime "+${BACKUP_KEEP_DAYS}" -exec rm -rf {} + 2>/dev/null || true

du -sh "$OUT"
echo "==> done: $OUT"
echo
echo "Restore (destructive — read before running):"
echo "  gunzip -c ${OUT}/guaca.sql.gz | docker compose -p guaca-${TIER} --env-file ${ENV_FILE} \\"
echo "    -f docker-compose.prod.yml exec -T postgres psql -U ${POSTGRES_USER:-guaca} -d guaca"
