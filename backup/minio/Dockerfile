FROM python:3.12-alpine

LABEL maintainer="Srota"
LABEL description="MinIO bucket backup service to AWS S3"

RUN apk add --no-cache \
    bash \
    curl \
    tar \
    gzip \
    jq \
    coreutils \
    aws-cli

RUN curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc && \
    chmod +x /usr/local/bin/mc

RUN pip install --no-cache-dir croniter

RUN adduser -D -s /bin/bash backup

WORKDIR /app

COPY backup.sh /app/backup.sh
RUN chmod +x /app/backup.sh

USER backup

ENTRYPOINT ["/app/backup.sh"]
