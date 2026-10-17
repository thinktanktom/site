# Architecture — Data Flow

## Inbound: TradingView to Claude Code

```
1. Trader's TradingView indicator prints an M or DB marker on the chart.

2. TradingView fires a configured alert (one of four:
   M Bullish, M Bearish, DB Bullish, DB Bearish).

3. TradingView POSTs to https://[webhook-domain]/tradingview-webhook
   with a JSON body containing the signal fields and shared secret.

4. Caddy receives the HTTPS request, checks rate limits,
   and forwards to the Java app on localhost:8080.

5. Java app validates:
   - shared secret matches (constant-time comparison)
   - JSON schema is valid (all required fields present and typed correctly)
   - signal is not a duplicate within the 90-second dedup window

6. Signal is stored in received_signals with acked_at_utc = NULL.
   HTTP 200 + { "id": <signal_id> } returned to TradingView.

7. Polling client (running on operator's laptop) calls
   GET /signals/pending every 3 seconds.

8. Server returns up to 50 unacked, non-duplicate signals, oldest-first.

9. For each returned signal:
   a. Polling client validates symbol against allow-list.
   b. Signal is passed to the cascade entry point.
   c. Once cascade has successfully started:
      POST /signals/{id}/ack marks the signal as processed.

10. Signal disappears from future /signals/pending responses.
```

**Key property:** Step 9b happens before 9c. If the bot crashes between b and c, the signal is re-delivered on the next poll. The strategy's deduplication logic (same anchor candle) handles the re-delivery without creating a duplicate setup.

---

## Outbound: Claude Code to Operator

```
1. Claude Code's lifecycle handler processes a trade event
   (entry filled, SL hit, TP hit, flatten, end-of-day)
   or a system event (health failure, daily loss cap, etc.).

2. The handler calls the appropriate Telegram notifier method,
   passing all computed state as parameters.

3. Notifier constructs a terse, phone-readable message.

4. Notifier POSTs to https://api.telegram.org/bot<token>/sendMessage.

5. Message appears on the operator's phone.

6. If the send fails for any reason:
   - Warning is logged as a system_event
   - Processing continues unaffected
   - No retry is attempted
```

**Key property:** Telegram sends never block trade execution. The system is designed so that a sustained Telegram outage has zero impact on trading operations. The Claude Code chat in the IDE is the durable record.

---

## Off-Hours Queuing

The webhook server runs 24/7. Signals received while the operator's laptop is off are queued in SQLite and remain available. When the operator starts a trading session, the polling client drains the queue.

The pre-session health check (see [Health Monitoring](/projects/FractalWebhook/client/health-monitoring)) alerts the operator if stale signals (older than 5 minutes) are pending, indicating a previous-session crash that needs investigation before trading resumes.

---

## Failure Modes

| Failure | Consequence | Recovery |
|---|---|---|
| VPS unreachable (transient) | Signals queue on TradingView side; polling client uses exponential backoff | Automatic on reconnect |
| VPS unreachable (sustained, in-session) | After 3 consecutive health failures: new setups paused, Telegram alert sent | Manual resume after operator confirmation |
| Laptop internet drops | Queued signals stay on VPS; polling resumes on reconnect with no signal loss | Automatic |
| Bot crashes mid-cascade | Unacked signal re-delivered on next poll; cascade restarts cleanly | Automatic (via at-least-once delivery) |
| Telegram API unreachable | Warning logged; no trade impact | N/A (fire-and-forget) |
| Wrong bearer token | Polling halts with clear operator-visible error | Operator fixes config |
