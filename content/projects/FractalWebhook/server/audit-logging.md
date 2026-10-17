# Webhook Server — Audit Logging

## Overview

Every authentication and queue event is logged to the `audit_log` SQLite table. The log is the forensic record for security review, misconfiguration diagnosis, and operational monitoring.

---

## Audit Log Schema

```sql
audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time_utc  TEXT NOT NULL,   -- ISO-8601 UTC
  source_ip       TEXT NOT NULL,   -- originating IP as seen by the application
  endpoint        TEXT NOT NULL,   -- e.g. "POST /tradingview-webhook"
  outcome         TEXT NOT NULL,   -- see outcome values below
  detail          TEXT             -- human-readable detail, NULL for routine events
)
```

---

## Outcome Values

Exactly five valid outcome values:

| Outcome | Trigger |
|---|---|
| `accepted` | Signal validated and stored; polling request authenticated; ack recorded |
| `auth_failed` | Wrong shared secret (webhook) or missing/wrong bearer token (polling, ack, health) |
| `duplicate` | Signal matched an existing signal within the dedup window |
| `rate_limited` | Source IP exceeded the per-endpoint rate limit (enforced by Caddy before the app sees the request — logged at the app layer only if Caddy passes it through) |
| `schema_invalid` | Request body missing required fields or contains malformed values |

---

## Querying the Audit Log

```bash
# List all auth failures in the last 24 hours
sqlite3 /var/lib/fractal/queue.db \
  "SELECT event_time_utc, source_ip, endpoint, detail
   FROM audit_log
   WHERE outcome = 'auth_failed'
     AND event_time_utc > datetime('now', '-1 day')
   ORDER BY event_time_utc DESC;"

# Count duplicates by day
sqlite3 /var/lib/fractal/queue.db \
  "SELECT date(event_time_utc) as day, COUNT(*) as dups
   FROM audit_log
   WHERE outcome = 'duplicate'
   GROUP BY day
   ORDER BY day DESC;"

# All events for a specific signal
sqlite3 /var/lib/fractal/queue.db \
  "SELECT a.event_time_utc, a.outcome, a.detail
   FROM audit_log a
   WHERE a.detail LIKE '%id=42%'
   ORDER BY a.event_time_utc;"
```

---

## Secret Redaction

The webhook payload's `secret` field is stripped before the payload is written to any log. Secrets never appear in `audit_log`, application logs, or the systemd journal.

---

## Retention

Audit log rows are subject to the same 30-day retention as signal rows. The daily retention job deletes `audit_log` entries where `event_time_utc < NOW - 30 days`. The retention period is configurable via `retention-days` in `application.yaml`.
