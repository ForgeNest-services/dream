FROM postgres:15-alpine

RUN apk add --no-cache aws-cli bash

COPY archive-wal.sh /usr/local/bin/archive-wal.sh
RUN chmod +x /usr/local/bin/archive-wal.sh
