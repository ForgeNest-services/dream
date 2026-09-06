#!/bin/bash
# Adapted from forge-db's proven minio-backup/backup.sh -- same mc mirror +
# tar approach, swapped from Backblaze B2 to AWS S3 (dream already has a
# tested S3 bucket/credentials for the Postgres backups, see backup/postgres/
# and backup/wal-archive/) and pointed at dream's own single-bucket MinIO
# setup instead of forge-db's multi-tenant one.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date -u '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date -u '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date -u '+%Y-%m-%d %H:%M:%S') - $1"
}

validate_env() {
    local missing=()

    [ -z "$MINIO_ENDPOINT" ] && missing+=("MINIO_ENDPOINT")
    [ -z "$MINIO_ACCESS_KEY" ] && missing+=("MINIO_ACCESS_KEY")
    [ -z "$MINIO_SECRET_KEY" ] && missing+=("MINIO_SECRET_KEY")
    [ -z "$AWS_ACCESS_KEY_ID" ] && missing+=("AWS_ACCESS_KEY_ID")
    [ -z "$AWS_SECRET_ACCESS_KEY" ] && missing+=("AWS_SECRET_ACCESS_KEY")
    [ -z "$BACKUP_S3_BUCKET" ] && missing+=("BACKUP_S3_BUCKET")
    [ -z "$BACKUP_S3_REGION" ] && missing+=("BACKUP_S3_REGION")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing[*]}"
        exit 1
    fi
}

setup_aliases() {
    log_info "Configuring MinIO client..."
    mc alias set minio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 > /dev/null 2>&1
    log_info "MinIO client configured"
}

S3_PREFIX="s3://${BACKUP_S3_BUCKET}/minio-backup"

backup_bucket() {
    local bucket=$1
    local timestamp=$2
    local temp_dir=$(mktemp -d)
    local archive_name="${bucket}_${timestamp}.tar.gz"

    log_info "Backing up bucket: $bucket"

    mkdir -p "$temp_dir/$bucket"

    mc mirror "minio/$bucket" "$temp_dir/$bucket" --quiet 2>/dev/null || true

    local file_count=$(find "$temp_dir/$bucket" -type f 2>/dev/null | wc -l)
    if [ "$file_count" -eq 0 ]; then
        log_warn "Bucket $bucket is empty, skipping"
        rm -rf "$temp_dir"
        return 0
    fi

    tar -czf "$temp_dir/$archive_name" -C "$temp_dir" "$bucket"

    local size=$(du -h "$temp_dir/$archive_name" | cut -f1)
    log_info "Archive created: $archive_name ($size, $file_count files)"

    if aws s3 cp "$temp_dir/$archive_name" "${S3_PREFIX}/" --region "$BACKUP_S3_REGION" --only-show-errors; then
        log_info "Uploaded: $archive_name"
    else
        log_error "Failed to upload: $archive_name"
        rm -rf "$temp_dir"
        return 1
    fi

    rm -rf "$temp_dir"
    return 0
}

run_backup() {
    log_info "Starting MinIO backup..."

    local timestamp=$(date -u +%Y%m%d_%H%M%S)
    local success=0
    local failed=0

    local buckets=$(mc ls minio --json 2>/dev/null | jq -r 'select(.key) | .key' | tr -d '/')

    if [ -z "$buckets" ]; then
        log_warn "No buckets found in MinIO"
        return 0
    fi

    log_info "Found buckets: $(echo $buckets | tr '\n' ' ')"

    for bucket in $buckets; do
        if backup_bucket "$bucket" "$timestamp"; then
            ((success++))
        else
            ((failed++))
        fi
    done

    log_info "Backup completed: $success successful, $failed failed"
    return $failed
}

seconds_until_next_run() {
    local cron_expr="$1"

    python3 -c "
from croniter import croniter
from datetime import datetime, timezone

cron = croniter('$cron_expr', datetime.now(timezone.utc))
next_run = cron.get_next(datetime)
now = datetime.now(timezone.utc)
seconds = int((next_run - now).total_seconds())
print(seconds)
"
}

