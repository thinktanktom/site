# Webhook Server — Signal Deduplication

## The Problem

TradingView can fire the same alert more than once for the same candle — for example, if the indicator re-evaluates on a tick update after the alert already fired. The trading strategy must not initiate two setups from the same anchor candle.

Deduplication is enforced at two layers:

1. **Server-side** — the webhook server detects and flags duplicate payloads before they reach the polling client.
2. **Strategy-side** — the cascade logic in the trading bot handles re-delivered signals (same anchor candle) without creating a duplicate setup.

---

## Server-Side Deduplication

A signal is flagged as a duplicate if an existing signal with the same `(signal_type, candle_timestamp)` was received within the prior **90 seconds** (configurable via `dedup_window_seconds` in `application.yaml`).

The 90-second window is consistent with the strategy's anchor-candle deduplication window.

Duplicate signals are **stored** (not dropped) but marked with a `duplicate_of` foreign key pointing to the original signal's `id`. They are excluded from `GET /signals/pending` responses, so the polling client never sees them.

Every deduplication event is logged to `audit_log` with `outcome = 'duplicate'`.

---

## Dedup Key

```
(signal_type, candle_timestamp)
```

`direction`, `symbol`, and OHLC values are intentionally excluded from the dedup key. The same candle timestamp for the same signal type is considered the same signal regardless of minor payload differences.

---

## Why Store Duplicates?

Storing duplicates rather than dropping them provides forensic visibility: the `audit_log` and `received_signals` tables together show exactly what TradingView sent and which signals were treated as duplicates. This is useful when diagnosing misconfigured TradingView alerts or unexpected indicator behaviour.

---

## Strategy-Side Deduplication

Even with server-side deduplication, a signal can be re-delivered to the polling client if the bot crashes after receiving the signal but before acking it (see [Polling Loop](/projects/FractalWebhook/client/polling-loop)). The trading strategy handles this case independently: if an M or DB cascade is already active for the same anchor candle, the re-delivered signal is ignored. This is the correct failure mode — a missed trade is worse than a harmless re-delivery.
