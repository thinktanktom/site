# Security — Security Model

## Authentication Mechanisms

Two independent secrets protect the two distinct trust boundaries:

### Shared Secret (Webhook Receiver)

`POST /tradingview-webhook` requires a 128-character URL-safe random string in the request body (`secret` field). The secret is generated on the VPS during deployment and transmitted to the operator via a secure channel. The operator embeds it in each TradingView alert payload template.

Wrong-secret requests are rejected with HTTP 403 and logged to `audit_log` as `auth_failed`.

### Bearer Token (Polling, Ack, Health)

`GET /signals/pending`, `POST /signals/{id}/ack`, and `GET /health` require the same 128-character bearer token in the `Authorization: Bearer <token>` header. The token is a separate value from the shared secret — a webhook compromise does not expose the polling interface, and vice versa.

`GET /health` requires authentication deliberately. Unauthenticated health endpoints expose internal queue statistics that could be used for reconnaissance or to time attacks.

---

## Constant-Time Comparison

Both the shared secret and bearer token comparisons use `java.security.MessageDigest.isEqual` — a constant-time comparison that is immune to timing attacks. A naive string equality check (`==` or `equals()`) reveals how much of the secret matches by measuring response latency.

---

## No IP Allowlisting on Web Ports

TradingView's webhook source IPs change without notice. The operator's laptop IP changes with travel and ISP rotation. IP allowlisting on ports 80/443 would cause silent breakage in both cases.

Authentication via 128-character random tokens provides approximately **760 bits of entropy** — the probability of guessing a valid token by brute force is astronomically small. Rate limiting (see below) makes even a sustained guessing attack impractical.

SSH (port 22) **is** restricted to the operator's IP and the developer's IP. There is no operational reason for SSH to be publicly accessible.

---

## Rate Limiting

Per-source-IP rate limits are enforced at the Caddy layer, before the Java application sees the request:

| Endpoint | Limit | Reasoning |
|---|---|---|
| `POST /tradingview-webhook` | 10 req/min | TradingView max ~12/hour; generous headroom |
| `GET /signals/pending` | 60 req/min | 20/min steady state; 3x headroom for reconnects |
| `POST /signals/{id}/ack` | 120 req/min | One ack per signal; signals are infrequent |
| `GET /health` | 30 req/min | Once per 60s steady state; covers bursts |

Requests over the limit return HTTP 429.

---

## Service Isolation

The webhook server runs as the `fractal` system user with:

- No login shell (`/usr/sbin/nologin`)
- No home directory
- `NoNewPrivileges=true` — cannot gain new capabilities
- `ProtectSystem=strict` — filesystem is read-only except where explicitly allowed
- `ProtectHome=true` — `/home`, `/root`, `/run/user` are inaccessible
- `ReadWritePaths=/var/lib/fractal /var/log/fractal` — only these two directories are writable
- `PrivateTmp=true` — isolated `/tmp`

A compromise of the Java process cannot escalate privileges or access the rest of the filesystem.

---

## Secret Storage

- **VPS:** secrets in `/etc/fractal/webhook.env`, mode `0640`, owned `root:fractal`. The `fractal` user can read but not modify.
- **Laptop:** secrets in the Claude Code project `.env` file, not committed to source control.
- Secrets are never written to application logs. The webhook payload's `secret` field is stripped before any logging occurs.

---

## Secret Rotation

Rotation procedure (recommended quarterly or immediately on suspected compromise):

1. Generate a new 128-character secret with `openssl rand -base64 96 | tr -d '\n/+=' | cut -c1-128`
2. Update the value in `/etc/fractal/webhook.env` on the VPS
3. Restart the service: `systemctl restart fractal-webhook`
4. Deliver the new value to the operator securely
5. For the **shared secret**: operator updates TradingView alert payload templates
6. For the **bearer token**: coordinate with the operator — polling breaks until the laptop `.env` is updated

---

## TLS

All external traffic is HTTPS. TLS is terminated at the Caddy reverse proxy. Certificates are auto-provisioned and auto-renewed via Let's Encrypt (HTTP-01 challenge). HTTP requests are redirected to HTTPS by Caddy. The Java application listens on HTTP only on `127.0.0.1:8080` — external HTTP access to the application is architecturally impossible.
