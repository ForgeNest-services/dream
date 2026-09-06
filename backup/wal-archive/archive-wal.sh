#!/bin/bash
# Called by Postgres itself (archive_command) once per completed WAL
# segment. %p (full path) and %f (bare filename) are passed as $1/$2 by
# Postgres — see postgresql.conf's archive_command in docker-compose.yml.
#
# Exit 0 ONLY on confirmed upload success — Postgres will not recycle/
# remove the local WAL segment until this command reports success, and
# will keep retrying it if it fails. This is Postgres' own safety net
# against a lost segment, not something this script needs to re-implement.
set -euo pipefail

WAL_PATH="$1"
WAL_FILE="$2"
# PGDATA (the mounted, persistent volume) is the one path this script is
# guaranteed the postgres user can write to — /var/log/postgresql doesn't
# exist and isn't writable by postgres in this image, confirmed live: the
# archiver silently failed on every segment until this was found and fixed.
LOG_FILE="/var/lib/postgresql/data/wal-archive.log"

{
  echo "[$(date)] Archiving WAL segment: $WAL_FILE"
  if aws s3 cp "$WAL_PATH" "s3://${BACKUP_S3_BUCKET}/wal-archive/${WAL_FILE}" --region "${BACKUP_S3_REGION}" --only-show-errors; then
    echo "[$(date)] Successfully archived: $WAL_FILE"
    exit 0
  else
    echo "[$(date)] ERROR: Failed to archive $WAL_FILE — Postgres will retry"
    exit 1
  fi
} >> "$LOG_FILE" 2>&1
