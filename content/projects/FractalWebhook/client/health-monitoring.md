# Polling Client — Health Monitoring

## Pre-Session Health Check

Before entering any trading session, the polling client calls `GET /health` once and verifies all of the following:

| Check | Pass condition |
|---|---|
| Server reachable | HTTP 200 received |
| TLS certificate valid | No certificate error from the HTTP client |
| Clock sync | Server time within 60 seconds of laptop time |
| No stale signals | No pending signals older than 5 minutes |

If **any** check fails, the polling client surfaces a clear error in the Claude Code chat and refuses to enter the session. The operator must resolve the issue before trading can start.

The pre-session health check does **not** send a Telegram message — the operator is at the laptop initiating the session and will see the error directly.

---

## In-Session Health Monitoring

During an active trading session, the polling client calls `GET /health` every 60 seconds.

If **3 consecutive health calls fail**, the client:

1. Logs a `system_event` with `severity = warning`
2. Surfaces the error in the Claude Code chat
3. Sends a Telegram message: *"Webhook server unreachable. New setups paused. Open trades unaffected."*
4. Pauses new setup initiation

Open trades are unaffected — their stop-loss and take-profit brackets are managed at the broker level (Phase 3) or locally (Phase 1 and Phase 2) and do not depend on the webhook server.

On **health recovery**, the client:

1. Logs the recovery
2. Surfaces it in the Claude Code chat
3. Sends a recovery Telegram message: *"Webhook server back. Reply 'resume' in Claude Code to start new setups."*
4. Prompts the operator to manually resume new setup initiation

Manual resume is required on recovery — the client does not automatically restart setups to ensure the operator is aware of the interruption.

---

## Stale Signal Detection

A stale signal is a pending (unacked) signal older than 5 minutes. Stale signals at pre-session health check time indicate a crash in the previous session that left signals unprocessed.

The operator must investigate and clear stale signals before starting a new session. The SQLite database can be inspected directly to understand which signals are pending and when they were received (see [Deployment Guide](/projects/FractalWebhook/deployment/guide)).
