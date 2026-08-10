# Srota nginx configs

One config file per subdomain. Each is a plain HTTP reverse-proxy pointing at
its container's host port; certbot's nginx plugin rewrites them to add the
SSL block + HTTP→HTTPS redirect on first run.

| File                | Public host              | Proxies to        |
| ------------------- | ------------------------ | ----------------- |
| `srota-ui.conf`     | srotaapps.com + www      | `127.0.0.1:3009`  |
| `srota-admin.conf`  | app.srotaapps.com        | `127.0.0.1:3006`  |
| `srota-api.conf`    | api.srotaapps.com        | `127.0.0.1:8006`  |
| `srota-pms.conf`    | pms.srotaapps.com        | `127.0.0.1:3007`  |
| `srota-rms.conf`    | rms.srotaapps.com        | `127.0.0.1:3008`  |

## First-time deploy (per subdomain)

DNS A-records for each subdomain need to point at the server first — otherwise
certbot can't complete the HTTP-01 challenge.

```bash
# 1. copy the config into nginx's sites-available (drop the .conf extension
#    to match the naming convention already used on the host)
sudo cp nginx/srota-ui.conf /etc/nginx/sites-available/srota-ui

# 2. enable it
sudo ln -sf /etc/nginx/sites-available/srota-ui /etc/nginx/sites-enabled/

# 3. sanity-check + reload
sudo nginx -t && sudo nginx -s reload

# 4. get the cert — certbot edits srota-ui in place to add the SSL block
sudo certbot --nginx -d srotaapps.com -d www.srotaapps.com
```

Repeat steps 1–4 for each of admin / api / pms / rms.

Auto-renewal is already installed by certbot's package — verify with:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

## Adding a new app later

1. `cp srota-<newapp>.conf` from an existing similar one (Vite frontends copy
   from `srota-rms.conf`, a Next.js frontend from `srota-admin.conf`, a
   FastAPI-shaped service from `srota-api.conf`)
2. Update `server_name`, `proxy_pass` port, and the log file names
3. Add the DNS A-record
4. Run the four deploy steps above

## Troubleshooting

- **502 Bad Gateway** — the container is down or listening on the wrong host
  port. `docker compose ps` to check status, `docker compose logs <service>`
  for detail.
- **`nginx -t` fails after certbot** — certbot may have created a temporary
  file. Look at `sudo nginx -T | grep -A1 server_name` to see what actually
  loaded.
- **Websocket disconnect on pms/rms (Vite HMR)** — check the `Upgrade` /
  `Connection` headers survived certbot's edit. Sometimes it drops them in
  the SSL block; re-add if needed.
- **CORS errors on api** — the FastAPI app already handles CORS; nginx just
  proxies. If you see CORS errors it's app-side, not nginx.
