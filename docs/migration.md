# Server Migration

## Step 1 — Start Postgres and MinIO only

```bash
docker compose up -d postgres minio redis
```

## Step 2 — Restore Postgres from S3

No host-level AWS CLI needed — both commands below use the `aws` CLI already
baked into the `postgres` container itself (`backup/wal-archive/Dockerfile`),
via `docker exec`.

### 2a. List available backups

```bash
docker exec srota-postgres aws s3 ls "s3://$(docker exec srota-postgres printenv BACKUP_S3_BUCKET)/postgres-backups/" --region "$(docker exec srota-postgres printenv BACKUP_S3_REGION)"
```

Note the filename of the one you want (the most recent `srota-db-YYYYMMDD-HHMMSS.sql.gz` covers everything up to that point).

### 2b. Restore that specific file into the running postgres container

```bash
./scripts/restore-postgres.sh <filename-from-step-2a>
```

### 2c. Verify — list tables and spot-check real data

The script itself already confirms tables exist, but this is a manual sanity
check that real data actually came back, not just an empty schema.

```bash
docker exec srota-postgres psql -U "$(docker exec srota-postgres printenv POSTGRES_USER)" -d "$(docker exec srota-postgres printenv POSTGRES_DB)" -c "\dt"
docker exec srota-postgres psql -U "$(docker exec srota-postgres printenv POSTGRES_USER)" -d "$(docker exec srota-postgres printenv POSTGRES_DB)" -c "select id, name, pan from tenants;"
```

`\dt` should list every app table (`tenants`, `restro_orders`, `ims_invoices`,
etc. — dozens of tables, not zero). The `tenants` query should show real rows,
not an empty result. Re-running `restore-postgres.sh` again on the same
backup is safe (confirmed 2026-09-05) — every row already present causes a
harmless duplicate-key error that `-v ON_ERROR_STOP=0` skips past, so nothing
gets duplicated or corrupted.

## Step 3 — Restore MinIO from S3

### 3a. List available backups

```bash
./scripts/restore-minio.sh list
```

### 3b. Restore all buckets (latest backup for each)

```bash
./scripts/restore-minio.sh restore-all
```

If MinIO doesn't have the bucket yet (fresh volume), this creates it
automatically before restoring into it.

### 3c. Verify — list files in the restored bucket

```bash
docker exec srota-minio mc alias set local http://localhost:9000 "$(docker exec srota-minio printenv MINIO_ROOT_USER)" "$(docker exec srota-minio printenv MINIO_ROOT_PASSWORD)"
docker exec srota-minio mc ls --recursive local/dream-uploads/ | wc -l
```

Should show a real, non-zero file count (23 files as of 2026-09-05). Confirmed
working end-to-end against a genuinely fresh, empty MinIO volume.

## Step 4 — Restore WAL (only if WAL_ARCHIVE_ENABLED was on before the disaster)

Only needed for point-in-time recovery beyond the last `pg_dumpall` snapshot
restored in Step 2. Unlike Postgres/MinIO restore, there's no single "latest
file" to pick here — WAL segments only make sense replayed as a complete,
ordered sequence on top of the pg_dumpall snapshot, so the restore script
always replays everything available, not just the newest segment.

### 4a. List available segments (just to see what's there)

```bash
docker exec srota-postgres aws s3 ls "s3://$(docker exec srota-postgres printenv BACKUP_S3_BUCKET)/wal-archive/" --region "$(docker exec srota-postgres printenv BACKUP_S3_REGION)"
```

If this is empty, `wal-archive/` has nothing to restore — skip straight to
Step 5 (`restore-wal.sh` also detects this itself and no-ops safely).

### 4b. Restore all available segments

**Must run before Step 5** — it restarts postgres into recovery mode, which
any service actively connected to it (api, worker, frontends) won't handle
gracefully. In the real migration order (Steps 1→2→3→4→5) this is naturally
already the case: only postgres/minio/redis exist at this point, nothing
else has started yet, so no extra step is needed here.

```bash
./scripts/restore-wal.sh
```

(If you're testing out of order — e.g. Step 5 already ran and everything is
up — stop the other services first: `docker-compose stop api worker rms ims
ui admin nginx-proxy acme-companion postgres-backup minio-backup`, then run
the restore. Not needed in the real sequence.)

Watch `docker logs srota-postgres` for `database system is ready to accept
connections` after `archive recovery complete` — confirms replay finished
cleanly.

### 4c. Verify — confirm recovery actually completed, not stuck or failed

```bash
docker exec srota-postgres psql -U "$(docker exec srota-postgres printenv POSTGRES_USER)" -d "$(docker exec srota-postgres printenv POSTGRES_DB)" -c "select pg_is_in_recovery();"
docker exec srota-postgres psql -U "$(docker exec srota-postgres printenv POSTGRES_USER)" -d "$(docker exec srota-postgres printenv POSTGRES_DB)" -c "select id, name, pan from tenants;"
```

