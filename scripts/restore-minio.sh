#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $(pwd) -- run this from the repo root, or restore .env first." >&2
  exit 1
fi

if ! docker ps --format "{{.Names}}" | grep -q "^srota-minio$"; then
  echo "ERROR: srota-minio container is not running." >&2
  echo "Run: docker-compose up -d postgres minio redis" >&2
  exit 1
fi

MODE="${1:-restore-all}"

case "$MODE" in
  restore-all)
    docker-compose run --rm -e MODE=restore-all minio-backup
    ;;
  restore-latest)
    BUCKET="${2:-}"
    if [ -z "$BUCKET" ]; then
      echo "Usage: $0 restore-latest <bucket-name>" >&2
      exit 1
    fi
    docker-compose run --rm -e MODE=restore-latest -e RESTORE_BUCKET="$BUCKET" minio-backup
    ;;
  restore)
    FILE="${2:-}"
    if [ -z "$FILE" ]; then
      echo "Usage: $0 restore <exact-filename>" >&2
      exit 1
    fi
    docker-compose run --rm -e MODE=restore -e RESTORE_FILE="$FILE" minio-backup
    ;;
  list)
    docker-compose run --rm -e MODE=list minio-backup
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    echo "Usage: $0 [restore-all|restore-latest <bucket>|restore <filename>|list]" >&2
    exit 1
    ;;
esac

echo "Done."
echo "Next: run scripts/restore-wal.sh if WAL archiving was enabled, then docker-compose up -d --build"
