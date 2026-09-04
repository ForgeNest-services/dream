#!/bin/bash

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h srota-postgres -U ${POSTGRES_USER} > /dev/null 2>&1; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is ready!"

# Create log file
mkdir -p /var/log
touch /var/log/postgres-backup.log
chmod 666 /var/log/postgres-backup.log

# Create backup script
cat > /usr/local/bin/backup.sh << 'BACKUPSCRIPT'
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/srota-db-${TIMESTAMP}.sql.gz"
LOG_FILE="/var/log/postgres-backup.log"

{
  echo "[$(date)] Starting backup..."

  # Dump all databases and compress
  export PGPASSWORD="${POSTGRES_PASSWORD}"
  if pg_dumpall -h srota-postgres -U ${POSTGRES_USER} 2>/dev/null | gzip > $BACKUP_FILE; then
    BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
    echo "[$(date)] Backup file created: $BACKUP_FILE ($BACKUP_SIZE)"

    # Upload to S3
    if aws s3 cp $BACKUP_FILE s3://${BACKUP_S3_BUCKET}/postgres-backups/ --region ${BACKUP_S3_REGION} 2>&1 | grep -q "Completed"; then
      echo "[$(date)] Successfully uploaded to S3: srota-db-${TIMESTAMP}.sql.gz"
      rm -f $BACKUP_FILE
    else
      echo "[$(date)] ERROR: Failed to upload to S3"
    fi
  else
    echo "[$(date)] ERROR: Backup dump failed"
  fi

  echo "[$(date)] Backup cycle completed"
} >> $LOG_FILE 2>&1
BACKUPSCRIPT

chmod +x /usr/local/bin/backup.sh

# Initial backup if enabled
if [ "${RUN_IMMEDIATELY}" = "true" ]; then
  echo "Running initial backup..."
  /usr/local/bin/backup.sh
  echo "Initial backup completed!"
fi

echo "Backup scheduler started"
echo "Schedule: hourly (top of every hour)"
echo "Log file: /var/log/postgres-backup.log"

last_backup_hour=""

# Simple scheduler loop
while :; do
  current_hour=$(date +%H)
  current_minute=$(date +%M)
  current_time=$(date "+%Y-%m-%d %H:%M:%S")

  # Check if it's minute 0 and we haven't backed up this hour yet
  if [ "$current_minute" = "00" ] && [ "$current_hour" != "$last_backup_hour" ]; then
    echo "[$current_time] Running scheduled backup..."
    /usr/local/bin/backup.sh
    last_backup_hour=$current_hour
  fi

  sleep 30
done