run_scheduler() {
    local schedule=${BACKUP_SCHEDULE:-"0 * * * *"}
    local run_immediately=${RUN_IMMEDIATELY:-"false"}

    log_info "MinIO Backup Service started"
    log_info "Schedule: $schedule"
    log_info "Target: ${S3_PREFIX}"

    if [ "$run_immediately" = "true" ]; then
        log_info "Running initial backup..."
        run_backup || log_warn "Initial backup had errors"
    fi

    while true; do
        local wait_seconds
        wait_seconds=$(seconds_until_next_run "$schedule")

        if [ -z "$wait_seconds" ] || [ "$wait_seconds" -lt 0 ]; then
            log_error "Failed to calculate next run time, waiting 1 hour"
            wait_seconds=3600
        fi

        local next_run
        next_run=$(date -u -d "@$(($(date +%s) + wait_seconds))" '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || echo "unknown")

        log_info "Next backup scheduled for: $next_run (in ${wait_seconds}s)"

        sleep "$wait_seconds"

        run_backup || log_warn "Backup had errors"
    done
}

list_backups() {
    log_info "Listing available backups in ${S3_PREFIX}..."

    local backups=$(aws s3 ls "${S3_PREFIX}/" --region "$BACKUP_S3_REGION" 2>/dev/null | awk '{print $4}' | sort)

    if [ -z "$backups" ]; then
        log_warn "No backups found"
        return 0
    fi

    echo ""
    echo "Available backups:"
    echo "=================="

    local current_bucket=""
    for backup in $backups; do
        local bucket_name=$(echo "$backup" | sed 's/_[0-9]\{8\}_[0-9]\{6\}\.tar\.gz$//')

        if [ "$bucket_name" != "$current_bucket" ]; then
            current_bucket="$bucket_name"
            echo ""
            echo "[$bucket_name]"
        fi
        echo "  - $backup"
    done
    echo ""
}

restore_backup() {
    local backup_file=$1

    if [ -z "$backup_file" ]; then
        log_error "No backup file specified"
        return 1
    fi

    log_info "Restoring backup: $backup_file"

    local bucket_name=$(echo "$backup_file" | sed 's/_[0-9]\{8\}_[0-9]\{6\}\.tar\.gz$//')

    log_info "Target bucket: $bucket_name"

    local temp_dir=$(mktemp -d)

    log_info "Downloading from S3..."
    if ! aws s3 cp "${S3_PREFIX}/${backup_file}" "$temp_dir/" --region "$BACKUP_S3_REGION" --only-show-errors; then
        log_error "Failed to download backup: $backup_file"
        rm -rf "$temp_dir"
        return 1
    fi

    log_info "Extracting archive..."
    tar -xzf "$temp_dir/$backup_file" -C "$temp_dir"

    if ! mc ls "minio/$bucket_name" > /dev/null 2>&1; then
        log_info "Creating bucket: $bucket_name"
        mc mb "minio/$bucket_name" --quiet 2>/dev/null || true
    fi

    log_info "Uploading to MinIO bucket: $bucket_name"
    local file_count=$(find "$temp_dir/$bucket_name" -type f 2>/dev/null | wc -l)

    if [ "$file_count" -eq 0 ]; then
        log_warn "No files found in backup"
        rm -rf "$temp_dir"
        return 0
    fi

    if mc mirror "$temp_dir/$bucket_name" "minio/$bucket_name" --overwrite --quiet 2>/dev/null; then
        log_info "Restore completed: $file_count files restored to $bucket_name"
    else
        log_error "Failed to restore files to MinIO"
        rm -rf "$temp_dir"
        return 1
    fi

    rm -rf "$temp_dir"
    return 0
}

restore_latest() {
    local bucket_name=$1

    if [ -z "$bucket_name" ]; then
        log_error "No bucket name specified"
        echo "Usage: RESTORE_BUCKET=<bucket_name> MODE=restore-latest"
        return 1
    fi

    log_info "Finding latest backup for bucket: $bucket_name"

    local latest=$(aws s3 ls "${S3_PREFIX}/" --region "$BACKUP_S3_REGION" 2>/dev/null | \
        awk '{print $4}' | \
        grep "^${bucket_name}_" | \
        sort -r | \
        head -1)

    if [ -z "$latest" ]; then
        log_error "No backups found for bucket: $bucket_name"
        return 1
    fi

    log_info "Latest backup: $latest"
    restore_backup "$latest"
}

restore_all() {
    log_info "Restoring all buckets (latest backup for each)..."

    local buckets=$(aws s3 ls "${S3_PREFIX}/" --region "$BACKUP_S3_REGION" 2>/dev/null | \
        awk '{print $4}' | \
        sed 's/_[0-9]\{8\}_[0-9]\{6\}\.tar\.gz$//' | \
        sort -u)

    if [ -z "$buckets" ]; then
        log_error "No backups found"
        return 1
    fi

    local success=0
    local failed=0

    for bucket in $buckets; do
        if restore_latest "$bucket"; then
            ((success++))
        else
            ((failed++))
        fi
    done

    log_info "Restore completed: $success successful, $failed failed"
    return $failed
}

show_help() {
    echo ""
    echo "MinIO Backup Service"
    echo "===================="
    echo ""
    echo "Modes (set via MODE environment variable):"
    echo ""
    echo "  MODE=backup (default)"
    echo "    Run backup scheduler"
    echo ""
    echo "  MODE=list"
    echo "    List all available backups"
    echo ""
    echo "  MODE=restore RESTORE_FILE=<filename>"
    echo "    Restore a specific backup file"
    echo "    Example: MODE=restore RESTORE_FILE=dream-uploads_20260904_154928.tar.gz"
    echo ""
    echo "  MODE=restore-latest RESTORE_BUCKET=<bucket_name>"
    echo "    Restore the latest backup for a specific bucket"
    echo "    Example: MODE=restore-latest RESTORE_BUCKET=dream-uploads"
    echo ""
    echo "  MODE=restore-all"
    echo "    Restore latest backup for ALL buckets"
    echo ""
    echo "  MODE=help"
    echo "    Show this help message"
    echo ""
}

main() {
    local mode=${MODE:-backup}

    case "$mode" in
        backup)
            validate_env
            setup_aliases
            run_scheduler
            ;;
        list)
            validate_env
            setup_aliases
            list_backups
            ;;
        restore)
            validate_env
            setup_aliases
            restore_backup "$RESTORE_FILE"
            ;;
        restore-latest)
            validate_env
            setup_aliases
            restore_latest "$RESTORE_BUCKET"
            ;;
        restore-all)
            validate_env
            setup_aliases
            restore_all
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown mode: $mode"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
