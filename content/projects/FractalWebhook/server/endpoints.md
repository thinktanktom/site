# Webhook Server — Endpoints

## POST /tradingview-webhook

Receives M/DB alert payloads from TradingView.

**Authentication:** 128-character shared secret in the request body (`secret` field).

**Accepts:** `application/json` and `text/plain` (TradingView sends `text/plain` by default).

**Request body:**

```json
{
  "secret": "<128-char-shared-secret>",
  "signal_type": "M",
  "direction": "bullish",
  "symbol": "MES",
  "timeframe": "5",
  "candle_timestamp": "2026-05-13T14:30:00Z",
  "candle_open": "5847.25",
  "candle_high": "5848.00",
  "candle_low": "5843.25",
  "candle_close": "5843.75"
}
```

All fields are required. `signal_type` must be `"M"` or `"DB"`. `direction` must be `"bullish"` or `"bearish"`. Direction comes from which TradingView alert condition fired — the bot does not infer it from the candle.

**Responses:**

| Code | Meaning |
|---|---|
| `200` | Signal accepted and queued. Body: `{"id": <signal_id>}` |
| `400` | Schema invalid — missing or malformed field |
| `403` | Wrong shared secret |
| `429` | Rate limit exceeded (10 requests/min per source IP) |

Every request is written to the `audit_log` table with its outcome.

---

## GET /signals/pending

Returns unprocessed signals for the polling client to consume.

**Authentication:** `Authorization: Bearer <128-char-bearer-token>`

**Response:**

```json
[
  {
    "id": 42,
    "signal_type": "M",
    "direction": "bearish",
    "symbol": "MES",
    "timeframe": "5",
    "candle_timestamp": "2026-05-13T14:30:00Z",
    "candle_open": "5847.25",
    "candle_high": "5848.00",
    "candle_low": "5843.25",
    "candle_close": "5843.75",
    "received_at_utc": "2026-05-13T14:30:03.142Z"
  }
]
```

Returns up to 50 signals where `acked_at_utc IS NULL` and `duplicate_of IS NULL`, ordered oldest-first. Returns an empty array if no signals are pending.

**Responses:** `200` on success, `401` on missing or wrong token.

---

## POST /signals/:id/ack

Marks a signal as processed.

**Authentication:** `Authorization: Bearer <128-char-bearer-token>`

Idempotent — re-acking a previously-acked signal returns `200` with no side effects. After acking, the signal no longer appears in `GET /signals/pending`.

**Responses:** `200` on success, `401` on missing or wrong token.

---

## GET /health

Returns operational status of the webhook server.

**Authentication:** `Authorization: Bearer <128-char-bearer-token>` (deliberate — prevents reconnaissance of queue stats).

**Response:**

```json
{
  "server_time_utc": "2026-05-13T14:31:00Z",
  "total_signals_received": 312,
  "pending_signal_count": 0,
  "oldest_pending_age_seconds": null,
  "last_webhook_received_utc": "2026-05-13T14:30:03Z",
  "retention_days": 30,
  "duplicates_last_24h": 1,
  "auth_failures_last_24h": 0
}
```

Used by the polling client for pre-session health checks and in-session monitoring.

**Responses:** `200` on success, `401` on missing or wrong token.