`pg_is_in_recovery()` must return `f` — `t` means it's still replaying (wait
and re-check) or stuck (check `docker logs srota-postgres` for errors). The
`tenants` query should still show real rows, same as Step 2c's check.
Confirmed working 2026-09-05: 2 real WAL segments replayed, `pg_is_in_recovery()`
correctly returned `f`, tenant data intact afterward, `archive_mode` correctly
resumed `on` (archiving continues normally post-recovery, no re-enable needed).

## Step 5 — Start everything else

```bash
docker compose up -d --build
```

Same bare command for both dev and prod. Whether `nginx-proxy` +
`acme-companion` start too depends on `COMPOSE_PROFILES` in `.env`:

- Unset/empty → dev mode, they're skipped entirely (confirmed 2026-09-05).
- `COMPOSE_PROFILES=prod` → they start, and issue real Let's Encrypt certs
  for whatever real, DNS-pointed domains are set in `UI_VIRTUAL_HOST` /
  `ADMIN_VIRTUAL_HOST` / `RMS_VIRTUAL_HOST` / `IMS_VIRTUAL_HOST` /
  `API_VIRTUAL_HOST` / `CERTBOT_EMAIL`. Confirmed 2026-09-05 against fake
  `*.local.test` hostnames: nginx-proxy correctly generated per-hostname
  routing (each app reachable only via its own hostname, verified no
  cross-contamination between apps), and acme-companion correctly reached
  the real Let's Encrypt API and safely failed on the fake domain (`"Domain
name does not end with a valid public suffix (TLD)"`) — proving the
  mechanism is live and will work against real, DNS-pointed domains.

Migration complete once this step's containers are all healthy — check with
`docker ps` and the individual app URLs.

## Shared server (this box also runs another app owning ports 80/443)

Confirmed working 2026-09-05 on a real production cutover (srotaapps.com +
subdomains, sharing this server with `poko` on system nginx):

- `.env`: `NGINX_HTTP_PORT=8080`, `NGINX_HTTPS_PORT=8443`,
  `ACME_PROFILE=disabled` — nginx-proxy binds the alt ports instead of
  80/443 (no conflict with the other app's nginx), and acme-companion never
  starts (it can't win the Let's Encrypt HTTP-01 challenge without owning
  port 80 itself — certbot on the host keeps handling cert renewal exactly
  as it already did before this change, nothing new needed there).
- Existing `/etc/nginx/sites-available/srota-*` files are **kept, not
  deleted** — only their `proxy_pass` line changes, from pointing at a
  container's own host port to pointing at `127.0.0.1:8080` (nginx-proxy).
  Everything else (the SSL block certbot already added, the 80→443
  redirect, `server_name`) stays untouched. One `sed` per file:
  `sudo sed -i 's|proxy_pass http://127.0.0.1:<old-port>;|proxy_pass http://127.0.0.1:8080;|' /etc/nginx/sites-available/srota-<app>`
- After editing all site files: `sudo nginx -t` (should pass cleanly, only
  the proxy target changed) — do NOT reload yet.
- `docker compose up -d nginx-proxy` — bring nginx-proxy up on the alt
  ports first, confirm it's actually routing before touching system nginx:
  `curl -I -H "Host: <domain>" http://127.0.0.1:8080` for each app.
- Only once every app routes correctly on 8080: `sudo nginx -s reload` —
  this is the moment real traffic switches over. Verify immediately against
  the real public domains (`curl -I https://<domain>`), including `poko`'s
  own domains to confirm it's genuinely unaffected.
- **Gotcha hit for real**: a container answering to more than one hostname
  (e.g. `srotaapps.com` + `www.srotaapps.com`, both served by `ui`) needs
  ALL of them listed in its `*_VIRTUAL_HOST` env var, comma-separated
  (`UI_VIRTUAL_HOST=srotaapps.com,www.srotaapps.com`) — nginx-proxy has no
  concept of "www is an alias of the bare domain" on its own. Missing this
  produces a real, confusing 503 on the un-listed hostname specifically,
  while the primary domain works fine — easy to miss since most testing
  naturally hits the bare domain first.
- **Tradeoff of this mode**: adding a brand-new app later still needs one
  new manual nginx site file + one manual `certbot --nginx -d newapp.com`
  run, since system nginx (not nginx-proxy) is what decides which domains
  exist at the front door on a shared server. On a dedicated server (no
  port conflict, `NGINX_HTTP_PORT`/`ACME_PROFILE` left at their defaults),
  adding a new app needs zero manual nginx/certbot work — just `VIRTUAL_HOST`/
  `LETSENCRYPT_HOST` env vars on the new service and `docker compose up -d`.
