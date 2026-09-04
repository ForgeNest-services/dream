#!/bin/bash
set -euo pipefail

if ! docker ps --format "{{.Names}}" | grep -q "^srota-postgres$"; then
  echo "ERROR: srota-postgres container is not running." >&2
  echo "Run: docker compose up -d postgres minio redis" >&2
  exit 1
fi

BUCKET=$(docker exec srota-postgres printenv BACKUP_S3_BUCKET)
REGION=$(docker exec srota-postgres printenv BACKUP_S3_REGION)

if [ -z "$BUCKET" ] || [ -z "$REGION" ]; then
  echo "ERROR: srota-postgres is missing BACKUP_S3_BUCKET/BACKUP_S3_REGION -- check .env." >&2
  exit 1
fi

S3_PREFIX="s3://${BUCKET}/wal-archive"

SEGMENT_COUNT=$(docker exec srota-postgres aws s3 ls "${S3_PREFIX}/" --region "$REGION" 2>/dev/null | wc -l || true)

if [ "$SEGMENT_COUNT" -eq 0 ]; then
  echo "No WAL segments found in ${S3_PREFIX}/ -- WAL archiving was likely"
  echo "off (WAL_ARCHIVE_ENABLED=off) before the disaster. Nothing to replay."
  echo "This is expected if you only rely on hourly pg_dumpall backups; skipping."
  exit 0
fi

echo "Found ${SEGMENT_COUNT} WAL segment(s) in ${S3_PREFIX}/."
echo ""
echo "Downloading segments into a local restore staging directory ..."
STAGE_DIR="/tmp/wal-restore-staging"
docker exec srota-postgres mkdir -p "$STAGE_DIR"
docker exec srota-postgres aws s3 sync "${S3_PREFIX}/" "$STAGE_DIR" --region "$REGION" --only-show-errors

echo "Writing recovery.signal and restore_command ..."
docker exec -u postgres srota-postgres sh -c \
  "touch /var/lib/postgresql/data/recovery.signal && \
   echo \"restore_command = 'cp ${STAGE_DIR}/%f %p'\" >> /var/lib/postgresql/data/postgresql.auto.conf"

echo "Restarting postgres to begin WAL replay ..."
docker restart srota-postgres

echo "Done. Postgres will replay all available WAL segments on startup and"
echo "automatically exit recovery mode once complete -- check 'docker logs"
echo "srota-postgres' for 'database system is ready to accept connections'."
echo "Next: docker compose up -d --build"
