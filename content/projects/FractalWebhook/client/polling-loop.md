# Polling Client — Polling Loop

## Overview

The polling client runs on the operator's laptop during trading sessions. Its job is to drain the signal queue on the webhook server and deliver each signal to the trading bot's cascade entry point.

---

## Process-Before-Ack Ordering

The most important design decision in the polling client is the ordering of process and ack:

```
for each signal in GET /signals/pending:
    1. Validate symbol against allow-list
    2. Pass signal to cascade entry point   ← FIRST
    3. POST /signals/{id}/ack               ← THEN
```

This provides **at-least-once delivery semantics**. If the bot crashes between steps 2 and 3, the signal remains unacked. On the next poll, the signal is returned again and the cascade restarts.

The alternative — ack-before-process — was rejected because silent loss is the worse failure mode. A missed trade is unobservable until the operator reviews the session. A re-delivered signal is handled cleanly by the strategy's own anchor-candle deduplication.

---

## Poll Interval

The polling client calls `GET /signals/pending` every **3 seconds** (configurable via `FRACTAL_POLL_INTERVAL_SECONDS` in the laptop `.env`). End-to-end signal delivery (TradingView alert to cascade start) targets under 5 seconds, dominated by the polling interval. The strategy operates on 5-minute candles, so multi-second latency is invisible at the strategy level.

---

## Symbol Allow-List

Before handing a signal to the cascade, the polling client validates the signal's symbol against the `allowed_symbols` list (default: `["MES"]`). Signals for symbols not in the allow-list are:

1. Rejected at the polling-client boundary
2. Logged as a `system_event` with `severity = warning`
3. Acked back to the webhook server (so they do not re-poll)
4. Never passed to the cascade

---

## Signal Object

The polling client returns a typed `Signal` Python dataclass to its caller:

```python
@dataclass
class Signal:
    id: int
    signal_type: str        # "M" or "DB"
    direction: str          # "bullish" or "bearish"
    symbol: str
    timeframe: str
    candle_timestamp: str   # ISO-8601 UTC
    candle_open: float
    candle_high: float
    candle_low: float
    candle_close: float
    received_at_utc: str
```

The polling client does not implement cascade logic. It is a signal transport with a symbol-allowlist gate.

---

## Configuration

```env
FRACTAL_WEBHOOK_URL=https://your-webhook-domain.com
FRACTAL_POLLING_BEARER_TOKEN=<128-char-token>
FRACTAL_POLL_INTERVAL_SECONDS=3
```
