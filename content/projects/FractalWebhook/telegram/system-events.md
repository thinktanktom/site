# Telegram Notifier — System Notifications

## Send-and-Forget Policy

All Telegram sends are best-effort. The notifier attempts each message once. Failures are logged as `system_event` warnings. There is no retry queue. The Claude Code chat in the IDE is the durable record — a failed Telegram send does not mean the event was unrecorded.

The bot does not receive commands via Telegram. Operator commands are entered into Claude Code on the laptop.

---

## Health Check Failure / Recovery (FR-20)

**Failure** — fires when in-session health monitoring detects 3 consecutive failures:

> Webhook server unreachable. New setups paused. Open trades unaffected.

**Recovery** — fires when health is restored after a failure period:

> Webhook server back. Reply 'resume' in Claude Code to start new setups.

Distinct emoji on each (warning symbol vs check mark).

---

## Daily Loss Cap (FR-21)

Fires when the daily loss cap triggers (3 consecutive losses or −2R cumulative, whichever occurs first). Sent once per trigger event — not re-sent if additional losing trades close while the cap is already active.

> Daily loss cap triggered: [X] losses today ([Y]R cumulative). New setups halted until tomorrow's Asia session.

---

## Account-Value Floor (FR-22)

Fires when the account drops below 50% of baseline. Built for Phase 3 — in Phase 1 and Phase 2 (fixed account size), this notification cannot fire.

> Account-value floor breached. Account at [$X] ([Y]% of baseline). All trading halted. Manual review required.

---

## IBKR Feed Warning (FR-27)

Fires when the bot logs an IBKR feed event with severity warning or above (feed latency, disconnection, reconnection, abort).

**Contains:** event type (warning/error/abort), brief description (e.g. "Feed delay 4.2s", "Disconnected", "Reconnected"), and whether new setups are paused.

**Deduplication:** only the first warning in a 60-second window produces a notification. Subsequent events in the same window are logged but not sent. The dedup window resets on transition between event types.

---

## System Start / Stop (FR-28)

**Start** — fires when Claude Code starts successfully (config loaded, IBKR connected, polling and notifier initialized):

> System started. Phase: [N]. Symbol(s): [list]. Session: [current session or 'outside trading hours'].

**Stop** — fires on clean, operator-initiated shutdown:

> System stopped cleanly. Cumulative R today: [X]R. Last trade: [HH:MM ET].

Crash-mode shutdown does **not** produce this notification. If Claude Code crashes, the OS does not give the notifier a chance to send a graceful exit message. The absence of an expected daily summary or trade notification is the operator's signal that something went wrong.

---

## System Event Notifier Interface

```python
notify_health_failure(consecutive_failures: int)
notify_health_recovery()
notify_daily_loss_cap(loss_count: int, cumulative_r: float)
notify_account_floor_breach(account_value: float, baseline: float, pct: float)
notify_ibkr_feed_warning(event_type: str, description: str, setups_paused: bool)
notify_system_start(phase: int, symbols: list[str], session: str)
notify_system_stop(cumulative_r_today: float, last_trade_time: str | None)
```
