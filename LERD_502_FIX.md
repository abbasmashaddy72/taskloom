# Taskloom — Lerd HTTP 502 troubleshooting

## What the logs indicate

- Historical `next: command not found` errors mean dependencies were not installed when Lerd first tried to boot.
- The newer `Next.js 16.4.0 ... Ready` lines prove the `next` binary became available, but **do not prove the Lerd nginx proxy can reach the server**.
- Earlier `package.json` pinned `next dev -H 127.0.0.1`; this can prevent a container-based proxy from reaching the host service.
- Lerd can inject `HOST` and `PORT` for host-proxy sites. The updated npm scripts use Lerd's `HOST` when set, and default to `127.0.0.1` for standalone localhost use. Next.js reads `PORT` from the process environment.
- `allowedDevOrigins: ['taskloom.test']` allows the local HTTPS hostname for Next.js's development assets/HMR.

## Apply locally (Fish shell)

```fish
cd ~/Documents/Project-Sites/Local/taskloom

# Confirm the dependencies were installed
 test -x node_modules/.bin/next; and echo 'Next.js installed'; or echo 'Next.js missing'

# Inspect the host process and the local endpoint
ss -ltnp | grep -E 'node|next|:3000'
curl -I --max-time 5 http://127.0.0.1:3000
curl -k -I --max-time 5 https://taskloom.test

# Apply a changed Lerd definition (in this ZIP) and allow Lerd to supervise dev server
lerd link
lerd status
lerd open
```

Do not start another `npm run dev` while Lerd is managing the site. If 502 persists, check the actual upstream port and connectivity; Lerd may have selected a port other than 3000. Inspect `lerd logs` or the dashboard and compare with Next.js's logged port.

### Manual project fix without extracting the ZIP

Set npm script `dev` to `next dev -H ${HOST:-127.0.0.1}`, and `start` to `next start -H ${HOST:-127.0.0.1}`. This is a POSIX-shell expansion inside npm scripts, even when the interactive shell is Fish.

In `next.config.ts`, include `allowedDevOrigins: ['taskloom.test']`.

### Troubleshooting decision tree

1. `node_modules/.bin/next` missing: install packages completely (`npm install --no-audit --no-fund`). Do not install Next.js globally.
2. Next.js not listening on the port Lerd expects: compare `ss -ltnp` and Lerd's chosen dev-server port. Lerd injects `PORT` into the process and Next.js reads it.
3. `curl http://127.0.0.1:3000` works but HTTPS fails: investigate Lerd proxy route, host-binding, upstream port, or reload.
4. Proxy works but application returns HTTP 500: check MongoDB connectivity and app server errors. This is a different issue from 502.
5. Systemd unit repeatedly restarts: `journalctl --user -u lerd-app-taskloom.service -n 80 --no-pager` to inspect current failures; old `command not found` errors can remain in the same log.

## Privacy

Taskloom has no user authentication yet: avoid sharing it publicly or exposing a dev server to untrusted networks. Host binding and TLS are not authentication.

## Verification

The config syntax and ZIP structure can be checked offline, but starting your actual Lerd site / checking its upstream and MongoDB require local machine access. A source-only check does **not** close Task T11.
