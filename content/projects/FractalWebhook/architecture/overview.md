# Architecture — System Overview

## Request Path

The public request path, outermost to innermost:

```
TradingView
    │
    │  HTTPS :443
    ▼
Caddy reverse proxy
  - TLS termination (Let's Encrypt, auto-renewed)
  - Per-endpoint rate limiting
  - HTTP → HTTPS redirect
    │
    │  HTTP :8080 on localhost only
    ▼
Java / Spring Boot application
  - Shared-secret validation (webhook)
  - Bearer-token validation (polling, ack, health)
  - Signal deduplication
  - Audit logging
    │
    ▼
SQLite database (/var/lib/fractal/queue.db)
```

Caddy is the only process reachable from the internet. The Java application binds to `127.0.0.1:8080` — direct external access is impossible regardless of firewall state.

---

## Component Responsibilities

### Webhook Server (VPS)

- Receives `POST /tradingview-webhook` from TradingView alerts
- Validates the shared secret and JSON schema
- Deduplicates signals within a 90-second window
- Persists accepted signals to the `received_signals` SQLite table
- Serves `GET /signals/pending` for the polling client (up to 50 unacked signals, oldest-first)
- Handles `POST /signals/{id}/ack` to mark signals as processed
- Serves `GET /health` with queue depth, timestamps, and counts
- Runs a daily retention job (delete signals and audit records older than 30 days)
- Runs a weekly SQLite `VACUUM` to reclaim disk space

### Polling Client (Laptop)

- Calls `GET /signals/pending` every 3 seconds during trading sessions
- Validates each signal's symbol against an allow-list before passing it to the cascade
- Implements process-before-ack ordering (hand signal to cascade, then ack)
- Performs a pre-session health check before entering any trading session
- Monitors server health every 60 seconds during active sessions
- Implements exponential backoff on transient errors (1s → 2s → 4s → ... capped at 60s)

### Telegram Notifier (Laptop)

- Exposes methods called by the trading bot's lifecycle and system-event handlers
- Sends one HTTPS POST to the Telegram Bot API per event
- Maintains no trading-session state — all computed values (running R, P&L) are passed in by the caller
- Never retries; never blocks

---

## Database Schema (Overview)

```sql
received_signals (
  id               INTEGER PRIMARY KEY,
  signal_type      TEXT,        -- "M" or "DB"
  direction        TEXT,        -- "bullish" or "bearish"
  symbol           TEXT,
  timeframe        TEXT,
  candle_timestamp TEXT,        -- ISO-8601 UTC
  candle_open      TEXT,
  candle_high      TEXT,
  candle_low       TEXT,
  candle_close     TEXT,
  received_at_utc  TEXT,
  acked_at_utc     TEXT,        -- NULL until acked
  duplicate_of     INTEGER      -- FK to id of original, NULL if not a duplicate
)

audit_log (
  id              INTEGER PRIMARY KEY,
  event_time_utc  TEXT,
  source_ip       TEXT,
  endpoint        TEXT,
  outcome         TEXT,   -- accepted | auth_failed | duplicate | rate_limited | schema_invalid
  detail          TEXT
)
```

The database file lives at `/var/lib/fractal/queue.db`. It is the source of truth for signal state and survives VPS reboots.

---

## Resource Footprint

The webhook server is sized for a 1 GB RAM VPS. Java heap is configured at `-Xms128m -Xmx512m`. Signal volume is low (a few signals per trading session), so the SQLite file stays well under 10 MB at steady state under the 30-day retention policy.
