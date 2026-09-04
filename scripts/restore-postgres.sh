#!/bin/bash
set -euo pipefail

if ! docker ps --format "{{.Names}}" | grep -q "^srota-postgres$"; then
  echo "ERROR: srota-postgres container is not running." >&2
  echo "Run: docker compose up -d postgres minio redis" >&2
  exit 1
fi

BUCKET=$(docker exec srota-postgres printenv BACKUP_S3_BUCKET)
REGION=$(docker exec srota-postgres printenv BACKUP_S3_REGION)
PG_USER=$(docker exec srota-postgres printenv POSTGRES_USER)
PG_DB=$(docker exec srota-postgres printenv POSTGRES_DB)

if [ -z "$BUCKET" ] || [ -z "$REGION" ] || [ -z "$PG_USER" ] || [ -z "$PG_DB" ]; then
  echo "ERROR: srota-postgres is missing BACKUP_S3_BUCKET/BACKUP_S3_REGION/POSTGRES_USER/POSTGRES_DB -- check .env." >&2
  exit 1
fi

S3_PREFIX="s3://${BUCKET}/postgres-backups"
FILENAME="${1:-}"

if [ -z "$FILENAME" ]; then
  echo "No filename given -- finding latest backup in ${S3_PREFIX}/ ..."
  FILENAME=$(docker exec srota-postgres aws s3 ls "${S3_PREFIX}/" --region "$REGION" 2>/dev/null \
    | awk '{print $4}' | sort -r | head -1)
  if [ -z "$FILENAME" ]; then
    echo "ERROR: no backups found in ${S3_PREFIX}/" >&2
    exit 1
  fi
  echo "Latest backup: $FILENAME"
fi

REMOTE_TMP="//tmp/${FILENAME}"

echo "Downloading ${S3_PREFIX}/${FILENAME} ..."
docker exec srota-postgres aws s3 cp "${S3_PREFIX}/${FILENAME}" "$REMOTE_TMP" \
  --region "$REGION" --only-show-errors

if ! docker exec srota-postgres test -f "$REMOTE_TMP"; then
  echo "ERROR: download did not land at $REMOTE_TMP inside the container -- aborting." >&2
  exit 1
fi

echo "Restoring into postgres (this replays every CREATE ROLE / CREATE DATABASE / INSERT in the dump) ..."
if ! docker exec srota-postgres sh -c \
  "export PGPASSWORD=\"\$POSTGRES_PASSWORD\"; gunzip -c '$REMOTE_TMP' | psql -h srota-postgres -U ${PG_USER} -d postgres -v ON_ERROR_STOP=0"
then
  echo "ERROR: restore command failed -- see psql output above." >&2
  docker exec srota-postgres rm -f "$REMOTE_TMP"
  exit 1
fi

docker exec srota-postgres rm -f "$REMOTE_TMP"

echo "Verifying: checking for a real table in the restored database ..."
TABLE_COUNT=$(docker exec srota-postgres sh -c \
  "export PGPASSWORD=\"\$POSTGRES_PASSWORD\"; psql -h srota-postgres -U ${PG_USER} -d ${PG_DB} -tAc \"select count(*) from information_schema.tables where table_schema='public'\"" 2>/dev/null || echo "0")

if [ "${TABLE_COUNT:-0}" -eq 0 ] 2>/dev/null; then
  echo "WARNING: restore ran but the target database has 0 public tables --" >&2
  echo "this may mean the dump restored into a different database name than" >&2
  echo "expected, or genuinely failed. Check manually before proceeding:" >&2
  echo "  docker exec srota-postgres psql -U ${PG_USER} -d postgres -c '\\l'" >&2
  exit 1
fi

echo "Verified: restored database has ${TABLE_COUNT} table(s) in the public schema."
echo "Done. Restored: ${FILENAME}"
echo "Next: run scripts/restore-minio.sh, then scripts/restore-wal.sh if needed, then docker compose up -d --build"
