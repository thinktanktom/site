# Deployment — Deployment Guide

## Overview

The webhook server runs on a DigitalOcean droplet (Ubuntu 24.04, 2 GB RAM / 1 vCPU). The application is a Spring Boot JAR behind the Caddy reverse proxy. Caddy handles TLS termination and rate limiting. systemd manages the service lifecycle.

---

## Stack

| Component | Version |
|---|---|
| OS | Ubuntu 24.04 LTS |
| Java runtime | OpenJDK 21 (headless JRE) |
| Application | Spring Boot JAR (`fractal-webhook-server.jar`) |
| Reverse proxy | Caddy (latest stable, via official APT repo) |
| Database | SQLite (file at `/var/lib/fractal/queue.db`) |
| Service manager | systemd |
| Firewall | ufw |

---

## Build

The application is built on the developer's workstation from source using Maven:

```bash
mvn clean package
# produces: target/fractal-webhook-server.jar
```

The test suite must pass before deploying. A failing build must not be deployed.

Transfer the JAR to the droplet:

```bash
scp target/fractal-webhook-server.jar root@<droplet-ip>:/tmp/
```

---

## Directory Layout

```
/opt/fractal/
    fractal-webhook-server.jar     # application JAR (root:fractal, 640)

/etc/fractal/
    webhook.env                    # secrets env file (root:fractal, 640)

/var/lib/fractal/
    queue.db                       # SQLite database (fractal:fractal, 750)

/var/log/fractal/
    webhook.log                    # rotating application log (fractal:fractal, 750)

/etc/systemd/system/
    fractal-webhook.service        # service unit

/etc/caddy/
    Caddyfile                      # reverse proxy + rate limiting config
```

---

## Secrets

Two 128-character URL-safe random strings are generated on the droplet and never transmitted in plaintext or committed to source control:

```bash
# Generate shared secret
openssl rand -base64 96 | tr -d '\n/+=' | cut -c1-128 ; echo

# Generate bearer token (run again for a distinct value)
openssl rand -base64 96 | tr -d '\n/+=' | cut -c1-128 ; echo
```

Written to `/etc/fractal/webhook.env`:

```env
FRACTAL_WEBHOOK_SHARED_SECRET=<128-char-shared-secret>
FRACTAL_POLLING_BEARER_TOKEN=<128-char-bearer-token>
FRACTAL_DATABASE_PATH=/var/lib/fractal/queue.db
```

File permissions: `chown root:fractal /etc/fractal/webhook.env && chmod 640 /etc/fractal/webhook.env`.

---

## systemd Service

```ini
[Unit]
Description=Fractal Effects Webhook Server
After=network.target

[Service]
Type=simple
User=fractal
Group=fractal
EnvironmentFile=/etc/fractal/webhook.env
ExecStart=/usr/bin/java -Xms128m -Xmx512m \
  -jar /opt/fractal/fractal-webhook-server.jar
SuccessExitStatus=143
Restart=on-failure
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/fractal /var/log/fractal
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

The service auto-starts on boot (`systemctl enable fractal-webhook`) and auto-restarts on crash with a 10-second delay.

---

## Verification

Five end-to-end checks before handing over:

```bash
# 1. Valid webhook — expect HTTP 200
curl -s -X POST https://your-domain/tradingview-webhook \
  -H 'Content-Type: application/json' \
  -d '{"secret":"<shared-secret>","signal_type":"M","direction":"bearish",
       "symbol":"MES","timeframe":"5","candle_timestamp":"2026-05-13T14:30:00Z",
       "candle_open":"5847.25","candle_high":"5848.00",
       "candle_low":"5843.25","candle_close":"5843.75"}'

# 2. Wrong secret — expect HTTP 403
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://your-domain/tradingview-webhook \
  -H 'Content-Type: application/json' \
  -d '{"secret":"WRONG","signal_type":"M","direction":"bearish","symbol":"MES",
       "timeframe":"5","candle_timestamp":"2026-05-13T14:30:00Z",
       "candle_open":"1","candle_high":"1","candle_low":"1","candle_close":"1"}'

# 3. text/plain content type (TradingView's format) — expect HTTP 200
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://your-domain/tradingview-webhook \
  -H 'Content-Type: text/plain' \
  -d '{"secret":"<shared-secret>","signal_type":"M","direction":"bearish","symbol":"MES",
       "timeframe":"5","candle_timestamp":"2026-05-13T14:31:00Z",
       "candle_open":"1","candle_high":"1","candle_low":"1","candle_close":"1"}'

# 4. Fetch pending signals — expect HTTP 200 with array
curl -s https://your-domain/signals/pending \
  -H 'Authorization: Bearer <bearer-token>'

# 5. Health check — expect HTTP 200 with status object
curl -s https://your-domain/health \
  -H 'Authorization: Bearer <bearer-token>'
```

---

## Day-to-Day Operations

**View logs:**

```bash
journalctl -u fractal-webhook -f        # live systemd journal
tail -f /var/log/fractal/webhook.log    # application log file
```

**Inspect the queue:**

```bash
sqlite3 /var/lib/fractal/queue.db \
  'SELECT id, signal_type, direction, symbol, candle_timestamp,
          received_at_utc, acked_at_utc
   FROM received_signals
   ORDER BY received_at_utc DESC LIMIT 20;'
```

**Deploy a new JAR:**

```bash
scp target/fractal-webhook-server.jar root@<droplet-ip>:/tmp/
systemctl stop fractal-webhook
mv /tmp/fractal-webhook-server.jar /opt/fractal/
chown root:fractal /opt/fractal/fractal-webhook-server.jar
systemctl start fractal-webhook
systemctl status fractal-webhook
```

The database is untouched by a JAR upgrade — queued signals and history are preserved.
